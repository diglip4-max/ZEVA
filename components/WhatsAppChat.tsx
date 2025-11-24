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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden flex flex-col h-[500px] relative">
        {/* Header */}
        <div className="bg-[#128C7E] text-white px-4 py-3 flex items-center justify-between shadow-md">
          <h2 className="text-base font-medium">{leadName}</h2>
          <button onClick={onClose} className="p-1 text-lg font-bold">✖</button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 bg-[#e5ddd5]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex mb-3 ${msg.from === "me" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`px-3 py-2 rounded-lg shadow-sm text-sm max-w-[85%] ${msg.from === "me" ? "bg-[#dcf8c6]" : "bg-white"}`}
              >
                <p>{msg.text}</p>
                <div className="flex items-center justify-end mt-1 space-x-1 text-xs text-gray-500">
                  <span>{msg.time}</span>
                  {msg.from === "me" && msg.status && (
                    <span className={msg.status === "read" ? "text-blue-500" : "text-gray-500"}>
                      {msg.status === "sent" && "✓"}
                      {msg.status === "delivered" && "✓✓"}
                      {msg.status === "read" && "✓✓"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef}></div>
        </div>

        {/* Input */}
        <div className="bg-[#f0f0f0] p-3 flex space-x-2">
          <textarea
            className="flex-1 p-2 rounded border resize-none focus:outline-none focus:ring-1 focus:ring-[#128C7E]"
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
            className="bg-[#128C7E] text-white px-3 py-2 rounded shadow-md hover:bg-[#0f785f] transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppChat;
