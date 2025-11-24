import dbConnect from "../../../../lib/database";
import { getUserFromReq, requireRole } from "../../lead-ms/auth";
import { getOrCreateWallet } from "../../../../lib/smsWallet";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    await dbConnect();
    const user = await getUserFromReq(req);
    if (!user || !requireRole(user, ["doctor", "clinic"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const ownerType = user.role === "doctor" ? "doctor" : "clinic";
    const wallet = await getOrCreateWallet(user._id, ownerType);

    return res.status(200).json({
      success: true,
      data: {
        _id: wallet._id,
        balance: wallet.balance,
        totalSent: wallet.totalSent || 0,
        totalPurchased: wallet.totalPurchased || 0,
        lastTopupAt: wallet.lastTopupAt,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
        lowBalanceThreshold: parseInt(process.env.SMS_LOW_BALANCE_THRESHOLD || "20", 10),
      },
    });
  } catch (error) {
    console.error("wallet me error", error);
    return res.status(500).json({ success: false, message: "Failed to load wallet" });
  }
}

