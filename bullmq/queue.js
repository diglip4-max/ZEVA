// lib/queue.ts
import { Queue } from "bullmq";
import redis from "./redis.js";

// ----------------------------------- IMPORT LEADS FROM FILE QUEUE -----------------------------------//

export const importLeadsFromFileQueue = new Queue("importLeadsFromFileQueue", {
  connection: redis,
});
export const whatsappTemplateQueue = new Queue("whatsappTemplateQueue", {
  connection: redis,
});
export const scheduleMessageQueue = new Queue("scheduleMessageQueue", {
  connection: redis,
});

//----------------------------------- WORKFLOW QUEUE -----------------------------------//
export const workflowQueue = new Queue("workflowQueue", {
  connection: redis,
});

// ----------------------------------- ACTION QUEUE -----------------------------------//
export const delayActionQueue = new Queue("delayActionQueue", {
  connection: redis,
});
