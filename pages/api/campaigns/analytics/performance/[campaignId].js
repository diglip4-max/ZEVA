import dbConnect from "../../../../../lib/database";
import Campaign from "../../../../../models/Campaign";
import { getUserFromReq } from "../../../lead-ms/auth";

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
    const campaign = await Campaign.findById(campaignId)
      .populate("openedLeads.lead", "name email")
      .populate("clickedLeads.lead", "name email");

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // Calculate stats
    const stats = {
      sent: campaign.sentLeads.length || 0,
      delivered: campaign.deliveredLeads.length || 0,
      bounced: campaign.bouncedLeads.length || 0,
      unsubscribed: campaign.unsubscribedLeads.length || 0,
      spam: campaign.complainedLeads.length || 0,
      opened: campaign.openedLeads.length || 0,
      clicked: campaign.clickedLeads.length || 0,
    };

    // Calculate top links
    const linkClicks = {};
    campaign.clickedLeads.forEach((clickedLead) => {
      clickedLead.links.forEach((linkData) => {
        if (linkClicks[linkData.link]) {
          linkClicks[linkData.link] += linkData.clickCount;
        } else {
          linkClicks[linkData.link] = linkData.clickCount;
        }
      });
    });

    const topLinks = Object.entries(linkClicks)
      .map(([link, clicks]) => ({ link, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);

    // Calculate top contacts by engagement (opens + clicks)
    const contactEngagement = {};
    campaign.openedLeads.forEach((openedLead) => {
      const leadId = openedLead.lead?._id?.toString();
      if (leadId) {
        if (!contactEngagement[leadId]) {
          contactEngagement[leadId] = {
            name: openedLead.lead?.name || "Unknown",
            email: openedLead.lead?.email || "",
            openCount: openedLead.openCount || 0,
            clickCount: 0,
          };
        } else {
          contactEngagement[leadId].openCount += openedLead.openCount || 0;
        }
      }
    });

    campaign.clickedLeads.forEach((clickedLead) => {
      const leadId = clickedLead.lead?._id?.toString();
      if (leadId) {
        if (!contactEngagement[leadId]) {
          contactEngagement[leadId] = {
            name: clickedLead.lead?.name || "Unknown",
            email: clickedLead.lead?.email || "",
            openCount: 0,
            clickCount: clickedLead.clickCount || 0,
          };
        } else {
          contactEngagement[leadId].clickCount += clickedLead.clickCount || 0;
        }
      }
    });

    const topContacts = Object.values(contactEngagement)
      .sort((a, b) => b.openCount + b.clickCount - (a.openCount + a.clickCount))
      .slice(0, 10);

    return res.status(200).json({
      success: true,
      data: {
        stats,
        topLinks,
        topContacts,
      },
    });
  } catch (error) {
    console.error("Performance API Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}
