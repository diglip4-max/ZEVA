import dbConnect from '../../../lib/database';
import Offer from '../../../models/CreateOffer';
import Clinic from '../../../models/Clinic';
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

    if (!["clinic", "admin", "agent", "doctor", "doctorStaff", "staff"].includes(authUser.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { clinicId, error, isAdmin } = await getClinicIdFromUser(authUser);
    if (error && !isAdmin) {
      return res.status(404).json({ success: false, message: error });
    }

    let clinic = null;
    if (authUser.role === "clinic") {
      clinic = await Clinic.findOne({ owner: authUser._id });
    } else if (clinicId) {
      clinic = await Clinic.findById(clinicId);
    }

    if (!clinic) {
      return res.status(404).json({ success: false, message: 'Clinic not found' });
    }

    // Get filter type and date range from query
    const { filter, startDate, endDate, date } = req.query;
    
    let startOfDay, endOfDay;
    const now = new Date();

    if (filter === 'today') {
      const queryDate = date ? new Date(date) : now;
      startOfDay = new Date(queryDate);
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = new Date(queryDate);
      endOfDay.setHours(23, 59, 59, 999);
    } else if (filter === 'month') {
      if (startDate && endDate) {
        startOfDay = new Date(startDate);
        startOfDay.setHours(0, 0, 0, 0);
        endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
      } else {
        startOfDay = new Date(now.getFullYear(), now.getMonth(), 1);
        endOfDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }
    } else if (filter === 'overall') {
      startOfDay = new Date(0);
      endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
    } else {
      startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
    }

    // Aggregate offers by status based on filter
    const offerStats = await Offer.aggregate([
      {
        $match: {
          clinicId: clinic._id,
          createdAt: {
            $gte: startOfDay,
            $lte: endOfDay
          }
        }
      },
      {
        $group: {
          _id: { $toLower: "$status" },
          count: { $sum: 1 }
        }
      }
    ]);

    // Transform aggregation result into object format
    const offerStatusBreakdown = {};
    offerStats.forEach((stat) => {
      // Capitalize first letter for consistency
      const status = stat._id.charAt(0).toUpperCase() + stat._id.slice(1);
      offerStatusBreakdown[status] = stat.count;
    });

    res.status(200).json({ 
      success: true, 
      offerStatusBreakdown,
      message: 'Offer stats fetched successfully',
      filter: filter || 'today'
    });
  } catch (error) {
    console.error('Error fetching offer stats:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Error fetching offer stats' 
    });
  }
}
