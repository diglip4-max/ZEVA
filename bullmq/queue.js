// lib/queue.ts
import { Queue } from "bullmq";
import redis from "./redis.js";

export const importLeadsFromFileQueue = new Queue("importLeadsFromFileQueue", {
  connection: redis,
});

export const importPatientsFromFileQueue = new Queue("importPatientsFromFileQueue", {
  connection: redis,
});