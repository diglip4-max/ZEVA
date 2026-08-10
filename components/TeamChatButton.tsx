"use client";

import { useState } from "react";
import { MessageSquare, Loader2 } from "lucide-react";
import { getTokenByPath } from "@/lib/helper";
import axios from "axios";

const TeamChatButton = () => {
  const token = getTokenByPath();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      const { data } = await axios.post(
        "/api/zeva-connect/create-ticket",
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!data.redirectUrl) throw new Error("Failed to create ticket");

      const { redirectUrl } = data;

      // naye tab me kholna ya same tab me redirect - business decision hai
      window.open(redirectUrl, "_blank"); // naya tab
      // window.location.href = redirectUrl; // same tab
    } catch (err) {
      console.error(err);
      alert("Could not open Team Chat. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="flex items-center gap-2 rounded-lg bg-[#007bff] px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MessageSquare className="h-4 w-4" />
      )}
      Team Chat
    </button>
  );
};

export default TeamChatButton;
