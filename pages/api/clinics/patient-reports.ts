import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/database';
import PatientRegistration from '../../../models/PatientRegistration';
import Billing from '../../../models/Billing';
import Appointment from '../../../models/Appointment';
import Clinic from '../../../models/Clinic';
import { getUserFromReq } from '../lead-ms/auth';
import { getClinicIdFromUser } from '../lead-ms/permissions-helper';
import { isNewClinicInMockPeriod, generateMockPatientDemographics } from '../../../lib/mockDataGenerator';
import dayjs from 'dayjs';

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
    const result: any = await getClinicIdFromUser(authUser);
    const clinicId = result['clinicId'];
    const error = result['error'];

    if (error) {
      console.error('❌ Error getting clinic ID:', error);
      return res.status(404).json({ success: false, message: error });
    }

    console.log('🏥 Using clinicId:', clinicId);

    // Get clinic to check registeredAt
    let clinic = null;
    if (authUser.role === 'clinic') {
      clinic = await Clinic.findOne({ owner: authUser._id });
    } else if (clinicId) {
      clinic = await Clinic.findById(clinicId);
    }

    // Check if clinic is within 2-day mock data period
    if (clinic && isNewClinicInMockPeriod(clinic.registeredAt)) {
      // Check if they have any real patient data
      const patientCount = await PatientRegistration.countDocuments({ clinicId });

      if (patientCount === 0) {
        console.log('📊 Returning mock patient reports for new clinic:', clinic._id);
        const mockData = generateMockPatientDemographics();

        return res.status(200).json({
          success: true,
          data: mockData,
          isMockData: true,
          message: 'Showing sample patient data for new clinic!',
        });
      }
    }

    // Get date filter params from query
    const { startDate, endDate, date, filter } = req.query;

    // Build date filter based on time range (accepts date/startDate&endDate or filter=today|week|month|overall)
    let dateFilter: any = {};
    let computedStart: Date | null = null;
    let computedEnd: Date | null = null;

    // If filter is provided but date params are missing, compute range
    if (filter && !date && !(startDate && endDate)) {
      const now = new Date();
      if (filter === 'today') {
        computedStart = new Date(now);
        computedStart.setHours(0, 0, 0, 0);
        computedEnd = new Date(now);
        computedEnd.setHours(23, 59, 59, 999);
      } else if (filter === 'week') {
        // Calculate Monday to Sunday week range
        const base = new Date(now);
        base.setHours(0, 0, 0, 0);
        const dayOfWeek = base.getDay();
        const diffToMonday = (dayOfWeek + 6) % 7;
        computedStart = new Date(base);
        computedStart.setDate(base.getDate() - diffToMonday);
        computedStart.setHours(0, 0, 0, 0);
        computedEnd = new Date(computedStart);
        computedEnd.setDate(computedStart.getDate() + 6);
        computedEnd.setHours(23, 59, 59, 999);
      } else if (filter === 'month') {
        computedStart = new Date(now.getFullYear(), now.getMonth(), 1);
        computedStart.setHours(0, 0, 0, 0);
        computedEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      } else {
        // overall -> no restriction
      }
    }
    if (date) {
      const startOfDay = dayjs(date as string).startOf('day').toDate();
      const endOfDay = dayjs(date as string).endOf('day').toDate();
      dateFilter = { createdAt: { $gte: startOfDay, $lte: endOfDay } };
      console.log('📅 Using single date filter:', startOfDay.toISOString(), 'to', endOfDay.toISOString());
    } else if (startDate && endDate) {
      const start = dayjs(startDate as string).startOf('day').toDate();
      const end = dayjs(endDate as string).endOf('day').toDate();
      dateFilter = {
        createdAt: {
          $gte: start,
          $lte: end,
        },
      };
      console.log('📅 Using date range filter:', start.toISOString(), 'to', end.toISOString());
    } else if (computedStart && computedEnd) {
      dateFilter = {
        createdAt: { $gte: computedStart, $lte: computedEnd }
      };
      console.log('📅 Using computed filter:', computedStart.toISOString(), 'to', computedEnd.toISOString(), 'based on', filter);
    } else {
      // For 'overall' or no date params - NO date filter, shows ALL historical data
      console.log('📅 Overall filter - NO date restriction, showing all data');
    }


    console.log('📅 Final dateFilter:', Object.keys(dateFilter).length > 0 ? dateFilter : 'NONE (showing all data)');

    // Build billingDateFilter for billings
    let billingDateFilter: any = {};
    if (date) {
      const startOfDay = dayjs(date as string).startOf('day').toDate();
      const endOfDay = dayjs(date as string).endOf('day').toDate();
      billingDateFilter = { createdAt: { $gte: startOfDay, $lte: endOfDay } };
    } else if (startDate && endDate) {
      const s = dayjs(startDate as string).startOf('day').toDate();
      const e = dayjs(endDate as string).endOf('day').toDate();
      billingDateFilter = { createdAt: { $gte: s, $lte: e } };
    } else if (computedStart && computedEnd) {
      billingDateFilter = { createdAt: { $gte: computedStart, $lte: computedEnd } };
    }

    // Fetch appointments for this period
    const appointments = await Appointment.find({ clinicId, ...dateFilter }).select('patientId').lean();

    // Fetch billings for this period
    const billings = await Billing.find({
      clinicId,
      ...(Object.keys(billingDateFilter).length ? billingDateFilter : {}),
      // Exclude advance/past-advance adjustment rows from "billings" count
      invoiceNumber: { $not: /^(PAST-ADV|ADV-)/ },
    }).populate('patientId', 'firstName lastName mobileNumber').lean();

    // Get unique active patient IDs from both appointments and billings
    const activePatientIds = new Set([
      ...appointments.map((a: any) => a.patientId?.toString()).filter(Boolean),
      ...billings.map((b: any) => b.patientId?._id?.toString()).filter(Boolean)
    ]);

    // Fetch gender data for these active patients
    const patients = await PatientRegistration.find({
      clinicId,
      _id: { $in: Array.from(activePatientIds) }
    }).select('gender').lean();

    console.log('✅ Found', patients.length, 'active patients in date range for gender distribution');

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
    console.log('📋 Sample patients:', JSON.stringify(patientHistory.slice(0, 5), null, 2));

    // Count total new and old patients
    const totalNewPatients = patientHistory.filter(p => p.patientType === 'New').length;
    const totalOldPatients = patientHistory.filter(p => p.patientType === 'Old').length;

    console.log('📈 Total New Patients:', totalNewPatients);
    console.log('📈 Total Old Patients:', totalOldPatients);

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
      } else if (patient.patientType === 'Old') {
        monthlyData[monthKey].returningPatients++;
      }
    });

    console.log('📊 Monthly data breakdown:', JSON.stringify(monthlyData, null, 2));

    const newVsReturning = Object.values(monthlyData);
    console.log('📈 Final New vs Returning data:', newVsReturning);

    // 2. Gender Distribution - Using gender field from PatientRegistration
    console.log('👥 Fetching gender data from PatientRegistration...');

    // Count all gender values from the patients
    const genderCounts: any = {};

    patients.forEach((patient: any) => {
      const gender = patient.gender;
      // Only count valid genders (Male, Female, Other), skip Unknown/null/undefined
      if (gender && ['Male', 'Female', 'Other'].includes(gender)) {
        if (!genderCounts[gender]) {
          genderCounts[gender] = 0;
        }
        genderCounts[gender]++;
      }
    });

    console.log('👥 Raw gender counts:', genderCounts);
    console.log('📋 Sample patient genders:', patients.slice(0, 10).map((p: any) => p.gender));

    const totalPatientsWithGender = Object.values(genderCounts).reduce((sum: number, count) => sum + (count as number), 0);

    console.log('👥 Total patients with valid gender data:', totalPatientsWithGender);

    // Only include Male, Female, Other that have data
    const genderDistribution = Object.entries(genderCounts)
      .filter(([_, count]) => (count as number) > 0)
      .map(([name, count]) => ({
        name,
        percentage: totalPatientsWithGender > 0 ? (count as number) / totalPatientsWithGender : 0,
        value: count as number,
      }))
      .sort((a, b) => (b.value as number) - (a.value as number)); // Sort by count descending

    console.log('📊 Final Gender distribution:', genderDistribution);

    // 3. Patient Visit Frequency - Based on number of appointments per patient
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

    // 4. Top Patients (VIP) - Based on billing revenue from Billing model (date-aware)
    console.log('💰 Found', billings.length, 'billing records');
    console.log('📅 Billing date filter applied:', billingDateFilter);
    // Log first 5 billings for verification
    if (billings.length > 0) {
      console.log('📄 Sample billings:');
      billings.slice(0, 5).forEach(b =>
        console.log('-', b.invoiceNumber, '|', (b.invoicedDate || b.createdAt), '| Paid:', b.paid)
      );
    }

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

      // Add revenue - use 'paid' field from billing (matches billing history API)
      const revenue = Number(billing.paid || 0);
      patientBillingStats.get(patientKey).totalRevenue += revenue;

      console.log('💰 Billing:', billing.invoiceNumber, 'Paid:', revenue, 'Patient:', patientBillingStats.get(patientKey).name);

      // Update last billing date if this is more recent
      const billingDate = new Date(billing.invoicedDate || billing.createdAt);
      if (billingDate > new Date(patientBillingStats.get(patientKey).lastBillingDate)) {
        patientBillingStats.get(patientKey).lastBillingDate = billingDate;
      }
    });

    console.log('📊 Patient billing stats size:', patientBillingStats.size);
    const eligiblePatients = Array.from(patientBillingStats.values()).filter(p => p.totalRevenue > 0);
    console.log('✅ Eligible patients (revenue > 0):', eligiblePatients.length);

    // Convert map to array, filter only those with revenue > 0, sort by revenue descending (top 10)
    let topPatientsArray = Array.from(patientBillingStats.values())
      .filter(patient => patient.totalRevenue > 0)
      .sort((a, b) => {
        // Sort by total revenue descending only
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
        totalNewPatients,
        totalOldPatients,
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
