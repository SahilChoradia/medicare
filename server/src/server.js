require('dotenv').config();
const mongoose = require('mongoose');
const { createApp } = require('./app');
const { Appointment, Doctor, Service, Admin } = require('./models');
const { seedData } = require('./seed');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be set (32+ chars)');
  process.exit(1);
}

async function startServer() {
  const port = process.env.PORT || 5000;
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
  const targetDbName = process.env.DB_NAME || 'mpc';

  try {
    // Connect to MongoDB Atlas (or local) explicitly targeting the specified database name (e.g. 'mpc')
    await mongoose.connect(mongoUri, {
      dbName: targetDbName,
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`\n======================================================`);
    console.log(`  Connected to MongoDB:`);
    console.log(`  Target Database: "${mongoose.connection.name || targetDbName}"`);
    console.log(`======================================================`);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`\n[Notice] Could not connect to remote/local MongoDB (${mongoUri}): ${err.message}`);
      console.log(`Starting in-memory MongoDB fallback with database "${targetDbName}"...`);
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create({
          instance: { dbName: targetDbName }
        });
        const memUri = mongod.getUri();
        await mongoose.connect(memUri, { dbName: targetDbName });
        console.log(`Connected to in-memory MongoDB database "${mongoose.connection.name}" at ${memUri}`);
      } catch (memErr) {
        console.error('Failed to start in-memory MongoDB:', memErr.message);
        process.exit(1);
      }
    } else {
      console.error(`DB connection failed to database "${targetDbName}":`, err.message);
      process.exit(1);
    }
  }

  // Ensure all collections and unique partial indexes are initialized in database 'mpc'
  await Promise.all([
    Appointment.init(),
    Doctor.init(),
    Service.init(),
    Admin.init()
  ]);

  // If database is empty, automatically seed initial doctors, services, and admin account
  const doctorCount = await Doctor.countDocuments();
  if (doctorCount === 0) {
    console.log(`Database "${targetDbName}" has no doctors. Auto-seeding initial collections (services, doctors, admins)...`);
    await seedData();
    console.log(`Collections initialized and populated successfully in database "${targetDbName}".`);
  } else {
    console.log(`Database "${targetDbName}" active. Found ${doctorCount} registered doctor(s).`);
  }

  const app = createApp();
  app.listen(port, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`  Clinic Booking API Server running on port ${port}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  Database:    ${mongoose.connection.name || targetDbName}`);
    console.log(`  API Status:  http://localhost:${port}/api/services`);
    console.log(`======================================================\n`);
  });
}

startServer().catch((e) => {
  console.error('Fatal startup error:', e);
  process.exit(1);
});
