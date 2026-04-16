export const pauseCampaign = async (req, res) => {
  const user = req.user;
  const userId = user._id;
  const teamId = user.team;
  const { campaignId } = req.body;
  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res
        .status(404)
        .json({ success: false, message: "Campaign not found" });
    }
    if (
      user?.role === "agent" &&
      campaign?.userId?.toString() !== userId?.toString()
    ) {
      return res.status(405).json({
        success: false,
        message: "You are not allowed to perform this action",
      });
    }

    // Update the campaign status to 'paused'
    campaign.status = "paused";
    await campaign.save();

    const jobId = campaign.jobId;
    if (campaign.type === "sms") {
      let smsCampaignJob = await scheduleSmsCampaignQueue.getJob(jobId);
      if (smsCampaignJob) {
        await smsCampaignJob.remove();
        console.log(
          `SMS campaign job removed successfully of JobId : ${jobId}`,
        );
      }
    } else if (campaign.type === "whatsapp") {
      let whatsappCampaignJob =
        await scheduleWhatsappCampaignQueue.getJob(jobId);
      if (whatsappCampaignJob) {
        await whatsappCampaignJob.remove();
        console.log(
          `Whatsapp campaign job removed successfully of JobId : ${jobId}`,
        );
      }
    } else if (campaign.type === "voice") {
      let voiceCampaignJob = await scheduleVoiceCampaignQueue.getJob(jobId);
      if (voiceCampaignJob) {
        await voiceCampaignJob.remove();
        console.log(
          `Voice campaign job removed successfully of JobId : ${jobId}`,
        );
      }
    } else if (campaign.type === "email") {
      let emailCampaignJob = await scheduleEmailSesCampaignQueue.getJob(jobId);
      if (!emailCampaignJob) {
        // check in smtp or gmail email campaign queue
        emailCampaignJob = await scheduleEmailCampaignQueue.getJob(jobId);
      }
      if (emailCampaignJob) {
        await emailCampaignJob.remove();
        console.log(
          `Email campaign job removed successfully of JobId : ${jobId}`,
        );
      }
    }

    res.status(200).json({
      success: true,
      message: "Campaign paused successfully",
    });
  } catch (error) {
    console.log("Error in pausedCampaign: ", error?.message);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
export const resumeCampaign = async (req, res) => {
  const user = req.user;
  const userId = user._id;
  const teamId = user.team;
  const { campaignId } = req.body;
  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res
        .status(404)
        .json({ success: false, message: "Campaign not found" });
    }
    if (
      user?.role === "agent" &&
      campaign?.userId?.toString() !== userId?.toString()
    ) {
      return res.status(405).json({
        success: false,
        message: "You are not allowed to perform this action",
      });
    }

    campaign.status = "processing";
    await campaign.save();

    let queueJob;
    // generate custom job id for unique identifier for every job
    const customJobId = `${campaignId}-${Date.now()}`;
    if (campaign.type === "sms") {
      queueJob = await scheduleSmsCampaignQueue.add(
        "scheduleSmsQueue",
        {
          campaignId,
        },
        {
          attempts: 3,
          backoff: 5000,
          removeOnComplete: true,
          jobId: customJobId,
        },
      );
    } else if (campaign.type === "whatsapp") {
      queueJob = await scheduleWhatsappCampaignQueue.add(
        "scheduleWhatsappQueue",
        {
          campaignId,
        },
        {
          attempts: 3,
          backoff: 5000,
          removeOnComplete: true,
          jobId: customJobId,
        },
      );
    } else if (campaign.type === "voice") {
      queueJob = await scheduleVoiceCampaignQueue.add(
        "scheduleVoiceQueue",
        {
          campaignId,
        },
        {
          attempts: 3,
          backoff: 5000,
          removeOnComplete: true,
          jobId: customJobId,
        },
      );
    } else if (campaign.type === "email") {
      // Check provider type
    }

    campaign.jobId = queueJob.id;
    await campaign.save();

    res.status(200).json({
      success: true,
      message: "Campaign resumed successfully",
    });
  } catch (error) {
    console.log("Error in pausedCampaign: ", error?.message);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
