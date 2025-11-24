// pages/api/marketing/send-whatsapp.js
import axios from "axios";
import { sendMessageToClient } from "./ws-utils";

function isValidE164(number) {
  return /^\+[1-9]\d{1,14}$/.test(number);
}

function formatE164(num) {
  return num.startsWith("+") ? num : `+${num}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { to, message, id } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: "Missing phone number or message" });
  }

  const normalizedTo = formatE164(to);
  if (!isValidE164(normalizedTo)) {
    return res.status(400).json({ error: "Phone number must be in E.164 format" });
  }

  try {
    const WHATSAPP_API_URL = `https://graph.facebook.com/v20.0/743944485476313/messages`;
    const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: "whatsapp",
        to: normalizedTo,
        type: "text",
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    // ✅ Broadcast immediately to client
    sendMessageToClient(normalizedTo, {
      id: id || response.data.messages?.[0]?.id || `local-${Date.now()}`,
      from: "me",
      text: message,
      timestamp: Math.floor(Date.now() / 1000),
      status: "sent",
    });

    return res.status(200).json({ success: true, data: response.data });
  } catch (err) {
    console.error("❌ WhatsApp API Error:", err.response?.data || err.message);
    const errorMessage = err.response?.data?.error?.message || err.message;
    return res
      .status(err.response?.status || 500)
      .json({ success: false, error: errorMessage });
  }
}
