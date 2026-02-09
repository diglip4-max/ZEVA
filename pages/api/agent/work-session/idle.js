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

    if (!duration || duration < 1) {
      return res.status(400).json({ success: false, message: 'Invalid duration' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    let session = await WorkSession.findOne({
      agentId,
      date: { $gte: today, $lt: tomorrow },
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'No active session' });
    }

    // Add idle time (does NOT count toward deskTime or productiveTime)
    session.activityLogs.push({
      timestamp: new Date(),
      isActive: false,
      duration,
      activityType: 'idle'
    });

    await session.save();

    return res.json({
      success: true,
      message: 'Idle time recorded',
      idleSecondsAdded: duration
    });
  } catch (error) {
    console.error('IDLE RECORD ERROR:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
});