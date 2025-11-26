import React, { useState, useRef, useEffect } from "react";

interface WhatsAppChatProps {
  isOpen: boolean;
  onClose: () => void;
  leadName: string;
  phoneNumber: string;
}

interface Message {
  id: string;
  from: "me" | "lead";
  text: string;
  time: string;
  status?: "sent" | "delivered" | "read";
}

const WhatsAppChat: React.FC<WhatsAppChatProps> = ({
  isOpen,
  onClose,
  leadName,
  phoneNumber,
}) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Remove '+' for consistent backend comparison
  const normalizePhone = (num: string) => num.replace(/\+/g, "");
  const leadNumber = normalizePhone(phoneNumber);

  const formatTime = (ts?: string) =>
    ts
      ? new Date(parseInt(ts) * 1000).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const getWsUrl = () =>
    process.env.NODE_ENV === "development"
      ? "ws://localhost:3000"
      : "wss://your-production-ws-url";

  // WebSocket connection
  useEffect(() => {
    if (!isOpen) return;

    wsRef.current = new WebSocket(getWsUrl());

    wsRef.current.onopen = () => {
      console.log("✅ WS connected");
      wsRef.current?.send(JSON.stringify({ phoneNumber: leadNumber }));
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        const from = data.from ? normalizePhone(data.from) : null;
        const to = data.to ? normalizePhone(data.to) : null;
        const recipient = data.recipient_id ? normalizePhone(data.recipient_id) : null;

        // Only process messages relevant to this lead
        const isRelevant =
          from === leadNumber || to === leadNumber || recipient === leadNumber;
        if (!isRelevant) return;

        // Incoming message
        if (data.text || data.text?.body) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.id)) return prev;
            return [
              ...prev,
              {
                id: data.id || Date.now().toString(),
                from: from === leadNumber ? "lead" : "me",
                text: typeof data.text === "string" ? data.text : data.text?.body || "",
                time: formatTime(data.timestamp),
                status: data.status,
              },
            ];
          });
        }

        // Status update
        if (data.status && data.id) {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === data.id ? { ...msg, status: data.status } : msg))
          );
        }
      } catch (err) {
        console.error("❌ WS parse error:", err);
      }
    };

    wsRef.current.onerror = (err) => console.error("❌ WS error:", err);
    wsRef.current.onclose = (e) => console.log("❌ WS closed:", e.reason);

    return () => wsRef.current?.close();
  }, [isOpen, leadNumber]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const handleSend = async () => {
    if (!message.trim()) return;
    const newId = Date.now().toString();
    const newMsg: Message = {
      id: newId,
      from: "me",
      text: message.trim(),
      time: formatTime(),
      status: "sent",
    };
    setMessages((prev) => [...prev, newMsg]);
    setMessage("");

    try {
      await fetch("/api/marketing/send-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: leadNumber,
          message: newMsg.text,
          id: newMsg.id,
        }),
      });
    } catch (err) {
      console.error("❌ Failed to send message:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
        <div className="grid h-[600px] grid-cols-1 lg:grid-cols-[2fr_1fr]">
          {/* Chat Surface */}
          <div className="flex h-full flex-col bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-900 text-white">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-lg font-semibold text-white">
                  {leadName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold">{leadName}</p>
                  <p className="text-xs text-emerald-200">{phoneNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.open(`https://wa.me/${leadNumber}`, "_blank")}
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                >
                  Open WhatsApp
                </button>
                <button
                  onClick={onClose}
                  className="rounded-full bg-white/10 p-2 text-sm font-semibold text-white hover:bg-white/20"
                  aria-label="Close chat"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_rgba(15,23,42,0.9))] px-6 py-4">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center text-sm text-white/70">
                  <p>No messages yet</p>
                  <p className="text-xs text-white/50">Start the conversation from the panel below.</p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`mb-3 flex ${msg.from === "me" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-lg ${
                      msg.from === "me"
                        ? "bg-gradient-to-r from-emerald-400 to-emerald-500 text-emerald-950"
                        : "bg-white/90 text-slate-900"
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.text}</p>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] uppercase tracking-wide text-slate-500">
                      <span>{msg.time}</span>
                      {msg.from === "me" && msg.status && (
                        <span className={`flex items-center ${msg.status === "read" ? "text-blue-500" : "text-slate-400"}`}>
                          {msg.status === "sent" && "✓"}
                          {msg.status === "delivered" && "✓✓"}
                          {msg.status === "read" && "✓✓"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex items-center gap-3 border-t border-white/10 bg-slate-900/70 px-5 py-4">
              <button
                className="rounded-full border border-white/20 bg-white/5 p-2 text-white hover:bg-white/10"
                title="Add attachment (mock)"
                type="button"
              >
                📎
              </button>
              <textarea
                className="flex-1 resize-none rounded-2xl border border-transparent bg-white/10 px-4 py-2 text-sm text-white placeholder:text-white/50 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                rows={1}
                value={message}
                placeholder="Type a message..."
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    await handleSend();
                  }
                }}
              />
              <button
                onClick={handleSend}
                className="inline-flex items-center rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300"
              >
                Send
              </button>
            </div>
          </div>

          {/* Lead summary */}
          <div className="hidden h-full flex-col border-l border-gray-100 bg-white p-5 lg:flex">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Assigned to</p>
              <p className="mt-1">{leadName}</p>
              <p className="text-xs text-gray-500">{phoneNumber}</p>
            </div>

            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Phone actions</p>
                <div className="mt-2 flex gap-2 text-xs">
                  <button
                    onClick={() => navigator.clipboard.writeText(phoneNumber)}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    Copy number
                  </button>
                  <button
                    onClick={() => window.open(`tel:${phoneNumber}`, "_blank")}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    Call
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Smart reply</p>
                <div className="mt-2 flex flex-col gap-2 text-xs">
                  {["We received your inquiry.", "Can we schedule a call?", "Sharing treatment details now."].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setMessage((prev) => (prev ? `${prev}\n${preset}` : preset))}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-left text-gray-800 hover:bg-gray-50"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Messages are routed through your verified WhatsApp business account. Status indicators update in real time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppChat;
