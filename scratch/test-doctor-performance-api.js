import dbConnect from '../lib/database.js';
import Appointment from '../models/Appointment.js';
import User from '../models/Users.js';
import mongoose from 'mongoose';

async function main() {
  await dbConnect();

  const clinicId = "695611e64beeeb4df4ef0699";
  const date = "2026-08-27"; // Test 27th (shifted by timezone conversion)
  const filter = "today";

  const queryStartDate = new Date(`${date}T00:00:00.000Z`);
  const queryEndDate = new Date(`${date}T23:59:59.999Z`);

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
    doctorMap[key] = { name: doc.name, email: doc.email };
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
        appointmentCount: 0
      };
    }
    
    doctorAppointmentMap[doctorKey].appointmentCount += 1;
  });

  const appointmentsPerDoctor = Object.values(doctorAppointmentMap)
      .sort((a, b) => b.appointmentCount - a.appointmentCount);

  console.log("appointmentsPerDoctor result for 2026-08-27:", appointmentsPerDoctor);

  mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
