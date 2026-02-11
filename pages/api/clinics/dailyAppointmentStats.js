import dbConnect from '../../../lib/database';
import Appointment from '../../../models/Appointment';
import Clinic from '../../../models/Clinic';
import PatientRegistration from '../../../models/PatientRegistration';
import JobPosting from '../../../models/JobPosting';
import JobApplication from '../../../models/JobApplication';
import CreateOffer from '../../../models/CreateOffer';
import Lead from '../../../models/Lead';
import Review from '../../../models/Review';
import Enquiry from '../../../models/Enquiry';
import Membership from '../../../models/Membership';
import User from '../../../models/Users';
import { getUserFromReq } from '../lead-ms/auth';
import { getClinicIdFromUser } from '../lead-ms/permissions-helper';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const authUser = await getUserFromReq(req);
    
    if (!authUser) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Allow clinic, admin, agent, doctor, doctorStaff, and staff roles
    if (!["clinic", "admin", "agent", "doctor", "doctorStaff", "staff"].includes(authUser.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { clinicId, error, isAdmin } = await getClinicIdFromUser(authUser);
    if (error && !isAdmin) {
      return res.status(404).json({ success: false, message: error });
    }

    // Get clinic for additional checks
    let clinic = null;
    if (authUser.role === "clinic") {
      clinic = await Clinic.findOne({ owner: authUser._id });
    } else if (clinicId) {
      clinic = await Clinic.findById(clinicId);
    }

    if (!clinic) {
      return res.status(404).json({ success: false, message: 'Clinic not found' });
    }

    // Get all user IDs associated with this clinic (owner + all users with clinicId)
    const clinicUserIds = [];
    if (clinic.owner) {
      clinicUserIds.push(clinic.owner);
    }
    const clinicUsers = await User.find({ clinicId: clinic._id }).select('_id');
    clinicUsers.forEach(u => {
      if (!clinicUserIds.some(id => id.toString() === u._id.toString())) {
        clinicUserIds.push(u._id);
      }
    });

    // Get date from query, default to today
    const { date } = req.query;
    
    let queryDate;
    if (date) {
      queryDate = new Date(date);
    } else {
      queryDate = new Date();
    }

    // Set time range for the selected date (00:00:00 to 23:59:59)
    const startOfDay = new Date(queryDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(queryDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Aggregate appointments by status for the specific date
    const appointmentStats = await Appointment.aggregate([
      {
        $match: {
          clinicId: clinic._id,
          startDate: {
            $gte: startOfDay,
            $lte: endOfDay
          }
        }
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // Initialize counts for all requested statuses
    const stats = {
      booked: 0,
      enquiry: 0,
      discharge: 0,
      arrived: 0,
      consultation: 0,
      cancelled: 0,
      approved: 0,
      rescheduled: 0,
      waiting: 0,
      rejected: 0,
      completed: 0
    };
    
    appointmentStats.forEach(item => {
      const status = item._id?.toLowerCase();
      if (status === 'booked') stats.booked = item.count;
      else if (status === 'enquiry') stats.enquiry = item.count;
      else if (status === 'discharge') stats.discharge = item.count;
      else if (status === 'arrived') stats.arrived = item.count;
      else if (status === 'consultation') stats.consultation = item.count;
      else if (status === 'cancelled') stats.cancelled = item.count;
      else if (status === 'approved') stats.approved = item.count;
      else if (status === 'rescheduled') stats.rescheduled = item.count;
      else if (status === 'waiting') stats.waiting = item.count;
      else if (status === 'rejected') stats.rejected = item.count;
      else if (status === 'completed') stats.completed = item.count;
    });

    // Fetch daily counts for other modules
    
    // First, find all Job IDs for this clinic to count applications
    const clinicJobs = await JobPosting.find({
      $or: [
        { clinicId: clinic._id },
        { postedBy: { $in: clinicUserIds } }
      ]
    }).select('_id');
    const clinicJobIds = clinicJobs.map(job => job._id);

    const [
      dailyPatients,
      dailyJobs,
      dailyOffers,
      dailyLeads,
      dailyReviews,
      dailyEnquiries,
      dailyApplications,
      totalMembership,
      totalJobs
    ] = await Promise.all([
      // Daily Patients (created today)
      PatientRegistration.countDocuments({
        userId: { $in: clinicUserIds },
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }),
      // Daily Jobs (posted today)
      JobPosting.countDocuments({
        $or: [
          { clinicId: clinic._id },
          { postedBy: { $in: clinicUserIds } }
        ],
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }),
      // Daily Offers
      CreateOffer.countDocuments({
        clinicId: clinic._id,
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }),
      // Daily Leads
      Lead.countDocuments({
        clinicId: clinic._id,
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }),
      // Daily Reviews
      Review.countDocuments({
        clinicId: clinic._id,
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }),
      // Daily Enquiries
      Enquiry.countDocuments({
        clinicId: clinic._id,
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }),
      // Daily Applications (received today for clinic's jobs)
      JobApplication.countDocuments({
        jobId: { $in: clinicJobIds },
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }),
      // Total Membership (Active memberships?) - User asked for total membership
      // Assuming filtering by staffId being in clinicUserIds
      Membership.countDocuments({
        staffId: { $in: clinicUserIds }
      }),
      // Total Jobs (re-fetch for convenience as requested)
      JobPosting.countDocuments({
        $or: [
          { clinicId: clinic._id },
          { postedBy: { $in: clinicUserIds } }
        ]
      })
    ]);

    return res.status(200).json({
      success: true,
      date: startOfDay,
      stats, // Appointment stats breakdown
      daily: {
        patients: dailyPatients,
        jobs: dailyJobs,
        offers: dailyOffers,
        leads: dailyLeads,
        reviews: dailyReviews,
        enquiries: dailyEnquiries,
        applications: dailyApplications
      },
      totals: {
        membership: totalMembership,
        jobs: totalJobs
      }
    });

  } catch (error) {
    console.error('Error fetching daily appointment stats:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
