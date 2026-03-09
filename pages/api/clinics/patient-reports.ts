import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/database';
import PatientRegistration from '../../../models/PatientRegistration';
import Billing from '../../../models/Billing';
import Appointment from '../../../models/Appointment';
import { getUserFromReq } from '../lead-ms/auth';
import { getClinicIdFromUser } from '../lead-ms/permissions-helper';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  await dbConnect();

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Get authenticated user
    const authUser = await getUserFromReq(req);
    
    if (!authUser) {
      console.error('❌ No authenticated user found');
      return res.status(401).json({ success: false, message: 'Unauthorized - Please log in' });
    }

    console.log('✅ Authenticated user:', authUser.name, '(', authUser.email, ')');
    console.log('👤 User role:', authUser.role);

    // Get clinic ID from user using the same helper as other endpoints
    const { clinicId, error } = await getClinicIdFromUser(authUser);
    
    if (error) {
      console.error('❌ Error getting clinic ID:', error);
      return res.status(404).json({ success: false, message: error });
    }

    console.log('🏥 Using clinicId:', clinicId);

    // Get date filter params from query
    const { startDate, endDate, date } = req.query;

    // Build date filter based on time range
    let dateFilter: any = {};
    if (date) {
      const selectedDate = new Date(date as string);
      const startOfDay = new Date(selectedDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(selectedDate.setHours(23, 59, 59, 999));
      dateFilter = { createdAt: { $gte: startOfDay, $lte: endOfDay } };
    } else if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate as string),
          $lte: new Date(endDate as string),
        },
      };
    }
    // For 'overall', no date filter - shows all data

    console.log('📅 Using dateFilter:', dateFilter || 'Overall (no filter)');

    // Fetch all patients for the clinic within the date range
    const patients = await PatientRegistration.find({
      clinicId,
      ...dateFilter,
    }).lean();

    console.log('✅ Found', patients.length, 'patients');

    // 1. New vs Old Patients - Based on patientType field from PatientRegistration
    // Filter data based on the selected time range from "Select Calendar"
    // Use the same dateFilter that respects Week/Month/Overall selection
    const patientHistory = await PatientRegistration.find({
      clinicId,
      ...dateFilter,
    })
      .select('firstName lastName patientType createdAt')
      .sort({ createdAt: 1 })
      .lean();

    console.log('📊 Found', patientHistory.length, 'patients for New vs Old analysis');

    // Group by month for display in the chart
    const monthlyData: any = {};
    patientHistory.forEach((patient: any) => {
      const patientDate = new Date(patient.createdAt);
      const monthKey = `${patientDate.getFullYear()}-${String(patientDate.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = patientDate.toLocaleString('default', { month: 'short', year: '2-digit' });
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { 
          month: monthLabel, 
          newPatients: 0, 
          returningPatients: 0 
        };
      }
      
      // Count based on patientType: "New" or "Old"
      if (patient.patientType === 'New') {
        monthlyData[monthKey].newPatients++;
      } else {
        monthlyData[monthKey].returningPatients++;
      }
    });

    const newVsReturning = Object.values(monthlyData);
    console.log('📈 New vs Old patients data:', newVsReturning);

    // 2. Gender Distribution - Using gender field from PatientRegistration
    // Only count Male and Female genders, exclude Others and Unknown for cleaner display
    const genderCounts: any = {
      Male: 0,
      Female: 0,
    };

    patients.forEach((patient: any) => {
      if (patient.gender === 'Male') {
        genderCounts.Male++;
      } else if (patient.gender === 'Female') {
        genderCounts.Female++;
      }
      // Skip counting Other, Unknown, or null genders
    });

    const totalPatientsWithGender = Object.values(genderCounts).reduce((sum: number, count) => sum + (count as number), 0);
    
    console.log('👥 Gender counts:', genderCounts);
    
    // Only include gender groups that have data (Male and/or Female)
    const genderDistribution = Object.entries(genderCounts)
      .filter(([_, count]) => (count as number) > 0)
      .map(([name, count]) => ({
        name,
        percentage: totalPatientsWithGender > 0 ? (count as number) / totalPatientsWithGender : 0,
        value: count as number,
      }));

    console.log('📊 Gender distribution:', genderDistribution);

    // 3. Patient Visit Frequency - Based on number of appointments per patient
    const appointments = await Appointment.find({
      clinicId,
      ...dateFilter,
    })
      .select('patientId')
      .lean();

    console.log('💼 Found', appointments.length, 'appointments');

    // Count appointments per patient
    const patientVisitCounts = new Map<string, number>();
    
    appointments.forEach((appointment: any) => {
      const patientKey = appointment.patientId.toString();
      if (!patientVisitCounts.has(patientKey)) {
        patientVisitCounts.set(patientKey, 0);
      }
      patientVisitCounts.set(patientKey, patientVisitCounts.get(patientKey)! + 1);
    });

    console.log('📊 Found', patientVisitCounts.size, 'unique patients with appointments');

    // Group patients by visit frequency ranges
    const visitFrequencyData: any = {
      '1-2 visits': 0,
      '3-5 visits': 0,
      '6-10 visits': 0,
      '11-15 visits': 0,
      '16-20 visits': 0,
      '20+ visits': 0,
    };

    patientVisitCounts.forEach((visitCount: number) => {
      if (visitCount >= 1 && visitCount <= 2) {
        visitFrequencyData['1-2 visits']++;
      } else if (visitCount >= 3 && visitCount <= 5) {
        visitFrequencyData['3-5 visits']++;
      } else if (visitCount >= 6 && visitCount <= 10) {
        visitFrequencyData['6-10 visits']++;
      } else if (visitCount >= 11 && visitCount <= 15) {
        visitFrequencyData['11-15 visits']++;
      } else if (visitCount >= 16 && visitCount <= 20) {
        visitFrequencyData['16-20 visits']++;
      } else if (visitCount > 20) {
        visitFrequencyData['20+ visits']++;
      }
    });

    const patientVisitFrequency = Object.entries(visitFrequencyData)
      .filter(([_, count]) => (count as number) > 0)
      .map(([name, count]) => ({
        name,
        value: count as number,
      }));

    // 4. Top Patients (VIP) - Based on billing revenue from Billing model
    // Fetch all billings for the clinic within the date range
    const billings = await Billing.find({
      clinicId,
      ...dateFilter,
    })
      .populate('patientId', 'firstName lastName mobileNumber')
      .lean();

    console.log('💰 Found', billings.length, 'billing records');

    // Group billings by patient and calculate total revenue and count
    const patientBillingStats = new Map();
    
    billings.forEach((billing: any) => {
      if (!billing.patientId) return;
      
      const patientKey = billing.patientId._id.toString();
      
      if (!patientBillingStats.has(patientKey)) {
        patientBillingStats.set(patientKey, {
          _id: patientKey,
          name: `${billing.patientId.firstName || ''} ${billing.patientId.lastName || ''}`.trim() || 'Unknown',
          mobileNumber: billing.patientId.mobileNumber || 'N/A',
          billingCount: 0,
          totalRevenue: 0,
          lastBillingDate: billing.invoicedDate || billing.createdAt,
        });
      }
      
      // Increment billing count
      patientBillingStats.get(patientKey).billingCount++;
      
      // Add revenue from payment history in billing
      if (billing.paymentHistory && Array.isArray(billing.paymentHistory)) {
        billing.paymentHistory.forEach((payment: any) => {
          const amount = Number(payment.paid || payment.amount || 0);
          patientBillingStats.get(patientKey).totalRevenue += amount;
        });
      }
      
      // Update last billing date if this is more recent
      const billingDate = new Date(billing.invoicedDate || billing.createdAt);
      if (billingDate > new Date(patientBillingStats.get(patientKey).lastBillingDate)) {
        patientBillingStats.get(patientKey).lastBillingDate = billingDate;
      }
    });

    console.log('📊 Patient billing stats size:', patientBillingStats.size);

    // Convert map to array and sort by billing count and revenue
    let topPatientsArray = Array.from(patientBillingStats.values())
      .sort((a, b) => {
        // Sort by billing count first, then by total revenue
        if (b.billingCount !== a.billingCount) return b.billingCount - a.billingCount;
        return b.totalRevenue - a.totalRevenue;
      })
      .slice(0, 10); // Get top 10 patients
    
    // Add badges based on ranking
    topPatientsArray = topPatientsArray.map((patient: any, index) => ({
      ...patient,
      badge: index < 3 ? 'VIP' : index < 6 ? 'Gold' : index < 10 ? 'Silver' : 'Bronze',
      billingCount: patient.billingCount,
      totalRevenue: patient.totalRevenue,
    }));
    
    console.log('🏆 Top patients count:', topPatientsArray.length);

    res.status(200).json({
      success: true,
      data: {
        newVsReturning,
        genderDistribution,
        patientVisitFrequency,
        topPatients: topPatientsArray,
      },
    });
  } catch (error: any) {
    console.error('Error fetching patient reports:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch patient reports' 
    });
  }
}
