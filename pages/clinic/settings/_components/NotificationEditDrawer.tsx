import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Lock,
  //   MessageSquareText,
  Package,
  Plus,
  Radio,
  SlidersHorizontal,
  Target,
  X,
} from "lucide-react";
import { getTokenByPath } from "@/lib/helper"; // adjust to your actual helper path
import useProvider from "@/hooks/useProvider"; // adjust to your actual hook path
import NotificationChannelCard, {
  NotificationChannel,
} from "./NotificationChannelCard";
import { CH_META, Toggle } from "./NotificationSettingsTab"; // adjust: wherever CH_META currently lives
import { catMeta } from "./NotificationSettingsTab"; // adjust to your actual helper paths
import type {
  Notification,
  ChannelId,
  TimingMode,
} from "./NotificationSettingsTab"; // adjust to your actual types file

interface TemplateLite {
  _id: string;
  name: string;
  content: string;
  templateType: string;
  status: string;
  provider?: { _id: string };
}

function NotificationEditDrawer({
  notif,
  open,
  isSaving,
  onClose,
  onSave,
}: {
  notif: Notification | null;
  open: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: (draft: Notification) => void;
}) {
  const [draft, setDraft] = useState<Notification | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const [templates, setTemplates] = useState<TemplateLite[]>([]);

  const [isTimingModeOpen, setIsTimingModeOpen] = useState(false);
  const timingModeRef = React.useRef<HTMLDivElement>(null);

  const { whatsappProviders, smsProviders, emailProviders } = useProvider();

  // Flatten providers into one list, tagged by channel type, so the card
  // can filter by `ch.channel` regardless of which channel it represents.
  const allProviders = [
    ...whatsappProviders.map((p: any) => ({ ...p, type: ["whatsapp"] })),
    ...smsProviders.map((p: any) => ({ ...p, type: ["sms"] })),
    ...emailProviders.map((p: any) => ({ ...p, type: ["email"] })),
  ];

  const fetchTemplates = useCallback(async () => {
    try {
      const token = getTokenByPath();
      const { data } = await axios.get(`/api/all-templates?limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setTemplates(data.templates || []);
    } catch (err) {
      console.error("Error fetching templates:", err);
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        timingModeRef.current &&
        !timingModeRef.current.contains(e.target as Node)
      ) {
        setIsTimingModeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (notif) setDraft(JSON.parse(JSON.stringify(notif)));
    setConfirmOff(false);
  }, [notif?.id]);

  const set = (patch: Partial<Notification>) =>
    setDraft((d) => d && { ...d, ...patch });

  const setChannel = (idx: number, patch: Partial<NotificationChannel>) =>
    setDraft((d: any) => {
      if (!d) return d;
      const channels = d.channels.map((c: any, i: number) =>
        i === idx ? { ...c, ...patch } : c,
      );
      return { ...d, channels };
    });

  const addChannel = () => {
    if (!draft) return;
    const existing = new Set(draft.channels.map((c) => c.channel));
    const next = Object.keys(CH_META).find(
      (k) => !existing.has(k as ChannelId),
    ) as ChannelId | undefined;
    if (!next) return;
    setDraft((d: any) => {
      if (!d) return null;
      const newChannel: NotificationChannel = {
        channel: next,
        isEnabled: false,
        recipient: "patient",
        priority: d.channels.length + 1,
        templateId: null,
        providerId: null,
        attachments: [],
        mediaUrl: null,
        mediaType: null,
        variableMappings: {},
        headerVariableMappings: {},
        buttonVariableMappings: {},
      };
      return { ...d, channels: [...d.channels, newChannel] };
    });
  };

  const removeChannel = (idx: number) =>
    setDraft((d) => {
      if (!d) return null;
      return {
        ...d,
        channels: d.channels
          .filter((_, i) => i !== idx)
          .map((c, i) => ({ ...c, priority: i + 1 })),
      };
    });

  const moveChannel = (idx: number, dir: -1 | 1) =>
    setDraft((d) => {
      if (!d) return null;
      const target = idx + dir;
      if (target < 0 || target >= d.channels.length) return d;
      const channels = [...d.channels];
      [channels[idx], channels[target]] = [channels[target], channels[idx]];
      const reindexed = channels.map((c, i) => ({ ...c, priority: i + 1 }));
      return { ...d, channels: reindexed };
    });

  const requestMasterToggle = () => {
    if (draft?.isEnabled && draft?.isProtected) {
      setConfirmOff(true);
      return;
    }
    set({ isEnabled: !draft?.isEnabled });
  };

  const cat = draft ? catMeta(draft.category) : null;
  const CatIcon = cat ? cat.icon : Package;

  return (
    <>
      <div
        className={`fixed inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity duration-300 z-40 ${
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed top-0 right-0 h-full w-full sm:w-[720px] bg-surface border-l border-border shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-50 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {draft && (
          <>
            <div className="flex items-start gap-3.5 p-5 sm:p-6 flex-shrink-0 border-b border-border bg-surface-2">
              <span
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border shadow-2xs"
                style={{
                  background: "var(--surface-3)",
                  borderColor: `${cat!.color}40`,
                  color: cat!.color,
                }}
              >
                <CatIcon size={20} />
              </span>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold m-0 font-display text-text-hi">
                    {draft.label}
                  </h3>
                  {draft.isProtected && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-danger-bg text-danger border border-danger-border">
                      <Lock size={9} /> Protected
                    </span>
                  )}
                </div>
                <div className="text-xs font-medium mt-1 text-text-lo">
                  {cat!.name}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-surface-3 border border-border text-text-md hover:text-text-hi hover:bg-surface-4 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto flex-1 text-text-hi space-y-6">
              <div className="flex items-center justify-between rounded-xl p-4 bg-surface-2 border border-border shadow-xs">
                <div>
                  <div className="text-sm font-semibold">
                    Notification enabled
                  </div>
                  <div className="text-xs mt-0.5 text-text-lo">
                    {draft.isEnabled ? "Currently active" : "Currently off"}
                  </div>
                </div>
                <Toggle on={draft.isEnabled} onClick={requestMasterToggle} />
              </div>

              {confirmOff && (
                <div className="rounded-xl p-4 text-xs bg-danger-bg border border-danger-border text-danger">
                  <div className="font-bold mb-1">
                    This notification is protected
                  </div>
                  <div className="mb-3 text-text-md">
                    It carries critical information patients rely on. Are you
                    sure you want to turn it off?
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmOff(false)}
                      className="px-3 py-1.5 rounded-lg bg-surface-3 border border-border text-xs font-semibold"
                    >
                      Keep it on
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        set({ isEnabled: false });
                        setConfirmOff(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-danger text-white text-xs font-semibold"
                    >
                      Turn off anyway
                    </button>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 text-sm font-bold mb-3">
                  <Target size={15} /> Trigger
                </div>
                <div className="w-full rounded-xl p-3.5 text-sm bg-surface-2 border border-border text-text-md font-medium leading-relaxed">
                  {draft.trigger}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm font-bold mb-3">
                  <Clock size={15} /> Timing
                </div>
                <div className="flex gap-2.5 flex-wrap">
                  <div
                    className="relative flex-1 min-w-[150px]"
                    ref={timingModeRef}
                  >
                    <div
                      onClick={() => setIsTimingModeOpen(!isTimingModeOpen)}
                      className={fieldSelectClass}
                    >
                      <span className="truncate">
                        {draft.timingMode === "immediate"
                          ? "Immediately"
                          : draft.timingMode === "before_event"
                            ? "Before event"
                            : "After event"}
                      </span>
                      <ChevronDown
                        size={13}
                        className={`flex-shrink-0 transition-transform ${isTimingModeOpen ? "rotate-180" : ""}`}
                      />
                    </div>

                    {isTimingModeOpen && (
                      <div className="absolute z-20 w-full mt-1.5 bg-surface-2 border border-border rounded-xl shadow-2xl overflow-hidden">
                        <ul className="py-1">
                          {[
                            {
                              value: "immediate" as TimingMode,
                              label: "Immediately",
                            },
                            {
                              value: "before_event" as TimingMode,
                              label: "Before event",
                            },
                            {
                              value: "after_event" as TimingMode,
                              label: "After event",
                            },
                          ].map((opt) => (
                            <li
                              key={opt.value}
                              onClick={() => {
                                set({ timingMode: opt.value });
                                setIsTimingModeOpen(false);
                              }}
                              className={`px-3 py-2 text-xs cursor-pointer hover:bg-surface-3 flex items-center justify-between gap-2 ${
                                draft.timingMode === opt.value
                                  ? "bg-surface-4"
                                  : ""
                              }`}
                            >
                              <span className="font-semibold text-text-hi">
                                {opt.label}
                              </span>
                              {draft.timingMode === opt.value && (
                                <CheckCircle2
                                  size={13}
                                  className="text-primary flex-shrink-0"
                                />
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {draft.timingMode !== "immediate" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={draft.offsetMinutes}
                        onChange={(e) =>
                          set({ offsetMinutes: Number(e.target.value) })
                        }
                        className="rounded-xl px-3.5 py-2.5 text-sm font-medium w-[95px] bg-surface-2 border border-border text-text-hi focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                      />
                      <span className="text-xs font-semibold text-text-lo">
                        minutes
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Channels — column-wise card grid, each with its own provider/template/preview */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Radio size={15} /> Channels
                  </div>
                  {draft.channels.length < Object.keys(CH_META).length && (
                    <button
                      type="button"
                      onClick={addChannel}
                      className="text-xs font-bold flex items-center gap-1 text-primary hover:underline cursor-pointer"
                    >
                      <Plus size={13} /> Add channel
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3.5">
                  {draft.channels.map((ch, idx) => (
                    <NotificationChannelCard
                      key={ch.channel}
                      ch={ch as any}
                      index={idx}
                      total={draft.channels.length}
                      providers={allProviders}
                      templates={templates}
                      sample={draft.sample}
                      fallbackTemplate={draft.template}
                      onChange={(patch) => setChannel(idx, patch)}
                      onRemove={() => removeChannel(idx)}
                      onMoveUp={() => moveChannel(idx, -1)}
                      onMoveDown={() => moveChannel(idx, 1)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm font-bold mb-3">
                  <SlidersHorizontal size={15} /> Rules
                </div>
                <div className="rounded-xl overflow-hidden border border-border bg-surface-2">
                  <div className="flex items-center justify-between px-3.5 py-3.5 bg-surface-2 border-b border-border">
                    <span className="text-xs font-semibold text-text-md">
                      Bypass quiet hours
                    </span>
                    <input
                      type="checkbox"
                      checked={draft.bypassQuietHours}
                      onChange={() =>
                        set({ bypassQuietHours: !draft.bypassQuietHours })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-3.5 bg-surface-2 border-b border-border">
                    <span className="text-xs font-semibold text-text-md">
                      Prevent duplicate for same event
                    </span>
                    <input
                      type="checkbox"
                      checked={draft.preventDuplicate}
                      onChange={() =>
                        set({ preventDuplicate: !draft.preventDuplicate })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-3.5 bg-surface-2">
                    <span className="text-xs font-semibold text-text-md">
                      Respect marketing preference
                    </span>
                    <input
                      type="checkbox"
                      checked={draft.respectMarketing}
                      onChange={() =>
                        set({ respectMarketing: !draft.respectMarketing })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* <div>
                <div className="flex items-center gap-2 text-sm font-bold mb-3">
                  <MessageSquareText size={15} /> Default message template
                </div>
                <div className="text-[11px] text-text-lo mb-2 -mt-2">
                  Used as a fallback for any channel that doesn't have its own
                  template selected.
                </div>
                <textarea
                  value={draft.template}
                  onChange={(e) => set({ template: e.target.value })}
                  rows={4}
                  className="w-full rounded-xl p-3.5 text-sm resize-none bg-surface-2 border border-border text-text-hi font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div> */}
            </div>

            <div className="p-4 sm:p-5 flex gap-3 flex-shrink-0 border-t border-border bg-surface-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-surface-3 border border-border text-text-hi"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onSave(draft)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white flex items-center justify-center gap-2"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <Check size={15} />
                    Save changes
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

export default NotificationEditDrawer;

// Shared style for every select-like field (native or custom dropdown trigger)
// so Send to / Provider / Template all look identical.
const fieldSelectClass =
  "w-full text-xs font-semibold rounded-lg px-2.5 py-2 bg-surface-3 border border-border text-text-hi flex items-center justify-between gap-2 cursor-pointer hover:border-primary/40 transition-colors min-w-0 focus:outline-none focus:ring-2 focus:ring-primary/40";
