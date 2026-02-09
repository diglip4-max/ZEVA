// lib/redis.ts
import { Redis } from "ioredis";

const redis = new Redis(
  "redis://default:MDXqZeSqqZCo6O2PGo7pSLEaM0jx6WYy@redis-13789.c232.us-east-1-2.ec2.cloud.redislabs.com:13789",
  {
    maxRetriesPerRequest: null, // ✅ REQUIRED FOR BULLMQ
    enableReadyCheck: false, // ✅ REQUIRED FOR BULLMQ
  }
);

export const redisClient = redis;

export default redis;
