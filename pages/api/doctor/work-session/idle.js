// // pages/api/doctor/work-session/idle.js
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
    
//     // Check if clinic/admin is reporting idle time for a doctor
//     const { userId } = req.body;
    
//     if (userId && (decoded.role === 'clinic' || decoded.role === 'admin')) {
//       // Clinic/admin reporting idle time for a doctor
//       doctorId = new mongoose.Types.ObjectId(userId);
//       isClinicAccess = true;
//     } else {
//       // Doctor reporting their own idle time
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
//       console.warn('No doctor session found for idle update', { 
//         doctorId: doctorId.toString(),
//         isClinicAccess 
//       });
//       return res.status(404).json({ success: false, message: 'No active session found' });
//     }

//     session.lastActivity = new Date();
//     session.activityLogs.push({
//       timestamp: new Date(),
//       isActive: false,
//       duration: Number(duration),
//       activityType: 'idle'
//     });

//     await session.save();

//     console.log('Doctor idle time updated:', {
//       doctorId: doctorId.toString(),
//       isClinicAccess,
//       added: duration
//     });

//     res.status(200).json({ success: true, message: 'Idle time recorded' });
//   } catch (error) {
//     console.error('Idle time error:', error);
//     res.status(500).json({ success: false, message: 'Failed to update idle time', error: error.message });
//   }
// }
// pages/api/doctor/work-session/idle.js
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
      // Doctor reporting their own idle time
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
      return res.status(404).json({ 
        success: false, 
        message: 'No active session found for today' 
      });
    }

    // Add idle time to activity logs
    session.activityLogs.push({
      timestamp: new Date(),
      isActive: false,
      duration,
      activityType: 'idle'
    });

    // Update last activity
    session.lastActivity = new Date();
    
    await session.save();

    return res.status(200).json({
      success: true,
      message: 'Doctor idle time recorded',
      idleDuration: duration,
      sessionId: session._id
    });
  } catch (error) {
    console.error('DOCTOR IDLE ERROR:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
}

export default withDoctorApiAuth(handler);