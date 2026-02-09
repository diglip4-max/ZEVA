// pages/api/agent/work-session/mouse-activity.js
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

    let session = await WorkSession.findOne({
      agentId,
      date: { $gte: today, $lt: tomorrow },
    });

    if (!session) {
      // Create new session if none exists
      session = new WorkSession({
        agentId,
        role: 'agent',
        date: today,
        productiveSeconds: duration,
      });
    } else {
      // Add to existing productive time
      session.productiveSeconds = (session.productiveSeconds || 0) + duration;
    }

    // Add to activity logs
    session.activityLogs.push({
      timestamp: new Date(),
      isActive: true,
      duration,
      activityType: 'mouse'
    });

    await session.save();
    console.log('MOUSE ACTIVITY RECORDED:', {
      agentId,
      date: session.date,
      productiveSeconds: session.productiveSeconds,
    });
    return res.json({
      success: true,
      message: 'Mouse activity recorded',
      productiveSeconds: session.productiveSeconds,
    });
  } catch (error) {
    console.error('MOUSE ACTIVITY ERROR:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
});