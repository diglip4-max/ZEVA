// pages/api/agent/work-session/desktime.js
import dbConnect from '../../../../lib/database';
import WorkSession from '../../../../models/WorkSession';
import withAgentApiAuth from '../../../../middleware/withAgentApiAuth';

export default withAgentApiAuth(async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const agentId = req.user.id;
    const { duration } = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Find or create today's session
    let session = await WorkSession.findOne({
      agentId,
      date: { $gte: today, $lt: tomorrow },
    });

    if (!session) {
      // Create new session if none exists
      session = new WorkSession({
        agentId,
        date: today,
        deskTimeSeconds: duration,
        lastActivity: new Date(),
      });
    } else {
      // Update existing session
      session.deskTimeSeconds = (session.deskTimeSeconds || 0) + duration;
      session.lastActivity = new Date();
    }

    // Add to activity logs
    session.activityLogs.push({
      timestamp: new Date(),
      isActive: true,
      duration,
      activityType: 'desktime'
    });

    // Recalculate productivity percentage
    if (session.deskTimeSeconds > 0) {
      session.productivityPercentage = Math.min(100, 
        Math.round((session.productiveSeconds / session.deskTimeSeconds) * 100)
      );
    }

    await session.save();

    return res.json({
      success: true,
      message: 'DeskTime recorded',
      deskTimeSeconds: session.deskTimeSeconds,
      productivityPercentage: session.productivityPercentage,
    });
  } catch (error) {
    console.error('DESK TIME ERROR:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
});