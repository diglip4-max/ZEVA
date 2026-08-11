import redis from "../../../bullmq/redis.js";

export default async function handler(req, res) {
  try {
    // Step 1: confirm that verify request is from Zeva Connect (shared secret)
    const apiKey = req.headers["x-internal-api-key"] || "";
    if (apiKey !== process.env.ZEVA_CONNECT_INTERNAL_API_KEY) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const { ticket } = await req.body;
    if (!ticket) {
      return res
        .status(400)
        .json({ success: false, message: "Ticket is required" });
    }

    // Step 2: look up ticket in Redis
    const key = `sso_ticket:${ticket}`;
    const data = await redis.get(key);

    console.log({ ticket, key, data });

    if (!data) {
      return res.status(401).json({ message: "Invalid or expired ticket" });
    }

    // Step 3: CRITICAL - delete ticket immediately (one-time use only)
    // await redis.del(key);

    const payload = JSON.parse(data);
    return res
      .status(200)
      .json({ success: true, message: "Ticket verified", data: payload });
  } catch (err) {
    console.error("Ticket verification failed", err);
    return res
      .status(500)
      .json({ success: false, message: "Verification failed" });
  }
}
