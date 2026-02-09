// // pages/api/doctor/work-session/arrival.js
// import dbConnect from '../../../../lib/database';
// import WorkSession from '../../../../models/WorkSession';
// import jwt from 'jsonwebtoken';

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
//   if (req.method !== 'POST') {
//     return res.status(405).json({ success: false, message: 'Method not allowed' });
//   }

//   try {
//     await dbConnect();

//     const auth = req.headers.authorization;
//     if (!auth || !auth.startsWith('Bearer ')) {
//       return res.status(401).json({ success: false, message: 'No token' });
//     }

//     const token = auth.split(' ')[1];
//     let decoded;
    
//     try {
//       decoded = jwt.verify(token, process.env.JWT_SECRET);
//     } catch (jwtError) {
//       console.error('Token verification error:', jwtError);
//       return res.status(401).json({ success: false, message: 'Invalid token' });
//     }

//     let doctorId;
//     let role;
    
//     // Check if this is a clinic/admin marking arrival for another user
//     const { userId } = req.body; // Get userId from request body
    
//     if (userId && (decoded.role === 'clinic' || decoded.role === 'admin')) {
//       // Clinic/admin is marking arrival for a doctor
//       doctorId = userId;
//       role = 'doctor'; // Default role for the session
//       console.log('Clinic/admin marking arrival for doctor:', doctorId);
//     } else {
//       // Doctor marking their own arrival
//       if (!['doctor', 'doctorStaff'].includes(decoded.role)) {
//         return res.status(403).json({ 
//           success: false, 
//           message: 'Doctor access only',
//           role: decoded.role
//         });
//       }
      
//       doctorId = decoded?.userId || decoded?.id || decoded?.doctorId;
//       role = decoded.role;
      
//       if (!doctorId) {
//         return res.status(400).json({ 
//           success: false, 
//           message: 'Invalid token structure',
//           decoded: decoded
//         });
//       }
//     }

//     const start = new Date();
//     start.setHours(0, 0, 0, 0);

//     const end = new Date();
//     end.setHours(23, 59, 59, 999);

//     // Check for existing session with doctorId
//     let session = await WorkSession.findOne({
//       $or: [
//         { doctorId: doctorId },
//         { userId: doctorId }
//       ],
//       date: { $gte: start, $lte: end },
//     });

//     if (!session) {
//       session = await WorkSession.create({
//         doctorId: doctorId,
//         userId: doctorId,
//         role: role,
//         date: start,
//         arrivalTime: new Date(),
//         deskTimeSeconds: 0,
//         productiveSeconds: 0,
//         productivityPercentage: 0,
//         activityLogs: [],
//       });
//       console.log('Created arrival session for doctor:', doctorId);
//     } else if (!session.arrivalTime) {
//       session.arrivalTime = new Date();
//       await session.save();
//     }

//     return res.json({
//       success: true,
//       arrivalTime: session.arrivalTime,
//       sessionId: session._id,
//       doctorId: doctorId,
//     });
//   } catch (err) {
//     console.error('DOCTOR ARRIVAL ERROR:', err);
//     return res.status(500).json({ 
//       success: false,
//       message: 'Server error',
//       error: err.message 
//     });
//   }
// }

// pages/api/doctor/work-session/arrival.js
import dbConnect from '../../../../lib/database';
import WorkSession from '../../../../models/WorkSession';
import withDoctorApiAuth from '../../../../middleware/withDoctorApiAuth';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    await dbConnect();

    const { userId } = req.body; // Optional: for clinic/admin marking arrival for doctor
    let doctorId;
    let role;

    if (userId && (req.user.role === 'clinic' || req.user.role === 'admin' || req.user.role === 'agent')) {
      // Clinic/admin/agent is marking arrival for a doctor
      doctorId = userId;
      role = 'doctor';
    } else {
      // Doctor marking their own arrival
      if (!['doctor', 'doctorStaff'].includes(req.user.role)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Doctor access only',
          role: req.user.role
        });
      }
      
      doctorId = req.user.userId || req.user.id || req.user.doctorId;
      role = req.user.role;
      
      if (!doctorId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid user ID in token'
        });
      }
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    // Check for existing session
    let session = await WorkSession.findOne({
      $or: [
        { doctorId },
        { userId: doctorId }
      ],
      role: { $in: ['doctor', 'doctorStaff'] },
      date: { $gte: start, $lte: end },
    });

    if (!session) {
      session = await WorkSession.create({
        doctorId,
        userId: doctorId,
        role: role,
        date: start,
        arrivalTime: new Date(),
        deskTimeSeconds: 0,
        productiveSeconds: 0,
        productivityPercentage: 0,
        activityLogs: [],
      });
    } else if (!session.arrivalTime) {
      session.arrivalTime = new Date();
      await session.save();
    }

    return res.json({
      success: true,
      arrivalTime: session.arrivalTime,
      sessionId: session._id,
      doctorId: doctorId,
    });
  } catch (err) {
    console.error('DOCTOR ARRIVAL ERROR:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: err.message 
    });
  }
}

export default withDoctorApiAuth(handler);