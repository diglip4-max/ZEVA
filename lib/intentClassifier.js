// lib/intentClassifier.js
// Dynamic hybrid intent classification system:
// Layer 1: Regex patterns from DB (fast, free, ~80% accuracy)
// Layer 2: LLM fallback with structured output (GPT-4o-mini)
// All intent definitions are dynamic — loaded from IntentDefinition model, not hardcoded.

import Opportunity from "../models/Opportunity";
import IntentDefinition from "../models/IntentDefinition";
import { getPromptForClinic } from "./classifierPromptBuilder";
import socketService from "../services/socket-service";

// ─── Entity Extraction ───────────────────────────────────────────────────────

const TREATMENT_KEYWORDS = [
  "laser", "botox", "filler", "facial", "peel", "microneedling",
  "dermal", "whitening", "bleaching", "hair removal", "acne",
  "dental", "braces", "implant", "cleaning", "root canal",
  "physio", "massage", "rehabilitation", "consultation",
];

/**
 * Extract structured entities from message text
 */
function extractEntities(text) {
  const entities = {
    treatments: [],
    doctors: [],
    dates: [],
    prices: [],
  };

  if (!text) return entities;

  // Extract treatments
  const lowerText = text.toLowerCase();
  for (const treatment of TREATMENT_KEYWORDS) {
    if (lowerText.includes(treatment)) {
      entities.treatments.push(treatment);
    }
  }

  // Extract doctor names (Dr. followed by name)
  const doctorMatches = text.match(/\b(?:Dr\.?|Doctor)\s+([A-Z][a-z]+)/gi);
  if (doctorMatches) {
    entities.doctors = doctorMatches.map((m) => m.trim());
  }

  // Extract dates/times
  const datePatterns = [
    /\b(today|tomorrow|yesterday|tonight)\b/i,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\b(morning|afternoon|evening|night)\b/i,
    /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/,
    /\b(next week|this week|in \d+ days)\b/i,
  ];
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      entities.dates.push(match[0]);
    }
  }

  // Extract prices
  const priceMatches = text.match(/\$?\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:rs|rupees|aed|usd|\$)?/gi);
  if (priceMatches) {
    entities.prices = priceMatches.map((m) => m.trim());
  }

  return entities;
}

// ─── Layer 1: Regex Fast Path (DB-driven patterns) ──────────────────────────

/**
 * Detect intent using regex patterns stored in IntentDefinition.
 * Fetches the cached prompt (which includes intentDefs) to avoid a separate DB query.
 * @param {string} message - The message text
 * @param {string|ObjectId} clinicId - The clinic ID
 * @returns {Object|null} - { intent, confidence, entities } or null
 */
export async function detectIntentByPatterns(message, clinicId) {
  if (!message || typeof message !== "string") return null;

  try {
    // Reuse the cached prompt data (includes intentDefs) — no second DB query
    const { intentDefs } = await getPromptForClinic(clinicId);

    const entities = extractEntities(message);

    for (const def of intentDefs) {
      if (!def.regexPatterns || def.regexPatterns.length === 0) continue;

      for (const patternStr of def.regexPatterns) {
        try {
          const pattern = new RegExp(patternStr, "i");
          if (pattern.test(message)) {
            console.log(`[IntentClassifier] Layer 1 regex MATCH: ${def.key} (pattern: ${patternStr})`);
            return {
              intent: def.key,
              confidence: 0.85,
              entities,
              baseWeight: def.baseWeight,
            };
          }
        } catch (regexErr) {
          // Invalid regex pattern — skip it, log warning
          console.warn(`[IntentClassifier] Invalid regex pattern for "${def.key}": ${patternStr}`);
        }
      }
    }
  } catch (err) {
    console.error("[IntentClassifier] Layer 1 (regex) error:", err.message);
  }

  return null;
}

// ─── Layer 2: LLM Classification with Structured Output ─────────────────────

/**
 * Detect intent using LLM (OpenAI) with structured output.
 * Uses the dynamic prompt built from IntentDefinition records.
 * The JSON schema enum constraint guarantees the LLM cannot return an invalid intent key.
 * @param {string} message - The message text
 * @param {string|ObjectId} clinicId - The clinic ID
 * @returns {Object|null} - { intent, confidence, entities, baseWeight } or null
 */
export async function detectIntentByLLM(message, clinicId) {
  if (!message || message.length < 5) return null;

  try {
    // Get the dynamic prompt + valid keys from cache/DB
    const { promptText, validKeys, intentDefs } = await getPromptForClinic(clinicId);

    if (validKeys.length === 0) {
      console.warn("[IntentClassifier] No active intent definitions found — skipping LLM");
      return null;
    }

    // Build JSON schema with enum constraint built from current valid keys
    const jsonSchema = {
      name: "intent_classification",
      strict: true,
      schema: {
        type: "object",
        properties: {
          intent: {
            type: "string",
            enum: [...validKeys, "none"],
            description: "The classified intent key, or 'none' if no match",
          },
          entities: {
            type: "object",
            properties: {
              treatments: {
                type: "array",
                items: { type: "string" },
                description: "Treatment names mentioned",
              },
              doctors: {
                type: "array",
                items: { type: "string" },
                description: "Doctor names mentioned",
              },
              dates: {
                type: "array",
                items: { type: "string" },
                description: "Dates or time references mentioned",
              },
              prices: {
                type: "array",
                items: { type: "string" },
                description: "Price amounts mentioned",
              },
            },
            required: ["treatments", "doctors", "dates", "prices"],
            additionalProperties: false,
          },
        },
        required: ["intent", "entities"],
        additionalProperties: false,
      },
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: promptText },
          { role: "user", content: message },
        ],
        response_format: {
          type: "json_schema",
          json_schema: jsonSchema,
        },
        temperature: 0.1,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      console.error(`[IntentClassifier] OpenAI API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const parsed = JSON.parse(content);

    // Strict schema guarantees the shape, but still handle parse failures safely
    if (!parsed || typeof parsed.intent !== "string") {
      console.warn("[IntentClassifier] LLM returned unexpected shape:", content);
      return null;
    }

    if (parsed.intent === "none") return null;

    // Look up baseWeight from the matched intent definition
    const matchedDef = intentDefs.find((d) => d.key === parsed.intent);
    const baseWeight = matchedDef?.baseWeight || 50;

    // Merge LLM-extracted entities with regex-extracted entities for robustness
    const regexEntities = extractEntities(message);
    const llmEntities = parsed.entities || {};
    const mergedEntities = {
      treatments: [...new Set([...(llmEntities.treatments || []), ...regexEntities.treatments])],
      doctors: [...new Set([...(llmEntities.doctors || []), ...regexEntities.doctors])],
      dates: [...new Set([...(llmEntities.dates || []), ...regexEntities.dates])],
      prices: [...new Set([...(llmEntities.prices || []), ...regexEntities.prices])],
    };

    return {
      intent: parsed.intent,
      confidence: 0.7,
      entities: mergedEntities,
      baseWeight,
    };
  } catch (err) {
    console.error("[IntentClassifier] LLM classification failed:", err.message);
    return null;
  }
}

// ─── Relevance Score Computation ─────────────────────────────────────────────

/**
 * Compute relevance score (0-100) for sorting on dashboard.
 * Uses baseWeight from IntentDefinition instead of a hardcoded map.
 * Formula: baseWeight + (confidence × 10) + min(entityCount × 3, 15), capped at 100
 */
export function computeRelevanceScore(result) {
  const baseWeight = result.baseWeight || 50;
  const confidenceBoost = (result.confidence || 0.8) * 10;

  // Bonus for extracted entities (more context = more actionable)
  const entityCount =
    (result.entities?.treatments?.length || 0) +
    (result.entities?.doctors?.length || 0) +
    (result.entities?.dates?.length || 0);
  const entityBonus = Math.min(entityCount * 3, 15);

  return Math.min(Math.round(baseWeight + confidenceBoost + entityBonus), 100);
}

// ─── Staff Suggestion Generator ──────────────────────────────────────────────

/**
 * Generate a staff suggestion based on intent and entities.
 * Uses the intent key + extracted entities to produce actionable guidance.
 */
export function generateStaffSuggestion(intent, entities) {
  const treatments = entities?.treatments || [];
  const doctors = entities?.doctors || [];
  const dates = entities?.dates || [];

  const treatmentStr = treatments.length > 0 ? treatments.join(", ") : "the treatment";
  const doctorStr = doctors.length > 0 ? doctors[0] : "the doctor";
  const dateStr = dates.length > 0 ? dates[0] : "available";

  // Generic fallback for dynamically added intents
  const SUGGESTION_MAP = {
    price_inquiry: `Share pricing details for ${treatmentStr} and offer available slots`,
    booking_request: dates.length > 0
      ? `Help book this appointment for ${dateStr} - check available slots`
      : "Help book this appointment - check available slots",
    availability_check: doctors.length > 0
      ? `Check ${doctorStr}'s availability and offer alternatives`
      : "Check doctor availability and offer time slots",
    treatment_inquiry: `Explain ${treatmentStr} options and help schedule consultation`,
    comparison: "Explain differences between options and help choose the right treatment",
    urgency_signal: "Priority: This lead wants immediate assistance - respond quickly",
  };

  return SUGGESTION_MAP[intent] || `Review this "${intent}" message and assist the patient`;
}

// ─── Main Classification Function ────────────────────────────────────────────

/**
 * Classify a message and create an Opportunity if intent is detected.
 * Called from WhatsApp webhook after message is saved.
 *
 * Hybrid order:
 * 1. Layer 1: Regex fast path (free, instant) — uses DB-stored patterns
 * 2. Layer 2: LLM fallback (GPT-4o-mini) — only for non-trivial messages
 * 3. If intent is "none" or no result, skip Opportunity creation
 * 4. Otherwise, create Opportunity + emit socket event
 */
export async function classifyAndCreateOpportunity(newMessage, conversation, lead) {
  // Only classify incoming messages with text content
  console.log("[IntentClassifier] Entry check:", {
    direction: newMessage.direction,
    hasContent: !!newMessage.content,
    contentPreview: newMessage.content?.slice(0, 50),
    messageId: newMessage._id?.toString(),
  });

  if (newMessage.direction !== "incoming" || !newMessage.content) {
    console.log("[IntentClassifier] Skipped: not incoming or no content");
    return;
  }

  const clinicId = newMessage.clinicId || conversation?.clinicId;

  try {
    // Step 1: Layer 1 — regex fast path (no cost, instant)
    let result = await detectIntentByPatterns(newMessage.content, clinicId);
    console.log("[IntentClassifier] Layer 1 (regex) result:", result ? `MATCH: ${result.intent}` : "no match");

    // Step 2: Layer 2 — LLM fallback (only for non-trivial messages)
    if (!result && newMessage.content.length > 5) {
      console.log("[IntentClassifier] Running Layer 2 (LLM)...");
      result = await detectIntentByLLM(newMessage.content, clinicId);
      console.log("[IntentClassifier] Layer 2 (LLM) result:", result ? `MATCH: ${result.intent}` : "no match");
    }

    // Step 3: If no intent detected, skip
    if (!result || result.intent === "none") {
      console.log("[IntentClassifier] No actionable intent detected — skipping");
      return null;
    }

    // Step 4: Create Opportunity
    const staffSuggestion = generateStaffSuggestion(result.intent, result.entities);
    console.log("[IntentClassifier] Creating Opportunity:", {
      intent: result.intent,
      clinicId: clinicId?.toString(),
      conversationId: newMessage.conversationId?.toString(),
      messageId: newMessage._id?.toString(),
    });

    const opp = await Opportunity.create({
      clinicId: newMessage.clinicId,
      conversationId: newMessage.conversationId,
      leadId: newMessage.leadId || lead?._id,
      messageId: newMessage._id,
      intent: result.intent,
      confidence: result.confidence,
      leadMessage: newMessage.content,
      entities: result.entities || {},
      staffSuggestion,
      relevanceScore: computeRelevanceScore(result),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h
    });

    // Step 5: Emit real-time socket event for dashboard
    emitOpportunityToDashboard(newMessage.clinicId, opp, lead);

    console.log(`[IntentClassifier] Opportunity created: ${opp._id} (${result.intent})`);
    return opp;
  } catch (err) {
    // Don't let classification errors break the webhook
    if (err.code !== 11000) {
      // Ignore duplicate key errors (already classified this message)
      console.error("[IntentClassifier] Error:", err.message);
      console.error("[IntentClassifier] Error stack:", err.stack);
    } else {
      console.log("[IntentClassifier] Duplicate key - message already classified");
    }
  }

  return null;
}

// ─── Socket Emission for Dashboard ───────────────────────────────────────────

/**
 * Emit new opportunity to clinic staff dashboard via Socket.IO
 */
async function emitOpportunityToDashboard(clinicId, opportunity, lead) {
  try {
    // Find the provider (clinic staff) for this clinic to emit to their socket
    const Provider = (await import("../models/Provider")).default;
    const provider = await Provider.findOne({ clinicId }).select("userId").sort({ createdAt: -1 });

    if (provider?.userId) {
      const userId = provider.userId.toString();
      await socketService.emitToUser(userId, "newOpportunity", {
        opportunityId: opportunity._id,
        intent: opportunity.intent,
        leadName: lead?.name || "Unknown",
        leadMessage: opportunity.leadMessage,
        relevanceScore: opportunity.relevanceScore,
        staffSuggestion: opportunity.staffSuggestion,
        conversationId: opportunity.conversationId,
        leadId: opportunity.leadId,
      });
    }
  } catch (err) {
    console.error("[IntentClassifier] Socket emission failed:", err.message);
  }
}
