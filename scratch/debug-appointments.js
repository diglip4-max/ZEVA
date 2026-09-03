import mongoose from 'mongoose';
import dbConnect from '../lib/database.js';
import Appointment from '../models/Appointment.js';
import User from '../models/Users.js';

async function main() {
  await dbConnect();
  
  const clinicId = "695611e64beeeb4df4ef0699";
  const queryStartDate = new Date("2026-08-28T00:00:00.000Z");
  const queryEndDate = new Date("2026-08-28T23:59:59.999Z");
  
  const apptQuery = { clinicId };
  apptQuery.startDate = { $gte: queryStartDate, $lte: queryEndDate };
  const appointments = await Appointment.find(apptQuery).lean();
  
  const staffDocs = await User.find({ 
    clinicId,
    role: 'doctorStaff'
  }).select('_id name email').lean();
  
  const doctorMap = {};
  const staffDoctorIds = new Set();
  staffDocs.forEach(doc => {
    const key = doc._id.toString();
    staffDoctorIds.add(key);
    doctorMap[key] = {
      name: doc.name,
      email: doc.email
    };
  });
  
  const doctorAppointmentMap = {};
  appointments.forEach(apt => {
    if (!apt.doctorId) return;
    const doctorKey = apt.doctorId._id ? apt.doctorId._id.toString() : apt.doctorId.toString();
    if (!staffDoctorIds.has(doctorKey)) return;
    const doctorInfo = doctorMap[doctorKey] || {};
    
    if (!doctorAppointmentMap[doctorKey]) {
      doctorAppointmentMap[doctorKey] = {
        doctorId: doctorKey,
        doctorName: doctorInfo.name || 'Unknown Doctor',
        doctorEmail: doctorInfo.email || '',
        appointmentCount: 0,
        completedAppointments: 0,
        pendingAppointments: 0
      };
    }
    
    doctorAppointmentMap[doctorKey].appointmentCount += 1;
  });
  
  const sonitaId = "6975f5f168694fa783665f5f";
  console.log("Calculated appointmentCount for Sonita:", doctorAppointmentMap[sonitaId]?.appointmentCount);
  console.log("Raw count of appointments fetched:", appointments.length);
  
  mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
