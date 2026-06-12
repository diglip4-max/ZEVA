import dbConnect from "../../../../../../lib/database";
import Campaign from "../../../../../../models/Campaign";
import { getUserFromReq } from "../../../../lead-ms/auth";

export default async function handler(req, res) {
  const { campaignId } = req.query;

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    await dbConnect();

    // Authenticate user
    const user = await getUserFromReq(req);
    if (!user) return;

    // Find campaign by ID
    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // Calculate counts from campaign data
    const data = {
      success: true,
      data: {
        Sent: campaign.sentLeads.length || 0,
        Delivered: campaign.deliveredLeads.length || 0,
        Opened: campaign.openedLeads.length || 0,
        Clicked: campaign.clickedLeads.length || 0,
        Bounced: campaign.bouncedLeads.length || 0,
        Unsubscribed: campaign.unsubscribedLeads.length || 0,
        Failed: campaign.failedLeads.length || 0,
        "Not sent": campaign.notSentLeads.length || 0,
        "Spam reports": campaign.complainedLeads.length || 0,
      },
    };

    return res.status(200).json(data);
  } catch (error) {
    console.error("Recipient Counts API Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}
