import { useEffect, useMemo, useState, ReactElement } from "react";
import axios from "axios";
import {
  Plus,
  Trash2,
  Save,
  Eye,
  CheckCircle,
  XCircle,
  Sparkles,
  X,
  Search,
  FileText,
} from "lucide-react";
import {
  SCENARIO_GROUPS,
  scenarioLabel,
  BEHAVIOR_STYLE_OPTIONS,
} from "@/lib/scenarioLabels";
import ClinicLayout from "@/components/ClinicLayout";
import withClinicAuth from "@/components/withClinicAuth";
import { NextPageWithLayout } from "../_app";

const API_BASE = process.env.NEXT_PUBLIC_AGENT_URL;

type ScenarioRow = {
  scenario_key: string;
  has_template: boolean;
  template_text: string | null;
  is_enabled: boolean;
  clinic_id: string;
  updated_at?: string;
  updated_by?: string | null;
};

function getClinicToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("clinicToken") || sessionStorage.getItem("clinicToken")
  );
}

const KakaCustomizationPage: NextPageWithLayout = () => {
  const [token, setToken] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [behaviorStyle, setBehaviorStyle] = useState<string>("default");
  const [savingStyle, setSavingStyle] = useState(false);

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftEnabled, setDraftEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resettingAll, setResettingAll] = useState(false);

  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [stylePreviewResult, setStylePreviewResult] = useState<string | null>(
    null,
  );
  const [stylePreviewLoading, setStylePreviewLoading] = useState(false);
  const [stylePreviewError, setStylePreviewError] = useState<string | null>(
    null,
  );

  const [toast, setToast] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  useEffect(() => {
    setToken(getClinicToken());
  }, []);
  useEffect(() => {
    if (!token) return;
    loadAll();
  }, [token]);

  function showToast(kind: "success" | "error", text: string) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadAll() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [scenarioRes, styleRes] = await Promise.all([
        axios.get(`${API_BASE}/dashboard/scenarios`, {
          params: { clinicToken: token },
        }),
        axios.get(`${API_BASE}/dashboard/behavior-style`, {
          params: { clinicToken: token },
        }),
      ]);
      setScenarios(scenarioRes.data.scenarios || []);
      setBehaviorStyle(styleRes.data.behavior_style || "default");
    } catch (err: any) {
      setLoadError(
        err?.response?.data?.detail ||
          "Could not load KAKA customization settings.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const addedScenarios = useMemo(
    () => scenarios.filter((s) => s.has_template),
    [scenarios],
  );
  const availableScenarios = useMemo(
    () => scenarios.filter((s) => !s.has_template),
    [scenarios],
  );

  const filteredAvailableGroups = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return SCENARIO_GROUPS.map((group) => {
      const groupOptions = availableScenarios.filter((s) => {
        if (!group.keys.includes(s.scenario_key)) return false;
        if (!q) return true;
        return scenarioLabel(s.scenario_key).toLowerCase().includes(q);
      });
      return { ...group, options: groupOptions };
    }).filter((g) => g.options.length > 0);
  }, [availableScenarios, pickerSearch]);

  function openEditor(scenarioKey: string) {
    const existing = scenarios.find((s) => s.scenario_key === scenarioKey);
    setActiveKey(scenarioKey);
    setDraftText(existing?.template_text || "");
    setDraftEnabled(existing?.has_template ? existing.is_enabled : true);
    setPreviewResult(null);
    setPreviewError(null);
    setPickerOpen(false);
    setPickerSearch("");
  }

  function closeEditor() {
    setActiveKey(null);
    setDraftText("");
    setPreviewResult(null);
    setPreviewError(null);
  }

  function openPicker() {
    setPickerSearch("");
    setPickerOpen(true);
  }

  function closePicker() {
    setPickerOpen(false);
    setPickerSearch("");
  }

  async function saveBehaviorStyle(value: string) {
    setBehaviorStyle(value);
    setSavingStyle(true);
    try {
      await axios.post(`${API_BASE}/dashboard/behavior-style`, {
        clinicToken: token,
        behavior_style: value,
      });
      showToast("success", "Behavior style updated.");
    } catch (err: any) {
      showToast(
        "error",
        err?.response?.data?.detail || "Could not save behavior style.",
      );
    } finally {
      setSavingStyle(false);
    }
  }

  async function saveTemplate() {
    if (!activeKey) return;
    if (!draftText.trim()) {
      showToast("error", "Template text can't be empty.");
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${API_BASE}/dashboard/templates`, {
        clinicToken: token,
        scenario_key: activeKey,
        template_text: draftText,
        is_enabled: draftEnabled,
      });
      showToast("success", "Template saved.");
      await loadAll();
      closeEditor();
    } catch (err: any) {
      showToast(
        "error",
        err?.response?.data?.detail || "Could not save template.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(scenarioKey: string, nextEnabled: boolean) {
    try {
      await axios.patch(
        `${API_BASE}/dashboard/templates/${scenarioKey}/enable`,
        { clinicToken: token, is_enabled: nextEnabled },
      );
      setScenarios((prev) =>
        prev.map((s) =>
          s.scenario_key === scenarioKey
            ? { ...s, is_enabled: nextEnabled }
            : s,
        ),
      );
      showToast(
        "success",
        nextEnabled ? "Template enabled." : "Template disabled.",
      );
    } catch (err: any) {
      showToast(
        "error",
        err?.response?.data?.detail || "Could not update template.",
      );
    }
  }

  async function deleteTemplate() {
    if (!activeKey) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_BASE}/dashboard/templates/${activeKey}`, {
        params: { clinicToken: token },
      });
      showToast(
        "success",
        "Template removed. KAKA's default reply will be used.",
      );
      await loadAll();
      closeEditor();
    } catch (err: any) {
      showToast(
        "error",
        err?.response?.data?.detail || "Could not remove template.",
      );
    } finally {
      setDeleting(false);
    }
  }
  async function resetAllTemplates() {
    if (
      !confirm(
        "Remove all custom templates? KAKA will use its default replies for every scenario.",
      )
    )
      return;
    setResettingAll(true);
    try {
      await Promise.all(
        addedScenarios.map((s) =>
          axios.delete(`${API_BASE}/dashboard/templates/${s.scenario_key}`, {
            params: { clinicToken: token },
          }),
        ),
      );
      showToast("success", "All templates removed.");
      await loadAll();
    } catch (err: any) {
      showToast(
        "error",
        err?.response?.data?.detail || "Could not remove all templates.",
      );
    } finally {
      setResettingAll(false);
    }
  }

  async function runPreview() {
    if (!activeKey) return;
    if (!draftText.trim()) {
      setPreviewError("Write a template first.");
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewResult(null);
    try {
      const res = await axios.post(`${API_BASE}/dashboard/templates/preview`, {
        clinicToken: token,
        scenario_key: activeKey,
        template_text: draftText,
        behavior_style: behaviorStyle,
      });
      setPreviewResult(res.data.preview_message);
    } catch (err: any) {
      setPreviewError(err?.response?.data?.detail || "Preview failed.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function runStylePreview() {
    setStylePreviewLoading(true);
    setStylePreviewError(null);
    setStylePreviewResult(null);
    try {
      const res = await axios.post(`${API_BASE}/dashboard/templates/preview`, {
        clinicToken: token,
        scenario_key: "greeting",
        behavior_style: behaviorStyle,
      });
      setStylePreviewResult(res.data.preview_message);
    } catch (err: any) {
      setStylePreviewError(err?.response?.data?.detail || "Preview failed.");
    } finally {
      setStylePreviewLoading(false);
    }
  }

  if (!token) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: "#dceef0" }}
      >
        <div className="bg-white rounded-xl border border-[#aed4d9] p-8 max-w-md text-center shadow-sm">
          <p className="text-[#10262a] text-sm">
            Sign in to your clinic account to manage KAKA's responses.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen inter-font" style={{ background: "#dceef0" }}>
      {/* ── HERO (full width background, content aligned to shared container) ── */}
      <div
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #237079 0%, #145159 60%, #0a3338 100%)",
          borderRadius: "0 0 20px 20px",
          marginBottom: "2rem",
        }}
      >
        {/* grid overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* blobs */}
        <div
          className="absolute rounded-full"
          style={{
            width: 280,
            height: 280,
            background: "#5fd3e0",
            top: -80,
            right: -40,
            filter: "blur(55px)",
            opacity: 0.28,
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 180,
            height: 180,
            background: "#02282d",
            bottom: -50,
            left: "8%",
            filter: "blur(55px)",
            opacity: 0.35,
          }}
        />

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-10 flex flex-wrap items-start justify-between gap-6">
          <div className="flex-1 min-w-[240px]">
            {/* live badge */}
            <div
              className="inline-flex items-center gap-1.5 mb-4 text-xs font-medium text-white"
              style={{
                background: "rgba(255,255,255,.18)",
                border: "1px solid rgba(255,255,255,.3)",
                borderRadius: 20,
                padding: "4px 12px",
              }}
            >
              <span
                className="inline-block rounded-full"
                style={{
                  width: 7,
                  height: 7,
                  background: "#4ade80",
                  animation: "pulse 2s infinite",
                }}
              />
              KAKA Agent · Live
            </div>
            <h1
              className="text-2xl font-bold text-white mb-1"
              style={{ lineHeight: 1.2 }}
            >
              Response Customization
            </h1>
            <p
              className="text-sm"
              style={{
                color: "rgba(255,255,255,.78)",
                maxWidth: 460,
                lineHeight: 1.65,
              }}
            >
              Control how KAKA replies to patients. KAKA still handles bookings,
              rescheduling, and clinic facts — this only changes the wording and
              tone.
            </p>
          </div>

          {/* stats */}
          <div className="flex gap-3 flex-wrap items-start">
            {[
              { num: addedScenarios.length, label: "Templates" },
              {
                num: addedScenarios.filter((s) => s.is_enabled).length,
                label: "Active",
              },
              { num: scenarios.length, label: "Scenarios" },
            ].map((s) => (
              <div
                key={s.label}
                className="text-center"
                style={{
                  background: "rgba(255,255,255,.18)",
                  border: "1px solid rgba(255,255,255,.25)",
                  borderRadius: 12,
                  padding: ".8rem 1.2rem",
                  minWidth: 84,
                  backdropFilter: "blur(6px)",
                }}
              >
                <div className="text-2xl font-bold text-white">{s.num}</div>
                <div
                  className="text-xs mt-0.5"
                  style={{ color: "rgba(255,255,255,.7)" }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SHARED WIDTH CONTAINER for everything below the hero ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        {loadError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {loadError}
          </div>
        )}

        {/* ── BEHAVIOR STYLE SECTION ── */}
        <section
          className="mb-6 overflow-hidden"
          style={{
            borderRadius: 16,
            background: "linear-gradient(135deg, #a9dde3 0%, #8ccdd5 100%)",
            border: "1px solid rgba(15,80,87,.12)",
          }}
        >
          {/* header */}
          <div
            className="px-6 py-4"
            style={{
              background: "rgba(255,255,255,.4)",
              borderBottom: "1px solid rgba(15,80,87,.18)",
            }}
          >
            <h2
              className="text-sm font-bold flex items-center gap-2"
              style={{ color: "#072e32" }}
            >
              <Sparkles className="w-4 h-4" style={{ color: "#1f7a85" }} />
              Behavior Style
            </h2>
            <p
              className="text-xs mt-1"
              style={{ color: "#155059", lineHeight: 1.55 }}
            >
              Applies to every KAKA reply, even for scenarios with no custom
              template. Choose Default to leave KAKA's replies exactly as
              generated.
            </p>
          </div>

          <div className="px-6 py-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {BEHAVIOR_STYLE_OPTIONS.map((opt) => {
                const isSelected = behaviorStyle === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => saveBehaviorStyle(opt.value)}
                    disabled={savingStyle}
                    className="text-left transition-all duration-150"
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: isSelected
                        ? "2px solid #1f7a85"
                        : "2px solid rgba(255,255,255,0.7)",
                      background: isSelected
                        ? "rgba(255,255,255,.97)"
                        : "rgba(255,255,255,.55)",
                      boxShadow: isSelected
                        ? "0 4px 16px rgba(15,80,87,.3), 0 1px 4px rgba(0,0,0,.1)"
                        : "0 2px 8px rgba(0,0,0,.1), 0 1px 2px rgba(0,0,0,.05)",
                      cursor: "pointer",
                      transform: isSelected ? "translateY(-2px)" : "none",
                      backdropFilter: "blur(6px)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{
                          background: isSelected
                            ? "rgba(31,122,133,.18)"
                            : "rgba(31,122,133,.12)",
                          color: "#1f7a85",
                        }}
                      >
                        {opt.value === "default"
                          ? "D"
                          : opt.value === "professional"
                            ? "P"
                            : opt.value === "polite"
                              ? "Po"
                              : "L"}
                      </div>
                      {isSelected && (
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: "#1f7a85" }}
                        >
                          <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div
                      className="text-sm font-bold"
                      style={{ color: isSelected ? "#1f7a85" : "#072e32" }}
                    >
                      {opt.label}
                    </div>
                    <div
                      className="text-xs mt-0.5"
                      style={{ color: "#155059" }}
                    >
                      {opt.hint}
                    </div>
                  </button>
                );
              })}
            </div>

            {behaviorStyle !== "default" && (
              <div
                className="mt-4 pt-4"
                style={{ borderTop: "1px solid rgba(15,80,87,.18)" }}
              >
                <button
                  onClick={runStylePreview}
                  disabled={stylePreviewLoading}
                  className="flex items-center gap-1.5 text-sm font-semibold disabled:opacity-50"
                  style={{
                    color: "#0e5a63",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <Eye className="w-4 h-4" />
                  {stylePreviewLoading
                    ? "Generating preview…"
                    : "Preview a default KAKA reply in this style"}
                </button>
                {stylePreviewError && (
                  <div className="mt-2 text-xs text-red-600">
                    {stylePreviewError}
                  </div>
                )}
                {stylePreviewResult && (
                  <div
                    className="mt-3 p-3 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,.55)",
                      border: "1px solid rgba(15,80,87,.25)",
                    }}
                  >
                    <div
                      className="text-xs font-bold uppercase tracking-wider mb-2"
                      style={{ color: "#0e5a63", letterSpacing: ".06em" }}
                    >
                      Example: greeting with no custom template
                    </div>
                    <div
                      className="text-sm whitespace-pre-wrap inline-block px-3 py-2"
                      style={{
                        background: "#1f7a85",
                        color: "#fff",
                        borderRadius: "12px 12px 12px 2px",
                        lineHeight: 1.6,
                        maxWidth: "90%",
                      }}
                    >
                      {stylePreviewResult}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── CUSTOM TEMPLATES SECTION ── */}
        <section
          className="mb-6 overflow-hidden"
          style={{
            borderRadius: 16,
            background: "linear-gradient(135deg, #fbdfa9 0%, #f7cb7c 100%)",
            border: "1px solid rgba(120,53,15,.12)",
          }}
        >
          {/* header */}
          <div
            className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap"
            style={{
              background: "rgba(255,255,255,.4)",
              borderBottom: "1px solid rgba(180,83,9,.22)",
            }}
          >
            <div>
              <h2 className="text-sm font-bold" style={{ color: "#5c2a06" }}>
                Custom Templates
              </h2>
              <p
                className="text-xs mt-1"
                style={{ color: "#7a3a0a", lineHeight: 1.55 }}
              >
                Scenarios without a template use KAKA's default wording.
              </p>
            </div>

            {/* HEADER BUTTONS */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {addedScenarios.length > 0 && (
                <button
                  onClick={resetAllTemplates}
                  disabled={resettingAll}
                  className="flex items-center gap-1.5 text-sm font-semibold transition-all duration-150 disabled:opacity-60"
                  style={{
                    background: "rgba(220,38,38,.1)",
                    border: "1.5px solid rgba(220,38,38,.3)",
                    borderRadius: 10,
                    padding: "8px 16px",
                    color: "#dc2626",
                    cursor: resettingAll ? "not-allowed" : "pointer",
                  }}
                  onMouseEnter={(e) => {
                    if (!resettingAll)
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "rgba(220,38,38,.18)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(220,38,38,.1)";
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  {resettingAll ? "Resetting…" : "Reset all"}
                </button>
              )}
              <button
                onClick={openPicker}
                className="flex items-center gap-1.5 text-sm font-semibold text-white transition-all duration-150"
                style={{
                  background:
                    "linear-gradient(135deg, #c2660a 0%, #9c4407 100%)",
                  border: "none",
                  borderRadius: 10,
                  padding: "8px 16px",
                  cursor: "pointer",
                  boxShadow:
                    "0 3px 10px rgba(156,68,7,.45), 0 1px 3px rgba(0,0,0,.18)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    "0 5px 16px rgba(156,68,7,.55), 0 2px 6px rgba(0,0,0,.18)";
                  (e.currentTarget as HTMLButtonElement).style.transform =
                    "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    "0 3px 10px rgba(156,68,7,.45), 0 1px 3px rgba(0,0,0,.18)";
                  (e.currentTarget as HTMLButtonElement).style.transform =
                    "none";
                }}
              >
                <Plus className="w-4 h-4" />
                Add Template
              </button>
            </div>
          </div>

          <div className="px-6 py-5">
            {isLoading ? (
              <div
                className="text-sm py-6 text-center"
                style={{ color: "#7a3a0a" }}
              >
                Loading…
              </div>
            ) : addedScenarios.length === 0 ? (
              <div
                className="text-sm py-10 text-center rounded-xl"
                style={{
                  color: "#7a3a0a",
                  border: "2px dashed rgba(156,68,7,.35)",
                  background: "rgba(255,255,255,.35)",
                }}
              >
                No custom templates yet. Add one to change how KAKA replies for
                a specific scenario.
              </div>
            ) : (
              // CARD GRID instead of list rows
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {addedScenarios.map((s) => (
                  <div
                    key={s.scenario_key}
                    className="flex flex-col justify-between rounded-2xl p-4 transition-all duration-150"
                    style={{
                      background: "rgba(255,255,255,.7)",
                      border: "1.5px solid rgba(255,255,255,.8)",
                      boxShadow: "0 2px 10px rgba(0,0,0,.08)",
                      minHeight: 150,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.border =
                        "1.5px solid #c2660a";
                      (e.currentTarget as HTMLDivElement).style.boxShadow =
                        "0 0 0 3px rgba(194,102,10,.15), 0 4px 14px rgba(0,0,0,.1)";
                      (e.currentTarget as HTMLDivElement).style.transform =
                        "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.border =
                        "1.5px solid rgba(255,255,255,.8)";
                      (e.currentTarget as HTMLDivElement).style.boxShadow =
                        "0 2px 10px rgba(0,0,0,.08)";
                      (e.currentTarget as HTMLDivElement).style.transform =
                        "none";
                    }}
                  >
                    <button
                      onClick={() => openEditor(s.scenario_key)}
                      className="text-left flex-1 min-w-0"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            background: "rgba(194,102,10,.14)",
                            color: "#9c4407",
                          }}
                        >
                          <FileText className="w-4 h-4" />
                        </div>
                        <span
                          className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                          style={
                            s.is_enabled
                              ? { background: "#bdf0d8", color: "#054a32" }
                              : {
                                  background: "rgba(0,0,0,.1)",
                                  color: "#5b5f66",
                                }
                          }
                        >
                          {s.is_enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                      <div
                        className="text-sm font-bold mb-1"
                        style={{ color: "#5c2a06" }}
                      >
                        {scenarioLabel(s.scenario_key)}
                      </div>
                      <div
                        className="text-xs line-clamp-2"
                        style={{ color: "#7a3a0a", opacity: 0.85 }}
                      >
                        {s.template_text}
                      </div>
                    </button>

                    <div
                      className="flex items-center justify-between mt-3 pt-3"
                      style={{ borderTop: "1px solid rgba(156,68,7,.15)" }}
                    >
                      <span
                        className="text-xs font-semibold"
                        style={{ color: "#9c4407" }}
                      >
                        Toggle
                      </span>
                      {/* TOGGLE */}
                      <button
                        onClick={() =>
                          toggleEnabled(s.scenario_key, !s.is_enabled)
                        }
                        role="switch"
                        aria-checked={s.is_enabled}
                        style={{
                          position: "relative",
                          width: 42,
                          height: 24,
                          borderRadius: 12,
                          border: "none",
                          cursor: "pointer",
                          transition: "background .2s, box-shadow .2s",
                          background: s.is_enabled ? "#1f7a85" : "#8a93a0",
                          boxShadow: s.is_enabled
                            ? "0 2px 8px rgba(31,122,133,.5)"
                            : "0 2px 6px rgba(0,0,0,.2)",
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: 3,
                            left: 3,
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: "#fff",
                            transition: "transform .2s",
                            transform: s.is_enabled
                              ? "translateX(18px)"
                              : "translateX(0)",
                            boxShadow: "0 1px 3px rgba(0,0,0,.25)",
                          }}
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── ADD TEMPLATE DIALOG (replaces small dropdown) ── */}
      {pickerOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 px-4"
          style={{ background: "rgba(8,30,33,.5)" }}
          onClick={closePicker}
        >
          <div
            className="w-full flex flex-col"
            style={{
              background: "#fff",
              borderRadius: 18,
              border: "1px solid #aed4d9",
              maxWidth: 720,
              maxHeight: "85vh",
              boxShadow: "0 24px 70px rgba(10,40,44,.35)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* dialog header */}
            <div
              className="px-6 py-5 flex items-center justify-between flex-shrink-0"
              style={{
                background: "linear-gradient(90deg, #e3f4f6, #c9eaee)",
                borderBottom: "1px solid #aed4d9",
                borderRadius: "18px 18px 0 0",
              }}
            >
              <div>
                <h3
                  className="text-base font-bold"
                  style={{ color: "#072e32" }}
                >
                  Add a Template
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "#155059" }}>
                  Choose a scenario to write a custom KAKA reply for.
                </p>
              </div>
              <button
                onClick={closePicker}
                className="flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
                style={{
                  width: 32,
                  height: 32,
                  background: "rgba(31,122,133,.14)",
                  border: "none",
                  color: "#1f7a85",
                  cursor: "pointer",
                }}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* search */}
            <div
              className="px-6 py-3 flex-shrink-0"
              style={{ borderBottom: "1px solid #e0f0f2" }}
            >
              <div className="relative">
                <Search
                  className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "#5a9aa0" }}
                />
                <input
                  autoFocus
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Search scenarios…"
                  className="w-full text-sm"
                  style={{
                    border: "1.5px solid #c8e8ec",
                    borderRadius: 10,
                    padding: "9px 14px 9px 34px",
                    color: "#10262a",
                    background: "#f5fbfc",
                    outline: "none",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#1f7a85";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#c8e8ec";
                  }}
                />
              </div>
            </div>

            {/* scenario list, scrollable, plenty of room */}
            <div className="px-4 py-3 overflow-y-auto" style={{ flex: 1 }}>
              {availableScenarios.length === 0 ? (
                <div
                  className="p-6 text-sm text-center"
                  style={{ color: "#155059" }}
                >
                  Every scenario already has a template.
                </div>
              ) : filteredAvailableGroups.length === 0 ? (
                <div
                  className="p-6 text-sm text-center"
                  style={{ color: "#155059" }}
                >
                  No scenarios match "{pickerSearch}".
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2">
                  {filteredAvailableGroups.map((group) => (
                    <div key={group.label} className="contents">
                      <div
                        className="col-span-full px-2 pt-3 pb-1 text-xs font-bold uppercase tracking-wider"
                        style={{ color: "#1f7a85", letterSpacing: ".07em" }}
                      >
                        {group.label}
                      </div>
                      {group.options.map((s) => (
                        <button
                          key={s.scenario_key}
                          onClick={() => openEditor(s.scenario_key)}
                          className="text-left px-4 py-3 text-sm font-semibold rounded-xl transition-all"
                          style={{
                            color: "#10262a",
                            background: "#f5fbfc",
                            border: "1.5px solid #e0f0f2",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => {
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.background = "#e3f4f6";
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.borderColor = "#1f7a85";
                          }}
                          onMouseLeave={(e) => {
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.background = "#f5fbfc";
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.borderColor = "#e0f0f2";
                          }}
                        >
                          {scenarioLabel(s.scenario_key)}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── EDITOR MODAL ── */}
      {activeKey && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 px-4"
          style={{ background: "rgba(8,30,33,.5)" }}
        >
          <div
            className="w-full overflow-y-auto"
            style={{
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #aed4d9",
              maxWidth: 520,
              maxHeight: "90vh",
              boxShadow: "0 20px 60px rgba(10,40,44,.32)",
            }}
          >
            {/* modal header */}
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{
                background: "linear-gradient(90deg, #e3f4f6, #c9eaee)",
                borderBottom: "1px solid #aed4d9",
              }}
            >
              <h3 className="text-sm font-bold" style={{ color: "#072e32" }}>
                {scenarioLabel(activeKey)}
              </h3>
              <button
                onClick={closeEditor}
                className="text-xl leading-none flex items-center justify-center rounded-lg transition-colors"
                style={{
                  width: 28,
                  height: 28,
                  background: "rgba(31,122,133,.14)",
                  border: "none",
                  color: "#1f7a85",
                  cursor: "pointer",
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label
                  className="text-xs font-bold block mb-1.5"
                  style={{ color: "#072e32" }}
                >
                  Template text
                </label>
                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  rows={5}
                  placeholder="Dear patient, your appointment has been gracefully reserved..."
                  className="w-full text-sm resize-y"
                  style={{
                    border: "1.5px solid #a8dce2",
                    borderRadius: 10,
                    padding: "10px 14px",
                    color: "#0f2e31",
                    background: "#f5fbfc",
                    fontFamily: "inherit",
                    outline: "none",
                    lineHeight: 1.6,
                    minHeight: 110,
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#1f7a85";
                    e.target.style.boxShadow = "0 0 0 3px rgba(31,122,133,.15)";
                    e.target.style.background = "#fff";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#a8dce2";
                    e.target.style.boxShadow = "none";
                    e.target.style.background = "#f5fbfc";
                  }}
                />
                <p
                  className="text-xs mt-1"
                  style={{ color: "#357c82", lineHeight: 1.55 }}
                >
                  Write in the tone you want. KAKA's facts (dates, names,
                  prices) always stay accurate — this only changes the wording
                  around them.
                </p>
              </div>

              {/* enabled toggle */}
              <div className="flex items-center justify-between">
                <span
                  className="text-sm font-semibold"
                  style={{ color: "#0f2e31" }}
                >
                  Enabled
                </span>
                <button
                  onClick={() => setDraftEnabled((v) => !v)}
                  role="switch"
                  aria-checked={draftEnabled}
                  style={{
                    position: "relative",
                    width: 42,
                    height: 24,
                    borderRadius: 12,
                    border: "none",
                    cursor: "pointer",
                    transition: "background .2s, box-shadow .2s",
                    background: draftEnabled ? "#1f7a85" : "#8a93a0",
                    boxShadow: draftEnabled
                      ? "0 2px 8px rgba(31,122,133,.5)"
                      : "0 2px 6px rgba(0,0,0,.2)",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 3,
                      left: 3,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "#fff",
                      transition: "transform .2s",
                      transform: draftEnabled
                        ? "translateX(18px)"
                        : "translateX(0)",
                      boxShadow: "0 1px 3px rgba(0,0,0,.25)",
                    }}
                  />
                </button>
              </div>

              {/* preview */}
              <div
                style={{ borderTop: "1px solid #d8edf0", paddingTop: "1rem" }}
              >
                <button
                  onClick={runPreview}
                  disabled={previewLoading}
                  className="flex items-center gap-1.5 text-sm font-semibold disabled:opacity-50"
                  style={{
                    color: "#0e5a63",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <Eye className="w-4 h-4" />
                  {previewLoading ? "Generating preview…" : "Preview"}
                </button>
                {previewError && (
                  <div className="mt-2 text-xs text-red-600">
                    {previewError}
                  </div>
                )}
                {previewResult && (
                  <div
                    className="mt-3 p-3 rounded-xl"
                    style={{
                      background: "#e3f4f6",
                      border: "1px solid #a8dce2",
                    }}
                  >
                    <div
                      className="text-xs font-bold uppercase tracking-wider mb-1.5"
                      style={{ color: "#0e5a63", letterSpacing: ".06em" }}
                    >
                      What a patient would see
                    </div>
                    <div
                      className="text-sm whitespace-pre-wrap inline-block px-3 py-2"
                      style={{
                        background: "#1f7a85",
                        color: "#fff",
                        borderRadius: "12px 12px 12px 2px",
                        lineHeight: 1.6,
                        maxWidth: "90%",
                      }}
                    >
                      {previewResult}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* modal footer */}
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderTop: "1px solid #d8edf0", background: "#f5fbfc" }}
            >
              <button
                onClick={deleteTemplate}
                disabled={deleting}
                className="flex items-center gap-1.5 text-sm font-semibold disabled:opacity-50"
                style={{
                  color: "#dc2626",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Trash2 className="w-4 h-4" />
                Reset to default
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={closeEditor}
                  className="text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                  style={{
                    background: "#fff",
                    border: "1.5px solid #aed4d9",
                    color: "#10262a",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveTemplate}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-50 transition-all"
                  style={{
                    background:
                      "linear-gradient(135deg, #1f7a85 0%, #0e5a63 100%)",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 3px 10px rgba(31,122,133,.5)",
                  }}
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div
          className="fixed bottom-5 right-5 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold z-50"
          style={{
            background: "#fff",
            border:
              toast.kind === "success"
                ? "1px solid #a8dce2"
                : "1px solid #fca5a5",
            boxShadow: "0 4px 20px rgba(15,80,87,.25)",
            color: "#10262a",
          }}
        >
          {toast.kind === "success" ? (
            <CheckCircle className="w-4 h-4" style={{ color: "#1f7a85" }} />
          ) : (
            <XCircle className="w-4 h-4 text-red-500" />
          )}
          {toast.text}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .6; transform: scale(.85); }
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

KakaCustomizationPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

const ProtectedKakaCustomizationPage = withClinicAuth(
  KakaCustomizationPage,
) as NextPageWithLayout;
ProtectedKakaCustomizationPage.getLayout = KakaCustomizationPage.getLayout;
export default ProtectedKakaCustomizationPage;
