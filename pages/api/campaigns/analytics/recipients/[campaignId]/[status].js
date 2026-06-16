import dbConnect from "../../../../../../lib/database";
import Campaign from "../../../../../../models/Campaign";
import { getUserFromReq } from "../../../../lead-ms/auth";

// Helper to map status to the correct field in Campaign model
const statusToFieldMap = {
  sent: "sentLeads",
  delivered: "deliveredLeads",
  opened: "openedLeads",
  clicked: "clickedLeads",
  bounced: "bouncedLeads",
  unsubscribed: "unsubscribedLeads",
  failed: "failedLeads",
  notsent: "notSentLeads",
  "not sent": "notSentLeads",
  complained: "complainedLeads",
  "spam reports": "complainedLeads",
};

export default async function handler(req, res) {
  const { campaignId, status } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    await dbConnect();

    // Authenticate user
    const user = await getUserFromReq(req);
    if (!user) return;

    // Find campaign by ID and populate lead data
    const campaign = await Campaign.findById(campaignId).populate(
      "sentLeads.lead deliveredLeads.lead openedLeads.lead clickedLeads.lead bouncedLeads.lead unsubscribedLeads.lead failedLeads.lead notSentLeads.lead complainedLeads.lead",
      "name email phone",
    );

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // Map status to the correct field
    const normalizedStatus = status?.toString().toLowerCase().trim();
    const field = statusToFieldMap[normalizedStatus] || "sentLeads";
    const contactsForStatus = campaign[field] || [];

    // Simple pagination
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedLeads = contactsForStatus.slice(start, end);

    // Format the data to match the expected structure
    const data = paginatedLeads.map((leadEntry) => {
      let result = {
        contact: leadEntry.lead || { name: "Unknown", email: "", phone: "" },
        message: { status: status || "sent" },
      };

      // Add link information if status is clicked
      if (
        normalizedStatus === "clicked" &&
        leadEntry.links &&
        leadEntry.links.length > 0
      ) {
        result.link = leadEntry.links[0].link;
      }

      return result;
    });

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        totalResults: contactsForStatus.length,
        page,
        limit,
      },
    });
  } catch (error) {
    console.error("Recipient List API Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}
