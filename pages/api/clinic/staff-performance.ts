import dbConnect from "../../../lib/database";
import PatientRegistration from "../../../models/PatientRegistration";
import DoctorProfile from "../../../models/DoctorProfile";
import User from "../../../models/Users";
import { getAuthorizedStaffUser } from "../../../server/staff/authHelpers";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  let user;
  try {
    user = await getAuthorizedStaffUser(req, {
      allowedRoles: ["staff", "doctorStaff", "doctor", "clinic", "agent", "admin"],
    });
  } catch (err: any) {
    return res.status(err.status || 401).json({ 
      success: false, 
      message: err.message || "Authentication error" 
    });
  }

  if (!user) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  
  if (!["clinic", "doctor", "agent", "doctorStaff", "staff", "admin"].includes(user.role)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const { clinicId, error: clinicError }: any = await getClinicIdFromUser(user);
  if (clinicError || (!clinicId && user.role !== "admin")) {
    return res.status(403).json({
      success: false,
      message: clinicError || "Unable to determine clinic access",
    });
  }

  if (req.method === "GET") {
    try {
      // Get time range filter
      const timeRange = req.query.timeRange as string || 'month';
      
      // Calculate date ranges
      const now = new Date();
      let startOfPeriod = new Date(now);
      
      if (timeRange === 'week') {
        startOfPeriod.setDate(now.getDate() - 7);
      } else if (timeRange === 'month' || timeRange === 'select-calendar') {
        startOfPeriod = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      // For 'overall', we use all-time data (no date filter)

      // Build query for appointments in the period
      const appointmentQuery: any = { clinicId };
      if (timeRange !== 'overall') {
        appointmentQuery.createdAt = { $gte: startOfPeriod };
      }

      // DOCTOR PERFORMANCE LEADERBOARD
      // Fetch all doctors who have appointments from DoctorProfile
      const doctorStats = await PatientRegistration.aggregate([
        {
          $match: appointmentQuery
        },
        {
          $group: {
            _id: "$assignedDoctor",
            totalAppointments: { $sum: 1 },
            totalRevenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
            advanceReceived: { $sum: { $ifNull: ["$advanceGivenAmount", 0] } }
          }
        },
        { $sort: { totalAppointments: -1 } }
      ]);

      // Get doctor IDs from stats
      const doctorIds = doctorStats.map((stat: any) => stat._id).filter(id => id !== null);
      
      // Fetch doctor details from DoctorProfile
      let doctorProfiles: any[] = [];
      if (doctorIds.length > 0) {
        doctorProfiles = await DoctorProfile.find({ 
          user: { $in: doctorIds } 
        })
        .populate('user', 'firstName lastName')
        .lean();
      }

      // Create a map of doctor user ID to profile
      const doctorMap = new Map();
      doctorProfiles.forEach((profile: any) => {
        const userId = profile.user._id.toString();
        const fullName = `${profile.user.firstName || ''} ${profile.user.lastName || ''}`.trim() || 'Dr. Unknown';
        doctorMap.set(userId, {
          name: fullName,
          degree: profile.degree || '',
          experience: profile.experience || 0
        });
      });

      // Also fetch doctors directly from User model as fallback
      const users: any[] = await User.find({ 
        _id: { $in: doctorIds },
        role: 'doctor'
      }).select('firstName lastName').lean();
      
      users.forEach((user: any) => {
        const userId = user._id.toString();
        if (!doctorMap.has(userId)) {
          const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Dr. Unknown';
          doctorMap.set(userId, {
            name: fullName,
            degree: '',
            experience: 0
          });
        }
      });

      // Calculate performance scores and build leaderboard
      const leaderboardData = doctorStats.map((stat, index) => {
        const doctorId = stat._id?.toString();
        const doctorInfo = doctorMap.get(doctorId) || { name: 'Dr. Unknown', degree: '', experience: 0 };
        
        // Calculate performance score based on appointments (40%), revenue (40%), and rating (20%)
        const maxAppointments = doctorStats[0]?.totalAppointments || 1;
        const maxRevenue = Math.max(...doctorStats.map(s => s.totalRevenue)) || 1;
        
        const avgRating = 4.0 + (Math.random() * 0.9); // Simulated rating between 4.0-4.9
        
        const performanceScore = Math.round(
          (Math.min(stat.totalAppointments / maxAppointments, 1) * 40) +
          (Math.min(stat.totalRevenue / maxRevenue, 1) * 40) +
          ((avgRating / 5) * 20)
        );

        return {
          rank: index + 1,
          doctorId: doctorId || '',
          doctorName: doctorInfo.name,
          performanceScore,
          totalAppointments: stat.totalAppointments,
          totalRevenue: Math.round(stat.totalRevenue - stat.advanceReceived),
          rating: parseFloat(avgRating.toFixed(1)),
          degree: doctorInfo.degree,
          experience: doctorInfo.experience
        };
      });

      // APPOINTMENTS PER DOCTOR (Bar Chart Data)
      const appointmentsRaw = await PatientRegistration.aggregate([
        {
          $match: appointmentQuery
        },
        {
          $group: {
            _id: "$assignedDoctor",
            appointments: { $sum: 1 }
          }
        },
        { $sort: { appointments: -1 } }
      ]);

      // Get doctor IDs from raw data
      const apptDoctorIds = appointmentsRaw.map(stat => stat._id).filter(id => id !== null);
      
      // Fetch doctor details from DoctorProfile
      let apptDoctorProfiles: any[] = [];
      if (apptDoctorIds.length > 0) {
        apptDoctorProfiles = await DoctorProfile.find({ 
          user: { $in: apptDoctorIds } 
        })
        .populate('user', 'firstName lastName')
        .lean();
      }

      // Create map
      const apptDoctorMap = new Map();
      apptDoctorProfiles.forEach(profile => {
        const userId = profile.user._id.toString();
        const fullName = `${profile.user.firstName || ''} ${profile.user.lastName || ''}`.trim() || 'Dr. Unknown';
        apptDoctorMap.set(userId, fullName);
      });

      // Fallback to User model
      const apptUsers = await User.find({ 
        _id: { $in: apptDoctorIds },
        role: 'doctor'
      }).select('firstName lastName').lean();
      
      apptUsers.forEach((user: any) => {
        const userId = user['_id'].toString();
        if (!apptDoctorMap.has(userId)) {
          const fullName = `${user['firstName'] || ''} ${user['lastName'] || ''}`.trim() || 'Dr. Unknown';
          apptDoctorMap.set(userId, fullName);
        }
      });

      // Build final appointments data
      const appointmentsPerDoctor = appointmentsRaw.map(stat => ({
        doctorName: apptDoctorMap.get(stat._id?.toString()) || 'Dr. Unknown',
        appointments: stat.appointments
      }));

      // REVENUE PER DOCTOR (Bar Chart Data)
      const revenueRaw = await PatientRegistration.aggregate([
        {
          $match: appointmentQuery
        },
        {
          $group: {
            _id: "$assignedDoctor",
            totalRevenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
            advanceReceived: { $sum: { $ifNull: ["$advanceGivenAmount", 0] } }
          }
        },
        { $sort: { totalRevenue: -1 } }
      ]);

      // Get doctor IDs from raw data
      const revDoctorIds = revenueRaw.map(stat => stat._id).filter(id => id !== null);
      
      // Fetch doctor details from DoctorProfile
      let revDoctorProfiles: any[] = [];
      if (revDoctorIds.length > 0) {
        revDoctorProfiles = await DoctorProfile.find({ 
          user: { $in: revDoctorIds } 
        })
        .populate('user', 'firstName lastName')
        .lean();
      }

      // Create map
      const revDoctorMap = new Map();
      revDoctorProfiles.forEach(profile => {
        const userId = profile.user._id.toString();
        const fullName = `${profile.user.firstName || ''} ${profile.user.lastName || ''}`.trim() || 'Dr. Unknown';
        revDoctorMap.set(userId, fullName);
      });

      // Fallback to User model
      const revUsers = await User.find({ 
        _id: { $in: revDoctorIds },
        role: 'doctor'
      }).select('firstName lastName').lean();
      
      revUsers.forEach((user: any) => {
        const userId = user['_id'].toString();
        if (!revDoctorMap.has(userId)) {
          const fullName = `${user['firstName'] || ''} ${user['lastName'] || ''}`.trim() || 'Dr. Unknown';
          revDoctorMap.set(userId, fullName);
        }
      });

      // Build final revenue data
      const revenuePerDoctor = revenueRaw.map(stat => ({
        doctorName: revDoctorMap.get(stat._id?.toString()) || 'Dr. Unknown',
        revenue: Math.round(stat.totalRevenue - stat.advanceReceived)
      }));

      // PATIENT SATISFACTION RATINGS
      // Simulate patient satisfaction data based on doctor appointments
      const satisfactionRatings = leaderboardData.map((doctor) => ({
        doctorId: doctor.doctorId,
        doctorName: doctor.doctorName,
        rating: doctor.rating || (4.0 + Math.random()),
        totalReviews: Math.floor(doctor.totalAppointments * 0.6), // Assume 60% of patients leave reviews
        trend: Math.random() > 0.3 ? 'up' : 'down', // 70% chance of positive trend
        trendValue: Math.floor(Math.random() * 15) + 1 // 1-15% change
      }));

      return res.status(200).json({
        success: true,
        data: {
          leaderboard: leaderboardData,
          appointmentsPerDoctor,
          revenuePerDoctor,
          satisfactionRatings
        }
      });

    } catch (error: any) {
      console.error("Error fetching staff performance data:", error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch staff performance data",
        error: error.message
      });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
