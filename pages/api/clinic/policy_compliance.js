import dbConnect from "../../../lib/database";
// import dbConnect from '../../../../lib/database';
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";
import SOP from "../../../models/SOP";
import Policy from "../../../models/Policy";
import Playbook from "../../../models/Playbook";
import Acknowledgment from "../../../models/Acknowledgment";
import User from "../../../models/Users";

export default async function handler(req, res) {
  await dbConnect();

  let user;
  try { 
    user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!["clinic", "agent", "doctorStaff", "staff", "admin"].includes(user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  let clinicId;
  if (user.role === "admin") {
    clinicId = req.query.clinicId || req.body.clinicId;
  } else {
    const resolved = await getClinicIdFromUser(user);
    clinicId = resolved.clinicId;
    if (resolved.error || !clinicId) {
      return res.status(403).json({ success: false, message: resolved.error || "Unable to determine clinic access" });
    }
  }

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { type } = req.query;

  if (type === "sops") {
    // For agent/doctorStaff, only show SOPs assigned to them via Acknowledgment records
    let sopFilter = { clinicId };
    if (["agent", "doctorStaff", "staff"].includes(user.role)) {
      const userId = user._id || user.userId || user.id;
      const acks = await Acknowledgment.find({
        clinicId,
        staffId: userId,
        documentType: "SOP"
      }).select("documentId").lean();
      const allowedIds = acks.map(a => a.documentId);
      sopFilter = { clinicId, _id: { $in: allowedIds } };
    }
    const items = await SOP.find(sopFilter).sort({ updatedAt: -1 }).lean();
    const agentsTotal = await User.countDocuments({ clinicId, role: "agent" });
    const doctorsTotal = await User.countDocuments({ clinicId, role: "doctorStaff" });
    const ids = items.map(i => i._id);
    const acks = await Acknowledgment.aggregate([
      { $match: { clinicId, documentType: "SOP", status: "Acknowledged", documentId: { $in: ids } } },
      { $group: { _id: { doc: "$documentId", role: "$role" }, count: { $sum: 1 } } }
    ]);
    const ackAgent = {};
    const ackDoctor = {};
    for (const r of acks) {
      const idStr = r._id.doc.toString();
      if (r._id.role === "agent") ackAgent[idStr] = r.count;
      if (r._id.role === "doctorStaff") ackDoctor[idStr] = r.count;
    }
    const normalizeRoles = (rolesArr = []) => {
      const lower = (rolesArr || []).map(r => String(r).toLowerCase());
      const hasAll = lower.some(r => r.includes("all"));
      const set = new Set();
      if (hasAll) { set.add("agent"); set.add("doctorStaff"); return set; }
      for (const r of lower) {
        if (r.includes("agent")) set.add("agent");
        if (r.includes("doctor")) set.add("doctorStaff");
      }
      return set;
    };
    const withPercents = items.map(i => {
      const idStr = i._id.toString();
      const applicable = normalizeRoles(i.applicableRoles || []);
      const pa = applicable.has("agent") && agentsTotal > 0 ? ((ackAgent[idStr] || 0) / agentsTotal) * 100 : 0;
      const pd = applicable.has("doctorStaff") && doctorsTotal > 0 ? ((ackDoctor[idStr] || 0) / doctorsTotal) * 100 : 0;
      const denom =
        (applicable.has("agent") ? agentsTotal : 0) +
        (applicable.has("doctorStaff") ? doctorsTotal : 0);
      const ackCount = (ackAgent[idStr] || 0) + (ackDoctor[idStr] || 0);
      const overall = denom > 0 ? (ackCount / denom) * 100 : (pa || pd);
      return { ...i, ackPercentAgent: pa, ackPercentDoctor: pd, ackOverall: overall };
    });
    return res.status(200).json({ success: true, items: withPercents });
  }
  if (type === "policies") {
    // For agent/doctorStaff, only show Policies assigned to them via Acknowledgment records
    let policyFilter = { clinicId };
    if (["agent", "doctorStaff", "staff"].includes(user.role)) {
      const userId = user._id || user.userId || user.id;
      const acks = await Acknowledgment.find({
        clinicId,
        staffId: userId,
        documentType: "Policy"
      }).select("documentId").lean();
      const allowedIds = acks.map(a => a.documentId);
      policyFilter = { clinicId, _id: { $in: allowedIds } };
    }
    const items = await Policy.find(policyFilter).sort({ updatedAt: -1 }).lean();
    const agentsTotal = await User.countDocuments({ clinicId, role: "agent" });
    const doctorsTotal = await User.countDocuments({ clinicId, role: "doctorStaff" });
    const ids = items.map(i => i._id);
    const acks = await Acknowledgment.aggregate([
      { $match: { clinicId, documentType: "Policy", status: "Acknowledged", documentId: { $in: ids } } },
      { $group: { _id: { doc: "$documentId", role: "$role" }, count: { $sum: 1 } } }
    ]);
    const ackAgent = {};
    const ackDoctor = {};
    for (const r of acks) {
      const idStr = r._id.doc.toString();
      if (r._id.role === "agent") ackAgent[idStr] = r.count;
      if (r._id.role === "doctorStaff") ackDoctor[idStr] = r.count;
    }
    const inferFromAppliesTo = (appliesTo) => {
      const txt = String(appliesTo || "").toLowerCase();
      const set = new Set();
      if (txt.includes("all")) { set.add("agent"); set.add("doctorStaff"); }
      if (txt.includes("agent")) set.add("agent");
      if (txt.includes("doctor")) set.add("doctorStaff");
      return set;
    };
    const withPercents = items.map(i => {
      const idStr = i._id.toString();
      const applicable = new Set((i.appliesToRoles || []).length ? i.appliesToRoles : Array.from(inferFromAppliesTo(i.appliesTo)));
      const pa = applicable.has("agent") && agentsTotal > 0 ? ((ackAgent[idStr] || 0) / agentsTotal) * 100 : 0;
      const pd = applicable.has("doctorStaff") && doctorsTotal > 0 ? ((ackDoctor[idStr] || 0) / doctorsTotal) * 100 : 0;
      const denom =
        (applicable.has("agent") ? agentsTotal : 0) +
        (applicable.has("doctorStaff") ? doctorsTotal : 0);
      const ackCount = (ackAgent[idStr] || 0) + (ackDoctor[idStr] || 0);
      const overall = denom > 0 ? (ackCount / denom) * 100 : (pa || pd);
      return { ...i, ackPercentAgent: pa, ackPercentDoctor: pd, ackOverall: overall };
    });
    return res.status(200).json({ success: true, items: withPercents });
  }
  if (type === "playbooks") {
    // For agent/doctorStaff, only show Playbooks assigned to them via Acknowledgment records
    let playbookFilter = { clinicId };
    if (["agent", "doctorStaff", "staff"].includes(user.role)) {
      const userId = user._id || user.userId || user.id;
      const acks = await Acknowledgment.find({
        clinicId,
        staffId: userId,
        documentType: "Playbook"
      }).select("documentId").lean();
      const allowedIds = acks.map(a => a.documentId);
      playbookFilter = { clinicId, _id: { $in: allowedIds } };
    }
    const items = await Playbook.find(playbookFilter).sort({ updatedAt: -1 }).lean();
    return res.status(200).json({ success: true, items });
  }

  // For overview counts, filter based on role
  let sopQuery = { clinicId };
  let policyQuery = { clinicId };
  let playbookQuery = { clinicId };
  if (["agent", "doctorStaff", "staff"].includes(user.role)) {
    const userId = user._id || user.userId || user.id;
    const userAcks = await Acknowledgment.find({
      clinicId,
      staffId: userId
    }).select("documentId documentType").lean();
    const sopIds = userAcks.filter(a => a.documentType === "SOP").map(a => a.documentId);
    const policyIds = userAcks.filter(a => a.documentType === "Policy").map(a => a.documentId);
    const playbookIds = userAcks.filter(a => a.documentType === "Playbook").map(a => a.documentId);
    sopQuery = { clinicId, _id: { $in: sopIds } };
    policyQuery = { clinicId, _id: { $in: policyIds } };
    playbookQuery = { clinicId, _id: { $in: playbookIds } };
  }
  const sopCount = await SOP.countDocuments(sopQuery);
  const policyCount = await Policy.countDocuments(policyQuery);
  const playbookCount = await Playbook.countDocuments(playbookQuery);

  return res.status(200).json({
    success: true,
    overview: {
      sopCount,
      policyCount,
      playbookCount,
    },
  });
}
