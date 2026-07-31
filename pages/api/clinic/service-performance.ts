import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/database';
import Appointment from '../../../models/Appointment';
import Clinic from '../../../models/Clinic';
import Billing from '../../../models/Billing';
import { getUserFromReq } from '../lead-ms/auth.js';
import { getClinicIdFromUser } from '../lead-ms/permissions-helper.js';
import { isNewClinicInMockPeriod, generateMockServicePerformance } from '../../../lib/mockDataGenerator';

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
    const { clinicId, error } = result;
    
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
      // Check if they have any real appointment data
      const appointmentCount = await Appointment.countDocuments({ clinicId });
      
      if (appointmentCount === 0) {
        console.log('📊 Returning mock service performance for new clinic:', clinic._id);
        const mockData = generateMockServicePerformance();
        
        return res.status(200).json({
          success: true,
          data: mockData,
          isMockData: true,
          message: 'Showing sample service performance data for new clinic!',
        });
      }
    }

    // Get date filter params from query
    const { startDate, endDate, date } = req.query;

    // Build date filter for billing records
    let billingDateFilter: any = {};
    if (date) {
      const selectedDate = new Date(date as string);
      const startOfDay = new Date(selectedDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(selectedDate.setHours(23, 59, 59, 999));
      billingDateFilter.invoicedDate = { $gte: startOfDay, $lte: endOfDay };
    } else if (startDate && endDate) {
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        billingDateFilter.invoicedDate = { $gte: start, $lte: end };
      }
    }
    // For 'overall', no date filter - shows all data

    console.log('📅 Using dateFilter:', billingDateFilter || 'Overall (no filter)');

    // Fetch ONLY Treatment billing records for the clinic
    const billingQuery: any = {
      clinicId,
      service: 'Treatment',
    };
    if (Object.keys(billingDateFilter).length > 0) {
      billingQuery.invoicedDate = billingDateFilter.invoicedDate;
    }

    const billingRecords = await Billing.find(billingQuery)
      .select('treatment paid amount service')
      .lean();

    console.log('💰 Found', billingRecords.length, 'Treatment billing records');

    // Aggregate billing data by treatment name (normalized to lowercase for consistency)
    const treatmentAggregation = new Map<string, { bookings: number; totalRevenue: number }>();

    billingRecords.forEach((billing: any) => {
      // Use the treatment field directly, skip if empty or null
      const treatmentName = (billing.treatment || '').trim();
      
      // Skip empty treatment names
      if (!treatmentName) return;
      
      const treatmentKey = treatmentName.toLowerCase(); // Normalize to lowercase for aggregation
      const paidAmount = Number(billing.paid) || 0;
      if (!treatmentAggregation.has(treatmentKey)) {
        treatmentAggregation.set(treatmentKey, {
          bookings: 0,
          totalRevenue: 0,
        });
      }

      const entry = treatmentAggregation.get(treatmentKey)!;
      entry.bookings += 1;
      entry.totalRevenue += paidAmount;
    });

    // Convert aggregated data to all three sections
    const aggregatedServices = Array.from(treatmentAggregation.entries())
      .map(([treatmentKey, data]) => {
        const treatmentDisplayName = treatmentKey.charAt(0).toUpperCase() + treatmentKey.slice(1); // Capitalize for display
        return {
          name: treatmentDisplayName,
          serviceName: treatmentDisplayName,
          bookings: data.bookings,
          revenue: data.totalRevenue,
          _id: treatmentKey,
        };
      })
      .filter(service => 
        service.name && 
        service.name !== 'Unknown' &&
        !service.name.toLowerCase().includes('unknown')
      );

    // 1. Most Booked Services (Top 7) - sorted by bookings descending
    const mostBookedServices = aggregatedServices
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 7)
      .map(service => ({
        name: service.name,
        bookings: service.bookings,
      }));

    console.log('📊 Most booked services:', mostBookedServices);

    // 2. Least Booked Services (Bottom 5) - sorted by bookings ascending
    const leastBookedServices = aggregatedServices
      .sort((a, b) => a.bookings - b.bookings)
      .slice(0, 5)
      .map(service => ({
        name: service.name,
        bookings: service.bookings,
        change: 0,
      }));

    console.log('📉 Least booked services:', leastBookedServices);

    // 3. Service Revenue Table - using same aggregated data
    const serviceRevenueData = aggregatedServices
      .sort((a, b) => b.revenue - a.revenue)
      .map(service => ({
        serviceName: service.serviceName,
        bookings: service.bookings,
        revenue: service.revenue,
      }));

    console.log('💰 Service revenue data:', serviceRevenueData);

    // 4. Treatment Conversion Rate - use aggregated treatment data
    // Since we don't have consultation data, we'll use bookings as the basis
    // and calculate a conversion rate based on bookings relative to total
    const totalBookings = aggregatedServices.reduce((sum, s) => sum + s.bookings, 0);
    const conversionRateData = aggregatedServices
      .slice(0, 8)
      .map(service => {
        // Calculate conversion rate based on bookings percentage of total
        const conversionRate = totalBookings > 0 
          ? Math.round((service.bookings / totalBookings) * 100) 
          : 0;
        
        return {
          name: service.name,
          conversionRate,
          bookings: service.bookings,
        };
      })
      .filter(item => item.conversionRate > 0);

    console.log('📈 Conversion rate data:', conversionRateData);

    res.status(200).json({
      success: true,
      data: {
        mostBookedServices,
        leastBookedServices,
        serviceRevenueData,
        conversionRateData,
      },
    });
  } catch (error: any) {
    console.error('Error fetching service performance:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch service performance' 
    });
  }
}
