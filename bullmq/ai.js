/*
 * GENERATE AI RESPONSE BY AI COMPOSER ACTION
 * USES OPENAI CHAT COMPLETIONS API
 */

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate an AI response using the OpenAI Chat Completions API.
 *
 * @param {object} payload
 * @param {string} payload.prompt       - The user prompt to send
 * @param {string} payload.model        - OpenAI model ID (e.g. "gpt-4o", "gpt-3.5-turbo")
 * @param {number} payload.temperature  - Sampling temperature (0.0 - 2.0)
 * @param {string} payload.outputKey    - Key name to label the result in the returned object
 * @returns {Promise<{[outputKey]: string} | null>}
 */
export const generateAiResponse = async (payload) => {
  const { prompt, model, temperature, outputKey } = payload;

  if (!prompt || !model || temperature === undefined || !outputKey) {
    console.error("generateAiResponse: missing required fields", payload);
    return null;
  }

  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: parseFloat(temperature),
      messages: [{ role: "user", content: prompt }],
    });

    const text = completion.choices?.[0]?.message?.content?.trim() ?? "";
    return { [outputKey]: text };
  } catch (error) {
    console.error("Error generating AI response:", error.message);
    throw error;
  }
};
