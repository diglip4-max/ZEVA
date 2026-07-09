import React from "react";
import { Check } from "lucide-react";

export default function EmailToast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="pi-toast">
      <Check size={15} />
      {message}
    </div>
  );
}
