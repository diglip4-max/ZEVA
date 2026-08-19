/**
 * Seed Script: Populate IntentDefinition with the 6 existing global intents
 *
 * Run once to migrate the hardcoded intent definitions into the database
 * so the dynamic classification system can use them.
 *
 * Usage:
 *   node --experimental-modules scripts/seedIntentDefinitions.js
 *
 * Safe to run multiple times — uses upsert on (clinicId, key) compound unique index.
 * Does NOT set regexPatterns — the generateRegexSuggestions job populates those.
 */

import "dotenv/config";
import mongoose from "mongoose";
import dbConnect from "../lib/database.js";
import IntentDefinition from "../models/IntentDefinition.js";

const SEED_DATA = [
  {
    clinicId: null,
    key: "price_inquiry",
    label: "Price Inquiry",
    description:
      "The patient is asking about the cost, pricing, fees, or charges for a treatment, service, or consultation. This includes questions about discounts, packages, or comparing costs.",
    examples: [
      {
        message: "How much does laser treatment cost?",
        expectedOutput: {
          intent: "price_inquiry",
          entities: { treatments: ["laser"], doctors: [], dates: [], prices: [] },
        },
      },
      {
        message: "tell me all treatment price",
        expectedOutput: {
          intent: "price_inquiry",
          entities: { treatments: [], doctors: [], dates: [], prices: [] },
        },
      },
      {
        message: "kitna lagta hai facial ka",
        expectedOutput: {
          intent: "price_inquiry",
          entities: { treatments: ["facial"], doctors: [], dates: [], prices: [] },
        },
      },
      {
        message: "Do you have any discount for package?",
        expectedOutput: {
          intent: "price_inquiry",
          entities: { treatments: [], doctors: [], dates: [], prices: [] },
        },
      },
    ],
    baseWeight: 75,
  },
  {
    clinicId: null,
    key: "booking_request",
    label: "Booking Request",
    description:
      "The patient wants to book an appointment, schedule a visit, or register for a service. This includes any direct request to come in, fix a time, or make a reservation.",
    examples: [
      {
        message: "I want to book an appointment",
        expectedOutput: {
          intent: "booking_request",
          entities: { treatments: [], doctors: [], dates: [], prices: [] },
        },
      },
      {
        message: "Can I book for tomorrow?",
        expectedOutput: {
          intent: "booking_request",
          entities: { treatments: [], doctors: [], dates: ["tomorrow"], prices: [] },
        },
      },
      {
        message: "appointment chahiye",
        expectedOutput: {
          intent: "booking_request",
          entities: { treatments: [], doctors: [], dates: [], prices: [] },
        },
      },
      {
        message: "book karna hai kal ke liye",
        expectedOutput: {
          intent: "booking_request",
          entities: { treatments: [], doctors: [], dates: ["tomorrow"], prices: [] },
        },
      },
    ],
    baseWeight: 90,
  },
  {
    clinicId: null,
    key: "availability_check",
    label: "Availability Check",
    description:
      "The patient is checking whether a doctor, time slot, or service is available. They are not yet booking — they want to know if something is free or when the next opening is.",
    examples: [
      {
        message: "Is Dr. Priya available tomorrow morning?",
        expectedOutput: {
          intent: "availability_check",
          entities: {
            treatments: [],
            doctors: ["Dr. Priya"],
            dates: ["tomorrow", "morning"],
            prices: [],
          },
        },
      },
      {
        message: "Any slots available this week?",
        expectedOutput: {
          intent: "availability_check",
          entities: { treatments: [], doctors: [], dates: ["this week"], prices: [] },
        },
      },
      {
        message: "doctor kab available hai?",
        expectedOutput: {
          intent: "availability_check",
          entities: { treatments: [], doctors: [], dates: [], prices: [] },
        },
      },
    ],
    baseWeight: 80,
  },
  {
    clinicId: null,
    key: "treatment_inquiry",
    label: "Treatment Inquiry",
    description:
      "The patient is asking about what treatments or services the clinic offers. They want to know the available options, types of procedures, or details about a specific treatment.",
    examples: [
      {
        message: "What treatments do you offer?",
        expectedOutput: {
          intent: "treatment_inquiry",
          entities: { treatments: [], doctors: [], dates: [], prices: [] },
        },
      },
      {
        message: "Tell me about laser treatment",
        expectedOutput: {
          intent: "treatment_inquiry",
          entities: { treatments: ["laser"], doctors: [], dates: [], prices: [] },
        },
      },
      {
        message: "konsa treatment hai available?",
        expectedOutput: {
          intent: "treatment_inquiry",
          entities: { treatments: [], doctors: [], dates: [], prices: [] },
        },
      },
      {
        message: "Do you do botox or fillers?",
        expectedOutput: {
          intent: "treatment_inquiry",
          entities: { treatments: ["botox", "filler"], doctors: [], dates: [], prices: [] },
        },
      },
    ],
    baseWeight: 60,
  },
  {
    clinicId: null,
    key: "comparison",
    label: "Comparison",
    description:
      "The patient is comparing two or more treatments, services, or options. They want to know which is better, the difference between options, or help choosing.",
    examples: [
      {
        message: "Which is better, laser or facial?",
        expectedOutput: {
          intent: "comparison",
          entities: { treatments: ["laser", "facial"], doctors: [], dates: [], prices: [] },
        },
      },
      {
        message: "What is the difference between botox and filler?",
        expectedOutput: {
          intent: "comparison",
          entities: { treatments: ["botox", "filler"], doctors: [], dates: [], prices: [] },
        },
      },
      {
        message: "kaunsa behtar hai?",
        expectedOutput: {
          intent: "comparison",
          entities: { treatments: [], doctors: [], dates: [], prices: [] },
        },
      },
    ],
    baseWeight: 65,
  },
  {
    clinicId: null,
    key: "urgency_signal",
    label: "Urgent",
    description:
      "The patient is expressing urgency or immediacy. They want something done right now, ASAP, or today. This signals a high-priority lead that needs fast response.",
    examples: [
      {
        message: "I need an appointment ASAP",
        expectedOutput: {
          intent: "urgency_signal",
          entities: { treatments: [], doctors: [], dates: [], prices: [] },
        },
      },
      {
        message: "Can I come today itself?",
        expectedOutput: {
          intent: "urgency_signal",
          entities: { treatments: [], doctors: [], dates: ["today"], prices: [] },
        },
      },
      {
        message: "urgent hai, jaldi batao",
        expectedOutput: {
          intent: "urgency_signal",
          entities: { treatments: [], doctors: [], dates: [], prices: [] },
        },
      },
    ],
    baseWeight: 95,
  },
];

async function seed() {
  try {
    console.log("Connecting to database...");
    await dbConnect();
    console.log("Connected.\n");

    let created = 0;
    let updated = 0;

    for (const def of SEED_DATA) {
      // Upsert: create if not exists, skip if already exists
      const existing = await IntentDefinition.findOne({
        clinicId: def.clinicId,
        key: def.key,
      });

      if (existing) {
        console.log(`  SKIP  ${def.key} (already exists)`);
        continue;
      }

      await IntentDefinition.create(def);
      console.log(`  CREATED  ${def.key} — "${def.label}" (${def.examples.length} examples, weight: ${def.baseWeight})`);
      created++;
    }

    console.log(`\nDone. Created: ${created}, Skipped: ${updated}`);
    console.log("Next step: Run the generateRegexSuggestions job to populate regexPatterns.");
  } catch (err) {
    console.error("Seed failed:", err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    await mongoose.connection.close();
    console.log("Connection closed.");
    process.exit(0);
  }
}

seed();
