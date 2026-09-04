import dbConnect from '../lib/database.js';
import Appointment from '../models/Appointment.js';
import User from '../models/Users.js';
import mongoose from 'mongoose';

async function main() {
  await dbConnect();

  const clinicId = "695611e64beeeb4df4ef0699";
  const date = "2026-08-28";

  const queryStartDate = new Date(`${date}T00:00:00.000Z`);
  const queryEndDate = new Date(`${date}T23:59:59.999Z`);

  const appointments = await Appointment.find({
    clinicId,
    startDate: { $gte: queryStartDate, $lte: queryEndDate }
  }).populate("doctorId", "name").lean();

  const doctors = ['Sonita', 'Mariya', 'Nodainne', 'Syam', 'Rekha', 'Dr Ifada', 'Dr Jeena', 'Dr.Shruti Jalan', 'Dr. Aparna'];
  
  doctors.forEach(name => {
    const docApts = appointments.filter(apt => {
      const aptName = apt.doctorId?.name || '';
      return aptName.toLowerCase().includes(name.toLowerCase());
    });
    
    console.log(`\n=== Doctor: ${name} (Total: ${docApts.length}) ===`);
    const statusCounts = {};
    docApts.forEach(apt => {
      statusCounts[apt.status] = (statusCounts[apt.status] || 0) + 1;
    });
    console.log("Status breakdown:", statusCounts);
  });

  mongoose.connection.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
