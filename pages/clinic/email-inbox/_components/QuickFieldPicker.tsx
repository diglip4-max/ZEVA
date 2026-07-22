import React, { useEffect, useRef, useState } from "react";
import { ListPlus } from "lucide-react";

/**
 * Lightweight stand-in for the automation-flow VariableMappingDropdown.
 * That component needs an `entity`/`nodeId` tied to a workflow node, which
 * doesn't exist in a plain inbox compose context — so this offers a small,
 * fixed set of common merge tokens instead. Swap the QUICK_FIELDS list out
 * (or wire this up to a real lead-fields endpoint) if you want it dynamic.
 */
const QUICK_FIELDS = [
  { label: "Lead name", value: "{{lead.name}}" },
  { label: "Lead email", value: "{{lead.email}}" },
  { label: "Lead phone", value: "{{lead.phone}}" },
  { label: "Clinic name", value: "{{system.clinicName}}" },
  { label: "Today's date", value: "{{system.date}}" },
  { label: "Current time", value: "{{system.time}}" },
];

interface QuickFieldPickerProps {
  onSelect: (token: string) => void;
}

export default function QuickFieldPicker({ onSelect }: QuickFieldPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="pi-qfp" ref={rootRef}>
      <button
        type="button"
        className="pi-icon-btn subtle"
        onClick={() => setOpen((o) => !o)}
        aria-label="Insert a merge field"
        title="Insert a merge field"
      >
        <ListPlus size={14} />
      </button>
      {open && (
        <div className="pi-qfp-menu">
          {QUICK_FIELDS.map((f) => (
            <button
              key={f.value}
              type="button"
              className="pi-qfp-item"
              onClick={() => {
                onSelect(f.value);
                setOpen(false);
              }}
            >
              <span>{f.label}</span>
              <span className="pi-qfp-token">{f.value}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
