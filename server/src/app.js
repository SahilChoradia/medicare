const express = require('express'); const helmet = require('helmet'); const cors = require('cors');
const rateLimit = require('express-rate-limit'); const sanitize = require('express-mongo-sanitize'); const hpp = require('hpp');
const cookieParser = require('cookie-parser'); const bcrypt = require('bcryptjs'); const jwt = require('jsonwebtoken');
const morgan = require('morgan'); const { z } = require('zod');
const { Doctor, Service, Appointment, Admin } = require('./models');
const { generateSlots, nowIST, addDays, toMin } = require('./slots');

class HttpError extends Error { constructor(status, message, errors) { super(message); this.status = status; this.errors = errors; } }
const w = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const parse = (schema, data) => {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, 'Validation failed', r.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  return r.data;
};
const dateS = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeS = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).transform((t) => t.slice(0, 5));
const oid = z.string().regex(/^[a-f\d]{24}$/i);
const bookS = z.object({
  doctorId: oid, serviceId: oid, date: dateS, slotStart: timeS,
  patientName: z.string().trim().regex(/^[\p{L} .'-]{2,60}$/u, 'Name must be 2-60 letters'),
  patientPhone: z.string().trim().regex(/^\+?[0-9]{10,13}$/, 'Enter a valid phone number'),
}).strict();
const assertDate = (date) => {
  const t = nowIST().date;
  if (isNaN(new Date(date)) || date < t || date > addDays(t, 30)) throw new HttpError(400, 'Date must be within the next 30 days');
};

async function dayData(date) {
  const [doctors, appts] = await Promise.all([
    Doctor.find({ isActive: true }).populate('services').lean(),
    Appointment.find({ date, status: 'booked' }).lean(),
  ]);
  const booked = new Set(appts.map((a) => `${a.doctor}|${a.slotStart}`)); const now = nowIST();
  const slotsOf = (d) => generateSlots(d.workingHours, d.breaks).map((s) => ({
    ...s, status: booked.has(`${d._id}|${s.slotStart}`) ? 'booked' : (date === now.date && s.slotStart <= now.time) ? 'past' : 'available',
  }));
  return { doctors, slotsOf };
}

function createApp() {
  const app = express();
  const prod = process.env.NODE_ENV === 'production';
  const test = process.env.NODE_ENV === 'test';

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // Fully permissive CORS: dynamically reflects the request origin and supports credentials
  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
    })
  );
  app.options('*', cors());
  if (!test) app.use(morgan('tiny')); // no request bodies logged -> no patient PII in logs
  app.use(express.json({ limit: '10kb' })); app.use(cookieParser()); app.use(sanitize()); app.use(hpp());
  const lim = (max, windowMs = 15 * 60 * 1000) => rateLimit({ windowMs, max: test ? 100000 : max, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many requests, try again later' } });
  app.use('/api', lim(300));

  app.get('/api/services', w(async (req, res) => {
    const { q } = parse(z.object({ q: z.string().trim().max(60).optional() }), req.query);
    const f = { isActive: true }; if (q) f.name = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    res.json({ success: true, data: await Service.find(f).sort('name').lean() });
  }));
  app.get('/api/doctors', w(async (req, res) => res.json({ success: true, data: await Doctor.find({ isActive: true }).populate('services', 'name').lean() })));

  app.get('/api/availability', w(async (req, res) => {
    const { date } = parse(z.object({ date: dateS }), req.query); assertDate(date);
    const { doctors, slotsOf } = await dayData(date);
    const services = new Map(); const grid = {};
    for (const d of doctors) { const slots = slotsOf(d);
      for (const s of d.services.filter((x) => x.isActive)) { services.set(String(s._id), { _id: s._id, name: s.name }); (grid[s._id] ||= {})[d._id] = slots; } }
    res.json({
      success: true,
      date,
      doctors: doctors.map((d) => ({
        _id: d._id,
        name: d.name,
        specialization: d.specialization,
        workingHours: d.workingHours,
        breaks: d.breaks,
        services: (d.services || []).filter((x) => x.isActive).map((s) => ({ _id: s._id, name: s.name }))
      })),
      services: [...services.values()],
      grid
    });
  }));

  app.get('/api/suggestions', w(async (req, res) => {
    const q = parse(z.object({ service: z.string().trim().min(2).max(60), time: timeS.optional(), date: dateS.optional() }), req.query);
    const date = q.date || nowIST().date; assertDate(date);
    const rx = new RegExp(q.service.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const ids = (await Service.find({ name: rx, isActive: true }).lean()).map((s) => String(s._id));
    const { doctors, slotsOf } = await dayData(date); const t = q.time ? toMin(q.time) : null; const out = [];
    const dist = (s) => t === null ? 0 : t < toMin(s.slotStart) ? toMin(s.slotStart) - t : t >= toMin(s.slotEnd) ? t - toMin(s.slotEnd) + 1 : 0;
    for (const d of doctors) {
      for (const s of d.services.filter((x) => x.isActive && ids.includes(String(x._id)))) {
        const free = slotsOf(d).filter((x) => x.status === 'available').map((sl) => {
          const dMin = t !== null ? dist(sl) : 0;
          return {
            ...sl,
            distanceMinutes: dMin,
            isExactMatch: dMin === 0,
            coversTime: t !== null ? (toMin(sl.slotStart) <= t && t < toMin(sl.slotEnd)) : false
          };
        }).sort((a, b) => a.distanceMinutes - b.distanceMinutes || a.slotStart.localeCompare(b.slotStart));

        if (free.length) {
          out.push({
            doctor: { _id: d._id, name: d.name, specialization: d.specialization },
            service: { _id: s._id, name: s.name },
            slots: free,
            exact: t !== null && free[0].isExactMatch,
            score: free[0].distanceMinutes,
            requestedTime: q.time || null
          });
        }
      }
    }
    out.sort((a, b) => a.score - b.score || a.slots[0].slotStart.localeCompare(b.slots[0].slotStart));
    res.json({ success: true, date, requestedTime: q.time || null, data: out.slice(0, 10) });
  }));

  app.post('/api/appointments', lim(20), w(async (req, res) => {
    const b = parse(bookS, req.body); assertDate(b.date);
    const doctor = await Doctor.findOne({ _id: b.doctorId, isActive: true }).lean();
    const svc = await Service.findOne({ _id: b.serviceId, isActive: true }).lean();
    if (!doctor || !svc || !doctor.services.some((id) => id.equals(b.serviceId))) throw new HttpError(400, 'Doctor does not offer this service');
    const slot = generateSlots(doctor.workingHours, doctor.breaks).find((s) => s.slotStart === b.slotStart);
    if (!slot) throw new HttpError(400, 'Invalid time slot');
    const now = nowIST(); if (b.date === now.date && slot.slotStart <= now.time) throw new HttpError(400, 'This slot has already started');
    const a = await Appointment.create({ doctor: b.doctorId, service: b.serviceId, patientName: b.patientName, patientPhone: b.patientPhone, date: b.date, slotStart: slot.slotStart, slotEnd: slot.slotEnd });
    res.status(201).json({ success: true, data: { id: a._id, doctor: doctor.name, service: svc.name, date: a.date, slotStart: a.slotStart, slotEnd: a.slotEnd, patientName: a.patientName } });
  }));

  // ---- Auth ----
  const DUMMY = bcrypt.hashSync('dummy-password', 12);
  app.post('/api/auth/login', lim(10), w(async (req, res) => {
    const { email, password } = parse(z.object({ email: z.string().email().max(100), password: z.string().min(1).max(100) }).strict(), req.body);
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    const ok = await bcrypt.compare(password, admin ? admin.passwordHash : DUMMY);
    if (!admin || !ok) throw new HttpError(401, 'Invalid email or password');
    const token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '2h' });
    const cookieOptions = {
      httpOnly: true,
      secure: prod,
      sameSite: prod ? 'none' : 'lax',
      maxAge: 2 * 3600 * 1000
    };
    res.cookie('token', token, cookieOptions);
    // Return token in JSON response so cross-domain clients (Vercel -> Render) can use Bearer auth
    res.json({ success: true, email: admin.email, token });
  }));
  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token', {
      httpOnly: true,
      secure: prod,
      sameSite: prod ? 'none' : 'lax'
    });
    res.json({ success: true });
  });
  // Staff sign in removed: routes are open for appointments management
  const requireAdmin = (req, res, next) => next();
  app.get('/api/auth/me', (req, res) => res.json({ success: true, authed: true }));

  app.get('/api/admin/appointments', requireAdmin, w(async (req, res) => {
    const q = parse(z.object({ date: dateS.optional(), doctor: oid.optional(), service: oid.optional(),
      page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(10), sort: z.enum(['asc', 'desc']).default('asc') }), req.query);
    const f = {}; if (q.date) f.date = q.date; if (q.doctor) f.doctor = q.doctor; if (q.service) f.service = q.service;
    const dir = q.sort === 'asc' ? 1 : -1;
    const [data, total] = await Promise.all([
      Appointment.find(f).sort({ date: dir, slotStart: dir }).skip((q.page - 1) * q.limit).limit(q.limit).populate('doctor', 'name').populate('service', 'name').lean(),
      Appointment.countDocuments(f)]);
    res.json({ success: true, data, total, page: q.page, pages: Math.ceil(total / q.limit) || 1 });
  }));
  app.patch('/api/admin/appointments/:id/cancel', requireAdmin, w(async (req, res) => {
    const { id } = parse(z.object({ id: oid }), req.params);
    const a = await Appointment.findOneAndUpdate({ _id: id, status: 'booked' }, { status: 'cancelled' }, { new: true });
    if (!a) throw new HttpError(404, 'Booking not found or already cancelled');
    res.json({ success: true });
  }));

  app.use((req, res, next) => next(new HttpError(404, 'Not found')));
  app.use((err, req, res, next) => { // eslint-disable-line
    const status = err.code === 11000 ? 409 : err.status || 500;
    const message = err.code === 11000 ? 'Slot just got booked, please choose another' : status < 500 ? err.message : 'Internal server error';
    if (status >= 500 && !test) console.error(err.message);
    res.status(status).json({ success: false, message, ...(err.errors && { errors: err.errors }) });
  });
  return app;
}
module.exports = { createApp };
