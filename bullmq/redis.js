// lib/redis.ts
import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: null, // ✅ REQUIRED FOR BULLMQ
  enableReadyCheck: false, // ✅ REQUIRED FOR BULLMQ
});

const redisClient = redis;

export { redisClient };
export default redis;
