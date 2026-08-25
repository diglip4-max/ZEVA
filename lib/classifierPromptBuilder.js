// lib/classifierPromptBuilder.js
// Builds a dynamic LLM system prompt from IntentDefinition records.
// Caches the result in Redis (5-min TTL) to avoid a DB query per incoming message.

import IntentDefinition from "../models/IntentDefinition";
import { redisClient } from "../bullmq/redis";

const CACHE_PREFIX = "classifier-prompt:";
const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Build the classifier prompt from IntentDefinition records.
 * @param {string|ObjectId} clinicId - The clinic ID (can be null for global-only)
 * @returns {{ promptText: string, validKeys: string[], intentDefs: Array }}
 */
export async function buildClassifierPrompt(clinicId) {
  // Fetch all active global intents + clinic-scoped intents
  const query = clinicId
    ? {
        isActive: true,
        $or: [{ clinicId: null }, { clinicId: clinicId }],
      }
    : { isActive: true, clinicId: null };

  const allDefs = await IntentDefinition.find(query).lean();

  // If a clinic-scoped intent has the same key as a global one,
  // the clinic-scoped version overrides the global one.
  const defMap = new Map();
  for (const def of allDefs) {
    const existing = defMap.get(def.key);
    if (!existing || def.clinicId !== null) {
      // Override: clinic-scoped wins over global
      defMap.set(def.key, def);
    }
  }

  const intentDefs = Array.from(defMap.values());
  const validKeys = intentDefs.map((d) => d.key);

  // Build the system prompt
  let promptText = `You are an intent classifier for a clinic chat system.
Classify the patient message into exactly one intent category from the list below.
Also extract any mentioned treatments, doctors, dates, or prices from the message.

Valid intent categories:
${validKeys.join(", ")}
none (if the message does not match any category)

`;

  for (const def of intentDefs) {
    promptText += `## ${def.key} — "${def.label}"\n`;
    promptText += `${def.description}\n\n`;

    if (def.examples && def.examples.length > 0) {
      promptText += "Examples:\n";
      for (const ex of def.examples) {
        promptText += `  Message: "${ex.message}"\n`;
        promptText += `  Output: ${JSON.stringify(ex.expectedOutput)}\n\n`;
      }
    }
  }

  promptText += `\nRespond ONLY with a JSON object matching this schema:\n`;
  promptText += `{ "intent": "<one of the valid keys or none>", "entities": { "treatments": [], "doctors": [], "dates": [], "prices": [] } }\n`;

  return { promptText, validKeys, intentDefs };
}

/**
 * Get the cached prompt for a clinic, or build + cache it if missing/expired.
 * @param {string|ObjectId} clinicId
 * @returns {{ promptText: string, validKeys: string[], intentDefs: Array }}
 */
export async function getPromptForClinic(clinicId) {
  const cacheKey = `${CACHE_PREFIX}${clinicId || "global"}`;

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.promptText && parsed.validKeys) {
        return parsed;
      }
    }
  } catch (err) {
    // Redis errors shouldn't break classification — fall through to DB
    console.warn("[PromptBuilder] Redis cache read failed:", err.message);
  }

  // Cache miss — build from DB
  const result = await buildClassifierPrompt(clinicId);

  try {
    await redisClient.set(
      cacheKey,
      JSON.stringify(result),
      "EX",
      CACHE_TTL_SECONDS
    );
  } catch (err) {
    console.warn("[PromptBuilder] Redis cache write failed:", err.message);
  }

  return result;
}

/**
 * Invalidate the prompt cache for a clinic so changes take effect immediately.
 * Call this from any admin API that creates/updates/deletes an IntentDefinition.
 * @param {string|ObjectId} clinicId
 */
export async function invalidateClinicPromptCache(clinicId) {
  const cacheKey = `${CACHE_PREFIX}${clinicId || "global"}`;
  try {
    await redisClient.del(cacheKey);
    console.log(`[PromptBuilder] Cache invalidated for: ${cacheKey}`);
  } catch (err) {
    console.warn("[PromptBuilder] Redis cache invalidation failed:", err.message);
  }
}
