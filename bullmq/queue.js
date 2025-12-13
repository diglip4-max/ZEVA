// lib/queue.ts
import { Queue } from "bullmq";
import redis from "./redis.js";

export const importLeadsFromFileQueue = new Queue("importLeadsFromFileQueue", {
  connection: redis,
});
