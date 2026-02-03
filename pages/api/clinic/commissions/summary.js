import dbConnect from "../../../../lib/database";
import Commission from "../../../../models/Commission";
import Referral from "../../../../models/Referral";
import User from "../../../../models/Users";
import AgentProfile from "../../../../models/AgentProfile";
import Clinic from "../../../../models/Clinic";
import { getUserFromReq } from "../../lead-ms/auth";
import { checkClinicPermission } from "../../lead-ms/permissions-helper";
import { checkAgentPermission } from "../../agent/permissions-helper";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const source = req.query.source ? String(req.query.source) : null; // "referral" | "staff" | null

    let clinicId = null;
    let clinic = null;
    if (me.role === "clinic") {
      clinic = await Clinic.findOne({ owner: me._id }).select("_id");
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found for this user" });
      }
      clinicId = clinic._id;
    } else if (["agent", "doctor", "doctorStaff", "staff"].includes(me.role)) {
      if (!me.clinicId) {
        return res.status(403).json({ success: false, message: "User not linked to a clinic" });
      }
      clinicId = me.clinicId;
    } else if (me.role === "admin") {
      const qClinicId = req.query.clinicId;
      if (!qClinicId) {
        return res.status(400).json({ success: false, message: "Admin must provide clinicId" });
      }
      clinicId = qClinicId;
    } else {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (me.role !== "admin") {
      if (me.role === "clinic") {
        const { hasPermission, error } = await checkClinicPermission(clinicId, "clinic_commission", "read");
        if (!hasPermission) {
          return res.status(403).json({ success: false, message: error || "No permission to view commissions" });
        }
      } else if (["agent", "doctorStaff"].includes(me.role)) {
        const { hasPermission, error } = await checkAgentPermission(me._id, "clinic_commission", "read");
        if (!hasPermission) {
          return res.status(403).json({ success: false, message: error || "No permission to view commissions" });
        }
      }
    }

    let match = { clinicId };
    if (source === "referral") {
      match = {
        clinicId,
        $or: [{ source: "referral" }, { referralId: { $ne: null } }],
      };
    } else if (source === "staff") {
      match = {
        clinicId,
        $or: [{ source: "staff" }, { staffId: { $ne: null } }],
      };
    }

    const grouped = await Commission.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            source: "$source",
            referralId: "$referralId",
            staffId: "$staffId",
          },
          totalCommissionAmount: { $sum: "$commissionAmount" },
          totalAmountPaid: { $sum: "$amountPaid" },
          count: { $sum: 1 },
          lastCommissionPercent: { $last: "$commissionPercent" },
          lastReferralName: { $last: "$referralName" },
        },
      },
      { $sort: { totalCommissionAmount: -1 } },
    ]);

    const results = [];
    for (const g of grouped) {
      const isReferral = !!g._id.referralId;
      const isStaff = !!g._id.staffId;
      if (isReferral) {
        let name = g.lastReferralName || "";
        let percent = g.lastCommissionPercent || 0;
        const referralId = g._id.referralId;
        if (referralId) {
          const ref = await Referral.findById(referralId).lean();
          if (ref) {
            name = `${(ref.firstName || "").trim()} ${(ref.lastName || "").trim()}`.trim() || name;
            percent = Number(ref.referralPercent ?? percent);
          }
        }
        results.push({
          source: "referral",
          personId: referralId?.toString() || null,
          name,
          percent,
          totalEarned: Number(g.totalCommissionAmount.toFixed(2)),
          totalPaid: Number(g.totalAmountPaid.toFixed(2)),
          count: g.count,
        });
      } else if (isStaff) {
        const staffId = g._id.staffId;
        let name = "";
        let percent = g.lastCommissionPercent || 0;
        if (staffId) {
          const user = await User.findById(staffId).select("name role").lean();
          if (user) {
            name = user.name || "";
          }
          const profile = await AgentProfile.findOne({ userId: staffId }).lean();
          if (profile && profile.commissionPercentage != null) {
            percent = Number(profile.commissionPercentage);
          }
        }
        results.push({
          source: "staff",
          personId: staffId?.toString() || null,
          name,
          percent,
          totalEarned: Number(g.totalCommissionAmount.toFixed(2)),
          totalPaid: Number(g.totalAmountPaid.toFixed(2)),
          count: g.count,
        });
      }
    }

    return res.status(200).json({ success: true, items: results });
  } catch (err) {
    console.error("Error in commissions summary:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal Server Error" });
  }
}
