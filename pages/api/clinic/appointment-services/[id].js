import dbConnect from "../../../../lib/database";
import Appointment from "../../../../models/Appointment";
import Service from "../../../../models/Service";
import { getUserFromReq } from "../../lead-ms/auth";
import { getClinicIdFromUser } from "../../lead-ms/permissions-helper";
import mongoose from "mongoose";

export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  await dbConnect();

  const { id } = req.query;

  let user;
  try {
    user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!["clinic", "doctor", "agent", "doctorStaff", "staff"].includes(user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  const { clinicId, error: clinicError } = await getClinicIdFromUser(user);
  if (clinicError || !clinicId) {
    return res.status(403).json({ success: false, message: clinicError || "Unable to determine clinic" });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: "Invalid appointment ID" });
  }

  const { serviceIds, services } = req.body;
  
  // Backwards compatibility: if serviceIds is provided, use it
  // Otherwise use services array
  if (!serviceIds && !services) {
    return res.status(400).json({ success: false, message: "serviceIds or services must be provided" });
  }

  try {
    // Verify appointment belongs to clinic
    const appointment = await Appointment.findOne({ _id: id, clinicId });
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    let updateData = {};

    if (services && Array.isArray(services)) {
      // New format: services with quantities
      const validServices = [];
      for (const svc of services) {
        if (svc.serviceId && mongoose.Types.ObjectId.isValid(svc.serviceId)) {
          const foundSvc = await Service.findOne({ _id: svc.serviceId, clinicId });
          if (foundSvc) {
            validServices.push({
              serviceId: foundSvc._id,
              quantity: svc.quantity || 1
            });
          }
        }
      }

      // Now check if there are existing services (from serviceId/serviceIds) not in the new list
      // We want to keep all services, so we'll merge them!
      const existingServicesMap = new Map();
      if (Array.isArray(appointment.services)) {
        appointment.services.forEach(s => {
          if (s.serviceId) {
            existingServicesMap.set(s.serviceId.toString(), {
              serviceId: s.serviceId,
              quantity: s.quantity || 1
            });
          }
        });
      }

      // Add serviceId if not already there
      if (appointment.serviceId?._id) {
        const id = appointment.serviceId._id.toString();
        if (!existingServicesMap.has(id) && !validServices.some(vs => vs.serviceId.toString() === id)) {
          existingServicesMap.set(id, {
            serviceId: appointment.serviceId._id,
            quantity: 1
          });
        }
      }

      // Add serviceIds if not already there
      if (Array.isArray(appointment.serviceIds)) {
        appointment.serviceIds.forEach(s => {
          if (s?._id) {
            const id = s._id.toString();
            if (!existingServicesMap.has(id) && !validServices.some(vs => vs.serviceId.toString() === id)) {
              existingServicesMap.set(id, {
                serviceId: s._id,
                quantity: 1
              });
            }
          }
        });
      }

      // Combine the new validServices with existingServicesMap (prefer validServices)
      const finalServices = [];
      const validServiceIds = new Set(validServices.map(vs => vs.serviceId.toString()));

      // Add valid services first
      finalServices.push(...validServices);

      // Add existing services that aren't in valid services
      existingServicesMap.forEach((s) => {
        if (!validServiceIds.has(s.serviceId.toString())) {
          finalServices.push(s);
        }
      });

      // Set services and serviceIds
      updateData.services = finalServices;
      updateData.serviceIds = finalServices.map(s => s.serviceId);
    } else if (serviceIds && Array.isArray(serviceIds)) {
      // Backwards compatibility: use serviceIds
      // Validate service IDs belong to the clinic
      const validIds = [];
      for (const sid of serviceIds) {
        if (mongoose.Types.ObjectId.isValid(sid)) {
          const svc = await Service.findOne({ _id: sid, clinicId });
          if (svc) validIds.push(svc._id);
        }
      }

      // Build the merged set: existing serviceIds + new valid ones (no duplicates)
      const existingIds = appointment.serviceIds.map((s) => s.toString());
      const toAdd = validIds.filter((newId) => !existingIds.includes(newId.toString()));

      // Append only new IDs — never overwrite existing ones
      if (toAdd.length > 0) {
        updateData.$push = { serviceIds: { $each: toAdd } };
        // Also add to services for new format (backwards compatibility)
        const newServicesToAdd = toAdd.map(id => ({ serviceId: id, quantity: 1 }));
        // Only add to services if they're not already there
        const existingServiceIds = appointment.services?.map(s => s.serviceId.toString()) || [];
        const servicesToAdd = newServicesToAdd.filter(s => !existingServiceIds.includes(s.serviceId.toString()));
        if (servicesToAdd.length > 0) {
          if (!updateData.$push) updateData.$push = {};
          updateData.$push.services = { $each: servicesToAdd };
        }
      }
    }

    const updated = await Appointment.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate("serviceIds", "name price clinicPrice").populate("services.serviceId", "name price clinicPrice");

    return res.status(200).json({
      success: true,
      message: "Services updated successfully",
      serviceIds: updated.serviceIds.map((s) => s._id.toString()),
      serviceNames: updated.serviceIds.map((s) => s.name),
      services: updated.services?.map(s => ({
        serviceId: s.serviceId._id.toString(),
        quantity: s.quantity,
        name: s.serviceId.name,
        price: s.serviceId.price,
        clinicPrice: s.serviceId.clinicPrice
      })) || []
    });
  } catch (error) {
    console.error("Error updating appointment services:", error);
    return res.status(500).json({ success: false, message: "Failed to update services" });
  }
}
