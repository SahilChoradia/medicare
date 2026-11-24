const bcrypt = require('bcryptjs');
const { Service, Doctor, Admin, Appointment } = require('./models');

async function seedData() {
  await Promise.all([
    Service.deleteMany(),
    Doctor.deleteMany(),
    Admin.deleteMany(),
    Appointment.deleteMany()
  ]);

  const [gen, dent, xr, derm] = await Service.insertMany([
    'General Consultation',
    'Dental Checkup',
    'X-Ray',
    'Skin Consultation'
  ].map((name) => ({ name })));

  const brk = [{ start: '13:00', end: '14:00' }];
  await Doctor.insertMany([
    {
      name: 'Dr. Meera Iyer',
      specialization: 'General Physician',
      services: [gen, xr],
      breaks: brk,
      workingHours: { start: '09:00', end: '17:00' }
    },
    {
      name: 'Dr. Rohan Shah',
      specialization: 'Dentist',
      services: [dent],
      workingHours: { start: '10:00', end: '18:00' },
      breaks: brk
    },
    {
      name: 'Dr. Anita Desai',
      specialization: 'Dermatologist',
      services: [derm, gen],
      breaks: brk,
      workingHours: { start: '09:00', end: '17:00' }
    },
  ]);

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@clinic.local';
  const adminPass = process.env.ADMIN_PASSWORD || 'Admin@12345';
  await Admin.create({
    email: adminEmail,
    passwordHash: await bcrypt.hash(adminPass, 12)
  });

  console.log('[Seed] Database collections seeded. Admin account:', adminEmail);
}

if (require.main === module) {
  require('dotenv').config();
  const mongoose = require('mongoose');
  const targetDbName = process.env.DB_NAME || 'mpc';
  mongoose.connect(process.env.MONGO_URI, { dbName: targetDbName }).then(async () => {
    await seedData();
    console.log(`Seed completed successfully in database "${targetDbName}".`);
    process.exit(0);
  }).catch((e) => {
    console.error(`Seed DB connection failed for database "${targetDbName}":`, e.message);
    process.exit(1);
  });
}

module.exports = { seedData };
