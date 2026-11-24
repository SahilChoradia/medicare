process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'x'.repeat(40); process.env.CLIENT_ORIGIN = 'http://localhost:5173';
const request = require('supertest'); const mongoose = require('mongoose'); const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../src/app'); const { Doctor, Service, Appointment } = require('../src/models');
const { generateSlots, nowIST, addDays } = require('../src/slots');
let mongod, app, doc, s1, s2; const date = addDays(nowIST().date, 1);
beforeAll(async () => {
  mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); await Appointment.init();
  s1 = await Service.create({ name: 'Consultation' }); s2 = await Service.create({ name: 'X-Ray' });
  doc = await Doctor.create({ name: 'Dr Test', services: [s1._id, s2._id], breaks: [{ start: '13:00', end: '14:00' }] }); app = createApp();
});
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });
beforeEach(() => Appointment.deleteMany());
const body = (o = {}) => ({ doctorId: String(doc._id), serviceId: String(s1._id), date, slotStart: '09:00', patientName: 'Asha Rao', patientPhone: '9876543210', ...o });

test('generates 2-hour slots and skips breaks', () => {
  expect(generateSlots({ start: '09:00', end: '17:00' }, [{ start: '13:00', end: '14:00' }]).map((s) => s.slotStart)).toEqual(['09:00', '11:00', '15:00']);
});
test('books a slot, then rejects a repeat with 409', async () => {
  expect((await request(app).post('/api/appointments').send(body())).status).toBe(201);
  expect((await request(app).post('/api/appointments').send(body({ patientName: 'Other Person' }))).status).toBe(409);
});
test('20 concurrent bookings -> exactly one wins', async () => {
  const r = await Promise.all(Array.from({ length: 20 }, () => request(app).post('/api/appointments').send(body())));
  expect(r.filter((x) => x.status === 201)).toHaveLength(1); expect(r.filter((x) => x.status === 409)).toHaveLength(19);
});
test('same doctor + slot under another service is blocked', async () => {
  await request(app).post('/api/appointments').send(body());
  expect((await request(app).post('/api/appointments').send(body({ serviceId: String(s2._id) }))).status).toBe(409);
});
test('availability shows booked slot', async () => {
  await request(app).post('/api/appointments').send(body());
  const r = await request(app).get('/api/availability').query({ date });
  expect(r.body.grid[s1._id][doc._id].find((s) => s.slotStart === '09:00').status).toBe('booked');
});
test('rejects NoSQL injection, XSS name, bad slot, past date', async () => {
  for (const b of [body({ patientName: { $gt: '' } }), body({ patientName: '<script>alert(1)</script>' }), body({ slotStart: '13:00' }), body({ date: '2020-01-01' })])
    expect((await request(app).post('/api/appointments').send(b)).status).toBe(400);
});
test('admin routes are accessible without sign in; login rejects injection', async () => {
  expect((await request(app).get('/api/admin/appointments')).status).toBe(200);
  expect((await request(app).post('/api/auth/login').send({ email: { $gt: '' }, password: 'x' })).status).toBe(400);
});
test('suggestions rank by time and tolerate regex input', async () => {
  const r = await request(app).get('/api/suggestions').query({ service: 'consult', time: '11:30', date });
  expect(r.body.data[0].slots[0].slotStart).toBe('11:00'); expect(r.body.data[0].exact).toBe(true);
  expect((await request(app).get('/api/suggestions').query({ service: '.*(' })).status).toBe(200);
});
