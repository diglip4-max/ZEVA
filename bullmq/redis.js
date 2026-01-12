// lib/redis.ts
import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // ✅ REQUIRED FOR BULLMQ
  enableReadyCheck: false, // ✅ REQUIRED FOR BULLMQ
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    console.log(`🔄 Redis connection retry attempt ${times}, waiting ${delay}ms...`);
    return delay;
  },
  reconnectOnError: (err) => {
    const targetError = "READONLY";
    if (err.message.includes(targetError)) {
      console.log("⚠️ Redis is in readonly mode, reconnecting...");
      return true;
    }
    return false;
  },
});

// Handle connection events
redis.on("connect", () => {
  console.log("✅ Redis connected successfully");
});

redis.on("ready", () => {
  console.log("✅ Redis is ready to accept commands");
});

redis.on("error", (err) => {
  console.error("❌ Redis connection error:", err.message);
  if (err.code === "ECONNREFUSED") {
    console.error(`
⚠️  Redis is not running or not accessible!
   
To fix this:
1. Install Redis: https://redis.io/docs/getting-started/installation/
2. Start Redis server:
   - Windows: Download and run Redis from https://github.com/microsoftarchive/redis/releases
   - Mac: brew install redis && brew services start redis
   - Linux: sudo systemctl start redis
   
3. Or set REDIS_URL environment variable to your Redis instance
4. Current Redis URL: ${redisUrl}
    `);
  }
});

redis.on("close", () => {
  console.log("⚠️ Redis connection closed");
});

redis.on("reconnecting", () => {
  console.log("🔄 Redis reconnecting...");
});

export default redis;
