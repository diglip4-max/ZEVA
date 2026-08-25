// jobs/generateRegexSuggestions.js
// Offline batch job: generates regex patterns for each active IntentDefinition
// by sending example messages to GPT-4o-mini and asking for regex suggestions.
//
// This job must NOT run on the request path.
// It runs on a schedule (BullMQ repeatable job, weekly) or manually via admin API.
//
// For each IntentDefinition:
// 1. Sends its example messages to GPT-4o-mini
// 2. Asks for 3-6 JS-compatible regex patterns
// 3. Validates each pattern compiles as a valid RegExp
// 4. Saves to regexPatterns field
// 5. Logs a summary for review

import "dotenv/config";
import mongoose from "mongoose";
import dbConnect from "../lib/database.js";
import IntentDefinition from "../models/IntentDefinition.js";
import { invalidateClinicPromptCache } from "../lib/classifierPromptBuilder.js";

/**
 * Generate regex suggestions for a single IntentDefinition using GPT-4o-mini.
 * @param {Object} intentDef - The IntentDefinition document
 * @returns {string[]} - Array of validated regex pattern strings
 */
async function generatePatternsForIntent(intentDef) {
  const exampleMessages = intentDef.examples.map((ex) => ex.message);

  if (exampleMessages.length === 0) {
    console.log(`  [RegexGen] "${intentDef.key}" has no examples — skipping`);
    return [];
  }

  const systemPrompt = `You are a regex pattern generator for a clinic chat intent classification system.
Given a set of example patient messages for the intent "${intentDef.key}" (${intentDef.label}),
generate 3-6 JavaScript-compatible regular expression patterns that would match
similarly-phrased messages in the same languages as the examples.

The patterns should:
- Be case-insensitive (the system applies the "i" flag)
- Use word boundaries (\\b) where appropriate
- Cover both English and Hindi/Hinglish variations if present in examples
- Be specific enough to avoid false positives
- Use standard JavaScript regex syntax (no PCRE-only features)

Respond with a JSON array of strings (each string is a regex pattern without delimiters or flags).
Example: ["how much.*cost", "price of", "kitna.*hai"]`;

  const userPrompt = `Intent: ${intentDef.key} ("${intentDef.label}")
Description: ${intentDef.description}

Example messages:
${exampleMessages.map((m, i) => `${i + 1}. "${m}"`).join("\n")}

Generate 3-6 regex patterns that would match these and similar messages.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "regex_patterns",
            strict: true,
            schema: {
              type: "object",
              properties: {
                patterns: {
                  type: "array",
                  items: { type: "string" },
                  description: "Array of regex pattern strings",
                },
              },
              required: ["patterns"],
              additionalProperties: false,
            },
          },
        },
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error(`  [RegexGen] OpenAI API error for "${intentDef.key}": ${response.status}`);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return [];

    const parsed = JSON.parse(content);
    const rawPatterns = parsed.patterns || [];

    // Validate each pattern compiles as a valid JS RegExp
    const validPatterns = [];
    for (const patternStr of rawPatterns) {
      try {
        new RegExp(patternStr, "i");
        validPatterns.push(patternStr);
      } catch (regexErr) {
        console.warn(`  [RegexGen] Invalid regex discarded for "${intentDef.key}": "${patternStr}" — ${regexErr.message}`);
      }
    }

    return validPatterns;
  } catch (err) {
    console.error(`  [RegexGen] Failed for "${intentDef.key}":`, err.message);
    return [];
  }
}

/**
 * Main job function: generate regex suggestions for all active IntentDefinitions.
 * Can be called from a BullMQ worker or triggered manually via admin API.
 */
export async function runGenerateRegexSuggestions() {
  console.log("[RegexGen] Starting regex suggestion generation job...\n");

  await dbConnect();

  const intentDefs = await IntentDefinition.find({ isActive: true }).lean();
  console.log(`[RegexGen] Found ${intentDefs.length} active intent definitions\n`);

  const summary = [];

  for (const def of intentDefs) {
    console.log(`[RegexGen] Processing "${def.key}" (${def.label})...`);

    const patterns = await generatePatternsForIntent(def);

    if (patterns.length > 0) {
      await IntentDefinition.findByIdAndUpdate(def._id, {
        $set: { regexPatterns: patterns },
      });
      console.log(`  [RegexGen] "${def.key}" — ${patterns.length} patterns saved`);
      for (const p of patterns) {
        console.log(`    → ${p}`);
      }
    } else {
      console.log(`  [RegexGen] "${def.key}" — no patterns generated`);
    }

    summary.push({ key: def.key, label: def.label, patternsGenerated: patterns.length });

    // Small delay between API calls to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Invalidate prompt cache for all clinics that had patterns updated
  const clinicIds = await IntentDefinition.distinct("clinicId", {
    isActive: true,
    clinicId: { $ne: null },
  });

  // Always invalidate global cache too
  await invalidateClinicPromptCache(null);
  for (const cid of clinicIds) {
    await invalidateClinicPromptCache(cid.toString());
  }

  console.log("\n[RegexGen] === SUMMARY ===");
  for (const s of summary) {
    console.log(`  ${s.key}: ${s.patternsGenerated} patterns`);
  }
  console.log("[RegexGen] Job complete.\n");

  return summary;
}

// Allow running as a standalone script:
// node --experimental-modules jobs/generateRegexSuggestions.js
if (process.argv[1]?.includes("generateRegexSuggestions")) {
  runGenerateRegexSuggestions()
    .then(() => {
      mongoose.connection.close();
      process.exit(0);
    })
    .catch((err) => {
      console.error("[RegexGen] Fatal error:", err);
      mongoose.connection.close();
      process.exit(1);
    });
}
