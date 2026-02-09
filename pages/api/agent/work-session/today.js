// // pages/api/agent/work-session/today.js
// import dbConnect from '../../../../lib/database';
// import WorkSession from '../../../../models/WorkSession';
// import jwt from 'jsonwebtoken';

// const LONG_INACTIVITY_MS = 300 * 60 * 1000; // 300(5 hours) minutes


// export default async function handler(req, res) {
//   if (req.method !== 'GET') {
//     return res.status(405).json({ success: false, message: 'Method not allowed' });
//   }

//   try {
//     const auth = req.headers.authorization;

//     if (!auth || !auth.startsWith('Bearer ')) {
//       return res.status(401).json({
//         success: false,
//         message: 'No authorization token provided',
//       });
//     }

//     const token = auth.split(' ')[1];
//     let decoded;

//     try {
//       decoded = jwt.verify(token, process.env.JWT_SECRET);
//     } catch (err) {
//       return res.status(401).json({
//         success: false,
//         message: 'Invalid token',
//       });
//     }

//     const agentId =
//       decoded.id || decoded.userId || decoded.agentId || decoded._id;

//     if (!agentId) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid token structure',
//       });
//     }

//     await dbConnect();

//     const start = new Date();
//     start.setHours(0, 0, 0, 0);

//     const end = new Date();
//     end.setHours(23, 59, 59, 999);

//     let session = await WorkSession.findOne({
//       agentId,
//       date: { $gte: start, $lte: end },
//     });

//     if (!session) {
//       return res.json({
//         success: true,
//         data: null,
//         message: 'No session found for today',
//       });
//     }

//     const now = new Date();

//     // AUTO SET LEFT TIME ON LONG INACTIVITY
//     if (
//       !session.leftTime &&
//       session.lastActivity &&
//       now - session.lastActivity >= LONG_INACTIVITY_MS
//     ) {
//       session.leftTime = session.lastActivity;
//       session.status = 'OFFLINE';
//       await session.save();
//     }

//     // Calculate timeAtWorkSeconds
//     const timeAtWorkSeconds = session.leftTime 
//       ? Math.floor((session.leftTime - session.arrivalTime) / 1000)
//       : Math.floor((now - session.arrivalTime) / 1000);
//     return res.json({
//       success: true,
//       data: {
//         arrivalTime: session.arrivalTime,
//         leftTime: session.leftTime || null,
//         deskTimeSeconds: session.deskTimeSeconds || 0,
//         productiveSeconds: session.productiveSeconds || 0,
//         timeAtWorkSeconds,
//         productivityPercentage: session.productivityPercentage || 0,
//         lastActivity: session.lastActivity,
//         status: session.status || (session.leftTime ? 'OFFLINE' : 'ONLINE'),
//       },
//     });

//   } catch (err) {
//     console.error('TODAY SESSION ERROR:', err);
//     return res.status(500).json({
//       success: false,
//       message: 'Server error',
//       error: err.message,
//     });
//   }
// }
// pages/api/agent/work-session/today.js
import dbConnect from '../../../../lib/database';
import WorkSession from '../../../../models/WorkSession';
import jwt from 'jsonwebtoken';

const LONG_INACTIVITY_MS = 300 * 60 * 1000; // 300(5 hours) minutes

// Helper function to verify clinic token
const verifyClinicToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Check if the token is for clinic role (or admin)
    return decoded.role === 'clinic' || decoded.role === 'admin' ? decoded : null;
  } catch (error) {
    return null;
  }
};

// Helper function to verify agent token
const verifyAgentToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const auth = req.headers.authorization;
    const { userId } = req.query; // Get userId from query params

    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No authorization token provided',
      });
    }

    const token = auth.split(' ')[1];
    let targetAgentId;
    let decoded;

    // If userId is provided, verify clinic token
    if (userId) {
      decoded = verifyClinicToken(token);
      if (!decoded) {
        return res.status(403).json({
          success: false,
          message: 'Clinic/admin access required to view other users',
        });
      }
      targetAgentId = userId;
    } else {
      // Use the authenticated agent's ID
      decoded = verifyAgentToken(token);
      if (!decoded) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token',
        });
      }
      targetAgentId = decoded.id || decoded.userId || decoded.agentId || decoded._id;
    }

    if (!targetAgentId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token structure or userId parameter',
      });
    }

    await dbConnect();

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    let session = await WorkSession.findOne({
      // $or: [
      //   { agentId: targetAgentId, },
      //   { userId: targetAgentId }
      // ],
      // role: 'agent',
      agentId: targetAgentId,
      role: 'agent',

      date: { $gte: start, $lte: end },
    });

    if (!session) {
      return res.json({
        success: true,
        data: null,
        message: 'No session found for today',
      });
    }

    const now = new Date();

    // AUTO SET LEFT TIME ON LONG INACTIVITY
    if (
      !session.leftTime &&
      session.lastActivity &&
      now - session.lastActivity >= LONG_INACTIVITY_MS
    ) {
      session.leftTime = session.lastActivity;
      session.status = 'OFFLINE';
      await session.save();
    }

    // Find next arrival after break
    let nextArrivalTime = null;
    if (session.leftTime) {
      const nextSession = await WorkSession.findOne({
        // $or: [
        //   { agentId: targetAgentId, },
        //   { userId: targetAgentId }
        // ],
        agnetId: targetAgentId,
        role: 'agent',
        date: {
          $gt: session.date
        },
        arrivalTime: { $exists: true }
      }).sort({ date: 1, arrivalTime: 1 });

      if (nextSession && nextSession.arrivalTime) {
        nextArrivalTime = nextSession.arrivalTime;
      }
    }

    // Calculate timeAtWorkSeconds
    const timeAtWorkSeconds = session.leftTime
      ? Math.floor((session.leftTime - session.arrivalTime) / 1000)
      : Math.floor((now - session.arrivalTime) / 1000);

    return res.json({
      success: true,
      data: {
        arrivalTime: session.arrivalTime,
        leftTime: session.leftTime || null,
        deskTimeSeconds: session.deskTimeSeconds || 0,
        productiveSeconds: session.productiveSeconds || 0,
        timeAtWorkSeconds,
        productivityPercentage: session.productivityPercentage || 0,
        lastActivity: session.lastActivity,
        status: session.status || (session.leftTime ? 'OFFLINE' : 'ONLINE'),
        nextArrivalTime, // Add this for break detection
      },
    });

  } catch (err) {
    console.error('TODAY SESSION ERROR:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: err.message,
    });
  }
}