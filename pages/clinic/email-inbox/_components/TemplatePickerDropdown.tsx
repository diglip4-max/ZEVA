import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, ArrowLeft, FileText, Check, X } from "lucide-react";
import { Template } from "@/types/templates";
import QuickFieldPicker from "./QuickFieldPicker";

interface TemplatePickerDropdownProps {
  templates: Template[];
  onApply: (
    template: Template,
    filledSubject: string,
    filledBody: string,
  ) => void;
  onClose: () => void;
}

/**
 * Replaces the old fixed-position, backdrop-blurred "Templates" modal with
 * a compact dropdown anchored to the trigger button — consistent with
 * FromProviderSelect and the To-suggestions list already used in this
 * compose window, instead of a separate full-screen overlay.
 *
 * Two internal steps, both inside the same panel:
 *  1. search + pick a template
 *  2. fill any {{variables}} it needs, then Apply
 */
export default function TemplatePickerDropdown({
  templates,
  onApply,
  onClose,
}: TemplatePickerDropdownProps) {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Template | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        onClose();
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const emailOnly = (templates || []).filter(
      (t) => t.templateType === "email" && t.status === "approved",
    );
    if (!q) return emailOnly;
    return emailOnly.filter((t) =>
      `${t.name} ${t.subject || ""} ${t.content || ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [templates, search]);

  const selectTemplate = (t: Template) => {
    setActive(t);
    setVariables(
      (t.variables || []).reduce((acc, v) => ({ ...acc, [v]: "" }), {}),
    );
  };

  const buildFilledContent = (t: Template) => {
    let body = t.content || "";
    Object.entries(variables).forEach(([key, value]) => {
      if (!value) return;
      const token = key.startsWith("{{") ? key : `{{${key}}}`;
      body = body.replaceAll(token, value);
    });
    return { subject: t.subject || "", body };
  };

  const handleApply = () => {
    if (!active) return;
    const { subject, body } = buildFilledContent(active);
    onApply(active, subject, body);
  };

  const requiredVariables = active?.variables || [];
  const allFilled = requiredVariables.every((v) => variables[v]?.trim());

  return (
    <div className="pi-tpl-picker" ref={rootRef}>
      {!active ? (
        <>
          <div className="pi-tpl-picker-search">
            <Search size={14} />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search email templates…"
            />
          </div>
          <div className="pi-tpl-picker-list">
            {filtered.length === 0 && (
              <div className="pi-tpl-picker-empty">
                <FileText size={22} strokeWidth={1.3} />
                <div>No approved email templates found</div>
              </div>
            )}
            {filtered.map((t) => (
              <button
                key={t._id}
                type="button"
                className="pi-tpl-picker-item"
                onClick={() => selectTemplate(t)}
              >
                <div className="pi-tpl-picker-item-main">
                  <div className="pi-tpl-picker-item-name">{t.name}</div>
                  <div className="pi-tpl-picker-item-subject">
                    {t.subject || "(no subject)"}
                  </div>
                </div>
                {!!t.variables?.length && (
                  <span className="pi-tpl-picker-item-badge">
                    {t.variables.length} var{t.variables.length > 1 ? "s" : ""}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="pi-tpl-picker-detail">
          <div className="pi-tpl-picker-detail-header">
            <button
              type="button"
              className="pi-icon-btn subtle"
              onClick={() => setActive(null)}
              aria-label="Back"
            >
              <ArrowLeft size={14} />
            </button>
            <div className="pi-tpl-picker-detail-title">{active.name}</div>
            <button
              type="button"
              className="pi-icon-btn subtle"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>

          <div className="pi-tpl-picker-detail-subject">
            {active.subject || "(no subject)"}
          </div>

          {requiredVariables.length > 0 && (
            <div className="pi-tpl-picker-vars">
              {requiredVariables.map((v) => (
                <div key={v} className="pi-tpl-picker-var-row">
                  <span className="pi-tpl-picker-var-label">{v}</span>
                  <div className="pi-tpl-picker-var-input-wrap">
                    <input
                      value={variables[v] || ""}
                      onChange={(e) =>
                        setVariables((prev) => ({
                          ...prev,
                          [v]: e.target.value,
                        }))
                      }
                      placeholder={`Value for ${v}`}
                    />
                    <QuickFieldPicker
                      onSelect={(token) =>
                        setVariables((prev) => ({ ...prev, [v]: token }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="pi-tpl-picker-apply"
            onClick={handleApply}
            disabled={requiredVariables.length > 0 && !allFilled}
          >
            <Check size={14} />
            Apply template
          </button>
        </div>
      )}
    </div>
  );
}
