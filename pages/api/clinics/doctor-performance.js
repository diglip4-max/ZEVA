import dbConnect from "../../../lib/database";
import Appointment from "../../../models/Appointment";
import PatientRegistration from "../../../models/PatientRegistration";
import User from "../../../models/Users";
import Clinic from "../../../models/Clinic";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser, checkClinicPermission } from "../lead-ms/permissions-helper";
import dayjs from"dayjs";

export default async function handler(req, res) {
  await dbConnect();

  // Verify authentication
  let user;
  try {
    user = await getUserFromReq(req);
  if (!user) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
    }
  if (!["clinic", "doctor", "agent", "doctorStaff", "staff"].includes(user.role)) {
    return res.status(403).json({ success: false, message: "Access denied" });
    }
  } catch(error) {
  return res.status(401).json({ success: false, message: "Invalid token" });
  }

  // Get clinic ID from user
 const { clinicId, error: clinicError } = await getClinicIdFromUser(user);
  if (clinicError || !clinicId) {
  return res.status(403).json({ 
      success: false,
      message: clinicError || "Unable to determine clinic access" 
    });
  }

  // GET: Fetch doctor performance data
  if (req.method === "GET") {
    try {
  const { hasPermission, error: permError } = await checkClinicPermission(
    clinicId,
       "clinic_Appointment",  // Changed to match your clinic's module name
       "read"
     );

    if (!hasPermission) {
      return res.status(403).json({
          success: false,
          message: permError || "You do not have permission to view this data",
        });
      }

    const { filter= 'month', date, startDate, endDate } = req.query;

      // Calculate date range based on filter
     let queryStartDate;
     let queryEndDate;

  if (filter === 'week') {
    const baseDate = date ? dayjs(date) : dayjs();
       queryStartDate = baseDate.startOf('week').toDate();
       queryEndDate = baseDate.endOf('week').toDate();
      } else if (filter === 'month') {
    const baseDate = date ? dayjs(date) : dayjs();
       queryStartDate = baseDate.startOf('month').toDate();
       queryEndDate = baseDate.endOf('month').toDate();
      } else if (filter === 'overall') {
       queryStartDate = dayjs().startOf('year').toDate();
       queryEndDate = dayjs().endOf('year').toDate();
      } else {
       // Default to current month
    const baseDate = dayjs();
       queryStartDate = baseDate.startOf('month').toDate();
       queryEndDate = baseDate.endOf('month').toDate();
      }

    if (startDate && endDate) {
        queryStartDate = dayjs(startDate).startOf('day').toDate();
        queryEndDate = dayjs(endDate).endOf('day').toDate();
      }

    console.log('📅 Date Range:', { filter, queryStartDate, queryEndDate });

      // Fetch all appointments with doctor details
   const appointments = await Appointment.find({
     clinicId,
       startDate: {
          $gte: queryStartDate,
          $lte: queryEndDate
        },
       status: { $nin: ['Cancelled', 'Rejected'] }
      }).lean();

  console.log('✅ Found', appointments.length, 'appointments');
     
    // Manually populate doctor names from User model
 const doctorIds = [...new Set(appointments.map(apt => apt.doctorId.toString()))];
 console.log('👨‍⚕️ Unique doctor IDs:', doctorIds.length);
 console.log('👨‍⚕️ Doctor IDs:', doctorIds);
   
 const doctors = await User.find({ 
      _id: { $in: doctorIds } 
    }).select('_id name email').lean();
   
 console.log('👨‍⚕️ Doctors found in User model:', doctors.length);
  if (doctors.length > 0) {
  console.log('👨‍⚕️ Sample doctor data:', doctors[0]);
  }
   
  // Create a map for quick lookup
 const doctorMap = {};
 doctors.forEach(doc => {
    doctorMap[doc._id.toString()] = {
    name: doc.name,
      email: doc.email
    };
  });
   
  if (appointments.length > 0) {
 console.log('🎯 Sample appointment doctorId:', appointments[0].doctorId.toString());
 console.log('🎯 Sample doctor from map:', doctorMap[appointments[0].doctorId.toString()]);
  }

      // 1. Appointments per Doctor
   const doctorAppointmentMap = {};
      
      appointments.forEach(apt => {
     if (!apt.doctorId) return;
        
    const doctorKey = apt.doctorId._id ? apt.doctorId._id.toString() : apt.doctorId.toString();
      
      // Get doctor info from our manual map
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
        
     if (['Completed', 'Discharge', 'invoice'].includes(apt.status)) {
         doctorAppointmentMap[doctorKey].completedAppointments += 1;
        } else {
         doctorAppointmentMap[doctorKey].pendingAppointments += 1;
        }
      });

    const appointmentsPerDoctor = Object.values(doctorAppointmentMap)
        .sort((a, b) => b.appointmentCount - a.appointmentCount);

      // 2. Revenue per Doctor (estimate based on completed appointments)
      // Note: You might want to integrate with billing/invoice data if available
    const revenuePerDoctor = appointmentsPerDoctor.map(doctor => ({
       ...doctor,
       estimatedRevenue: Math.round(doctor.completedAppointments * 500) // Example: ₹500 per consultation
      }));

      // 3. Doctor Performance Leaderboard (most booked doctors)
   const leaderboardData = [...appointmentsPerDoctor]
        .map((doctor) => ({
         rank: 0, // Will be calculated after sorting
         doctorName: doctor.doctorName ? `Dr. ${doctor.doctorName}` : 'Unknown Doctor',
        appointmentCount: doctor.appointmentCount,
      completionRate: Math.round((doctor.completedAppointments / doctor.appointmentCount) * 100) || 0,
          // Performance Score = Completion Rate (0-100 scale)
          performanceScore: Math.round((doctor.completedAppointments / doctor.appointmentCount) * 100) || 0,
          estimatedRevenue: doctor.estimatedRevenue || Math.round(doctor.completedAppointments * 500),
          rating: parseFloat((4 + Math.random()).toFixed(1)) // Temporary: Generate rating between 4.0-5.0 (should come from reviews)
        }))
        // Sort by performance score first, then by appointment count for tie-breaking
        .sort((a, b) => {
          if (b.performanceScore !== a.performanceScore) {
            return b.performanceScore - a.performanceScore; // Higher score first
          }
          return b.appointmentCount - a.appointmentCount; // More appointments first if same score
        })
        .slice(0, 10) // Top 10 doctors
        .map((doctor, index) => ({
          ...doctor,
          rank: index + 1 // Assign rank after sorting
        }));

    return res.status(200).json({
        success: true,
        data: {
          appointmentsPerDoctor,
         revenuePerDoctor,
          leaderboardData,
          summary: {
            totalAppointments: appointments.length,
            totalDoctors: appointmentsPerDoctor.length,
            averageAppointmentsPerDoctor: appointmentsPerDoctor.length > 0
              ? Math.round(appointments.length /appointmentsPerDoctor.length)
              : 0
          }
        }
      });

    } catch (error) {
    console.error("❌ Error fetching doctor performance data:", error);
    console.error("Error stack:", error.stack);
    return res.status(500).json({ 
        success: false, 
        message: "Failed to fetch doctor performance data",
        error: error.message
      });
    }
  }

 res.setHeader("Allow", ["GET"]);
 return res.status(405).json({ success: false, message: "Method not allowed" });
}
