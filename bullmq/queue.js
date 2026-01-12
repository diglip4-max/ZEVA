// lib/queue.ts
import { Queue } from "bullmq";
import redis from "./redis.js";

export const importLeadsFromFileQueue = new Queue("importLeadsFromFileQueue", {
  connection: redis,
});
export const whatsappTemplateQueue = new Queue("whatsappTemplateQueue", {
  connection: redis,
});
export const scheduleMessageQueue = new Queue("scheduleMessageQueue", {
  connection: redis,
});
