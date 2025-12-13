import dbConnect from '../../../lib/database';
import Enquiry from '../../../models/Enquiry';
import Review from '../../../models/Review';
import Clinic from '../../../models/Clinic';
import jwt from 'jsonwebtoken';
import { getUserFromReq } from '../lead-ms/auth';
import { getClinicIdFromUser, checkClinicPermission } from '../lead-ms/permissions-helper';

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

    // ✅ Check permission for reading clinic stats (only for agent, doctorStaff, staff roles)
    // Clinic and doctor roles have full access by default, admin bypasses
    if (!isAdmin && clinicId && ["agent", "staff", "doctorStaff"].includes(authUser.role)) {
      const { checkAgentPermission } = await import("../agent/permissions-helper");
      const result = await checkAgentPermission(
        authUser._id,
        "clinic_health_center",
        "read"
      );

      if (!result.hasPermission) {
        return res.status(403).json({
          success: false,
          message: result.error || "You do not have permission to view clinic statistics"
        });
      }
    }

    // Get clinic for additional checks
    let clinic = null;
    if (authUser.role === "clinic") {
      clinic = await Clinic.findOne({ owner: authUser._id });
      if (!clinic) {
        return res.status(404).json({ success: false, message: 'Clinic not found' });
      }
    } else if (clinicId) {
      clinic = await Clinic.findById(clinicId);
      if (!clinic) {
        return res.status(404).json({ success: false, message: 'Clinic not found' });
      }
    }

    // Ensure clinic exists before checking properties
    if (!clinic) {
      return res.status(404).json({ success: false, message: 'Clinic not found' });
    }

    // Check if clinic is approved
    if (!clinic.isApproved) {
      return res.status(403).json({ 
        success: false, 
        message: 'Clinic account not approved. Please wait for admin approval.' 
      });
    }

    // Check if clinic is declined
    if (clinic.declined) {
      return res.status(403).json({ 
        success: false, 
        message: 'Clinic account has been declined' 
      });
    }
   

    // Count reviews and enquiries for this clinic
    const [reviewCount, enquiryCount] = await Promise.all([
      Review.countDocuments({ clinicId }),
      Enquiry.countDocuments({ clinicId }),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalReviews: reviewCount,
        totalEnquiries: enquiryCount,
      },
    });
  } catch (error) {
    console.error('Error fetching clinic dashboard stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
      error: error.message,
    });
  }
}
