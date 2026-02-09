// // import dbConnect from '../../../../lib/database';
// // import WorkSession from '../../../../models/WorkSession';
// // import jwt from 'jsonwebtoken';
// // import { Types } from 'mongoose';

// // export default async function handler(req, res) {
// //   if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

// //   try {
// //     const token = req.headers.authorization?.split(' ')[1];
// //     if (!token) return res.status(401).json({ success: false, message: 'No token' });

// //     const decoded = jwt.verify(token, process.env.JWT_SECRET);
// //     if (decoded.role !== 'doctor' && decoded.role !== 'doctorStaff') {
// //       return res.status(403).json({ success: false, message: 'Doctor access only' });
// //     }

// //     const doctorId = new Types.ObjectId(decoded.userId || decoded.id);

// //     const { duration } = req.body;
// //     if (!duration || duration < 1) return res.status(400).json({ success: false, message: 'Invalid duration' });

// //     await dbConnect();

// //     const today = new Date();
// //     today.setHours(0, 0, 0, 0);
// //     const endOfDay = new Date(today);
// //     endOfDay.setHours(23, 59, 59, 999);

// //     const session = await WorkSession.findOne({
// //       doctorId,
// //       date: { $gte: today, $lte: endOfDay },
// //     });

// //     if (!session) {
// //       console.warn('No doctor session found for desktime update', { doctorId: doctorId.toString() });
// //       return res.status(404).json({ success: false, message: 'No active session found' });
// //     }

// //     session.deskTimeSeconds += Number(duration);
// //     session.lastActivity = new Date();
// //     session.activityLogs.push({
// //       timestamp: new Date(),
// //       isActive: true,
// //       duration: Number(duration),
// //       activityType: 'desktime'
// //     });

// //     session.calculateProductivity();
// //     await session.save();

// //     console.log('Doctor desktime updated:', {
// //       doctorId: doctorId.toString(),
// //       added: duration,
// //       totalDesk: session.deskTimeSeconds
// //     });

// //     res.status(200).json({ success: true, updatedDesk: session.deskTimeSeconds });
// //   } catch (error) {
// //     console.error('Desktime error:', error);
// //     res.status(500).json({ success: false, message: 'Failed to update desktime', error: error.message });
// //   }
// // }

// // pages/api/doctor/work-session/desktime.js
// import dbConnect from '../../../../lib/database';
// import WorkSession from '../../../../models/WorkSession';
// import jwt from 'jsonwebtoken';
// import mongoose from 'mongoose';

// // Helper function to verify clinic/admin token
// const verifyClinicToken = (token) => {
//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     return (decoded.role === 'clinic' || decoded.role === 'admin') ? decoded : null;
//   } catch (error) {
//     return null;
//   }
// };

// export default async function handler(req, res) {
//   if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

//   try {
//     const token = req.headers.authorization?.split(' ')[1];
//     if (!token) return res.status(401).json({ success: false, message: 'No token' });

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
//     let doctorId;
//     let isClinicAccess = false;
    
//     // Check if clinic/admin is reporting desktime for a doctor
//     const { userId } = req.body;
    
//     if (userId && (decoded.role === 'clinic' || decoded.role === 'admin')) {
//       // Clinic/admin reporting desktime for a doctor
//       doctorId = new mongoose.Types.ObjectId(userId);
//       isClinicAccess = true;
//     } else {
//       // Doctor reporting their own desktime
//       if (!['doctor', 'doctorStaff'].includes(decoded.role)) {
//         return res.status(403).json({ success: false, message: 'Doctor access only' });
//       }
//       doctorId = new mongoose.Types.ObjectId(decoded.userId || decoded.id);
//     }

//     const { duration } = req.body;
//     if (!duration || duration < 1) return res.status(400).json({ success: false, message: 'Invalid duration' });

//     await dbConnect();

//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
//     const endOfDay = new Date(today);
//     endOfDay.setHours(23, 59, 59, 999);

//     const session = await WorkSession.findOne({
//       $or: [
//         { doctorId: doctorId },
//         { userId: doctorId }
//       ],
//       date: { $gte: today, $lte: endOfDay },
//     });

//     if (!session) {
//       console.warn('No doctor session found for desktime update', { 
//         doctorId: doctorId.toString(),
//         isClinicAccess 
//       });
//       return res.status(404).json({ success: false, message: 'No active session found' });
//     }

//     session.deskTimeSeconds += Number(duration);
//     session.lastActivity = new Date();
//     session.activityLogs.push({
//       timestamp: new Date(),
//       isActive: true,
//       duration: Number(duration),
//       activityType: 'desktime'
//     });

//     // Calculate productivity if method exists
//     if (typeof session.calculateProductivity === 'function') {
//       session.calculateProductivity();
//     } else if (session.deskTimeSeconds > 0) {
//       session.productivityPercentage = Math.round((session.productiveSeconds / session.deskTimeSeconds) * 100);
//     }

//     await session.save();

//     console.log('Doctor desktime updated:', {
//       doctorId: doctorId.toString(),
//       isClinicAccess,
//       added: duration,
//       totalDesk: session.deskTimeSeconds
//     });

//     res.status(200).json({ success: true, updatedDesk: session.deskTimeSeconds });
//   } catch (error) {
//     console.error('Desktime error:', error);
//     res.status(500).json({ success: false, message: 'Failed to update desktime', error: error.message });
//   }
// }
// pages/api/doctor/work-session/desktime.js
import dbConnect from '../../../../lib/database';
import WorkSession from '../../../../models/WorkSession';
import withDoctorApiAuth from '../../../../middleware/withDoctorApiAuth';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    await dbConnect();

    const { userId, duration } = req.body;
    
    if (!duration || duration < 1) {
      return res.status(400).json({ success: false, message: 'Invalid duration' });
    }

    let doctorId;

    if (userId && (req.user.role === 'clinic' || req.user.role === 'admin' || req.user.role === 'agent')) {
      // Clinic/admin/agent reporting for a doctor
      doctorId = userId;
    } else {
      // Doctor reporting their own desktime
      if (!['doctor', 'doctorStaff'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Doctor access only' });
      }
      doctorId = req.user.userId || req.user.id || req.user.doctorId;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    let session = await WorkSession.findOne({
      $or: [
        { doctorId },
        { userId: doctorId }
      ],
      role: { $in: ['doctor', 'doctorStaff'] },
      date: { $gte: today, $lte: endOfDay },
    });

    if (!session) {
      // Create session if it doesn't exist
      session = await WorkSession.create({
        doctorId,
        userId: doctorId,
        role: 'doctorStaff',
        date: today,
        arrivalTime: new Date(),
        deskTimeSeconds: duration,
        productiveSeconds: 0,
        productivityPercentage: 0,
        lastActivity: new Date(),
        activityLogs: [{
          timestamp: new Date(),
          isActive: true,
          duration,
          activityType: 'desktime'
        }],
      });
    } else {
      // Update existing session
      session.deskTimeSeconds = (session.deskTimeSeconds || 0) + duration;
      session.lastActivity = new Date();
      
      session.activityLogs.push({
        timestamp: new Date(),
        isActive: true,
        duration,
        activityType: 'desktime'
      });

      // Recalculate productivity
      if (session.deskTimeSeconds > 0) {
        session.productivityPercentage = Math.min(100, 
          Math.round((session.productiveSeconds / session.deskTimeSeconds) * 100)
        );
      }
    }

    await session.save();

    return res.json({
      success: true,
      message: 'Doctor DeskTime recorded',
      deskTimeSeconds: session.deskTimeSeconds,
      productivityPercentage: session.productivityPercentage,
    });
  } catch (error) {
    console.error('DOCTOR DESK TIME ERROR:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
}

export default withDoctorApiAuth(handler);