// // // pages/api/doctor/work-session/mouse-activity.js
// // import dbConnect from '../../../../lib/database';
// // import WorkSession from '../../../../models/WorkSession';
// // import jwt from 'jsonwebtoken';
// // import mongoose from 'mongoose';

// // export default async function handler(req, res) {
// //   if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

// //   try {
// //     const token = req.headers.authorization?.split(' ')[1];
// //     if (!token) return res.status(401).json({ success: false, message: 'No token' });

// //     const decoded = jwt.verify(token, process.env.JWT_SECRET);
// //     if (decoded.role !== 'doctor' && decoded.role !== 'doctorStaff') {
// //       return res.status(403).json({ success: false, message: 'Doctor access only' });
// //     }

// //     const doctorId = new mongoose.Types.ObjectId(decoded.userId || decoded.id);  // ← FIX: Convert to ObjectId
// //     const { duration } = req.body;
// //     if (!duration || duration < 1) return res.status(400).json({ success: false, message: 'Invalid duration' });

// //     await dbConnect();

// //     const today = new Date();
// //     today.setHours(0, 0, 0, 0);
// //     const endOfDay = new Date(today);
// //     endOfDay.setHours(23, 59, 59, 999);

// //     const session = await WorkSession.findOne({
// //       doctorId,  // ← Now matches as ObjectId
// //       date: { $gte: today, $lte: endOfDay },
// //     });

// //     if (!session) {
// //       console.warn('No doctor session found for mouse-activity update', { doctorId: doctorId.toString() });
// //       return res.status(404).json({ success: false, message: 'No active session found' });
// //     }

// //     session.productiveSeconds += Number(duration);
// //     session.lastActivity = new Date();
// //     session.activityLogs.push({
// //       timestamp: new Date(),
// //       isActive: true,
// //       duration: Number(duration),
// //       activityType: 'mouse-activity'
// //     });

// //     session.calculateProductivity();
// //     await session.save();

// //     console.log('Doctor mouse-activity updated:', {
// //       doctorId: doctorId.toString(),
// //       added: duration,
// //       totalProductive: session.productiveSeconds
// //     });

// //     res.status(200).json({ success: true, updatedProductive: session.productiveSeconds });
// //   } catch (error) {
// //     console.error('Mouse-activity error:', error);
// //     res.status(500).json({ success: false, message: 'Failed to update activity', error: error.message });
// //   }
// // }
// // pages/api/doctor/work-session/mouse-activity.js
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
    
//     // Check if clinic/admin is reporting activity for a doctor
//     const { userId } = req.body;
    
//     if (userId && (decoded.role === 'clinic' || decoded.role === 'admin')) {
//       // Clinic/admin reporting activity for a doctor
//       doctorId = new mongoose.Types.ObjectId(userId);
//       isClinicAccess = true;
//     } else {
//       // Doctor reporting their own activity
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
//       console.warn('No doctor session found for mouse-activity update', { 
//         doctorId: doctorId.toString(),
//         isClinicAccess 
//       });
//       return res.status(404).json({ success: false, message: 'No active session found' });
//     }

//     session.productiveSeconds += Number(duration);
//     session.lastActivity = new Date();
//     session.activityLogs.push({
//       timestamp: new Date(),
//       isActive: true,
//       duration: Number(duration),
//       activityType: 'mouse-activity'
//     });

//     // Calculate productivity if method exists
//     if (typeof session.calculateProductivity === 'function') {
//       session.calculateProductivity();
//     } else if (session.deskTimeSeconds > 0) {
//       session.productivityPercentage = Math.round((session.productiveSeconds / session.deskTimeSeconds) * 100);
//     }

//     await session.save();

//     console.log('Doctor mouse-activity updated:', {
//       doctorId: doctorId.toString(),
//       isClinicAccess,
//       added: duration,
//       totalProductive: session.productiveSeconds
//     });

//     res.status(200).json({ success: true, updatedProductive: session.productiveSeconds });
//   } catch (error) {
//     console.error('Mouse-activity error:', error);
//     res.status(500).json({ success: false, message: 'Failed to update activity', error: error.message });
//   }
// }
// pages/api/doctor/work-session/mouse-activity.js
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
      // Doctor reporting their own activity
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
        role: 'doctor',
        date: today,
        arrivalTime: new Date(),
        deskTimeSeconds: 0,
        productiveSeconds: duration,
        productivityPercentage: 0,
        lastActivity: new Date(),
        activityLogs: [{
          timestamp: new Date(),
          isActive: true,
          duration,
          activityType: 'mouse-activity'
        }],
      });
    } else {
      // Update existing session
      session.productiveSeconds = (session.productiveSeconds || 0) + duration;
      session.lastActivity = new Date();
      
      session.activityLogs.push({
        timestamp: new Date(),
        isActive: true,
        duration,
        activityType: 'mouse-activity'
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
      message: 'Doctor mouse activity recorded',
      productiveSeconds: session.productiveSeconds,
      productivityPercentage: session.productivityPercentage,
    });
  } catch (error) {
    console.error('DOCTOR MOUSE ACTIVITY ERROR:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
}

export default withDoctorApiAuth(handler);