const mongoose = require('mongoose');
const { Schema } = mongoose; const OID = Schema.Types.ObjectId;
const Service = mongoose.model('Service', new Schema({ name: { type: String, required: true, unique: true, trim: true }, description: String, isActive: { type: Boolean, default: true } }));
const Doctor = mongoose.model('Doctor', new Schema({
  name: { type: String, required: true, trim: true }, specialization: String,
  services: [{ type: OID, ref: 'Service' }],
  workingHours: { start: { type: String, default: '09:00' }, end: { type: String, default: '17:00' } },
  breaks: [{ start: String, end: String, _id: false }], isActive: { type: Boolean, default: true },
}));
const apptSchema = new Schema({
  doctor: { type: OID, ref: 'Doctor', required: true }, service: { type: OID, ref: 'Service', required: true },
  patientName: { type: String, required: true }, patientPhone: { type: String, required: true },
  date: { type: String, required: true }, slotStart: { type: String, required: true }, slotEnd: { type: String, required: true },
  status: { type: String, enum: ['booked', 'cancelled'], default: 'booked' },
}, { timestamps: true });
// DB-level double-booking guard: one active booking per doctor+date+slot (across ALL services).
apptSchema.index({ doctor: 1, date: 1, slotStart: 1 }, { unique: true, partialFilterExpression: { status: 'booked' } });
apptSchema.index({ date: 1 });
const Appointment = mongoose.model('Appointment', apptSchema);
const Admin = mongoose.model('Admin', new Schema({ email: { type: String, required: true, unique: true, lowercase: true }, passwordHash: { type: String, required: true } }, { timestamps: true }));
module.exports = { Service, Doctor, Appointment, Admin };
