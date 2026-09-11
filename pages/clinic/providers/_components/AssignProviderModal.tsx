import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Users,
  Check,
  Search,
  Phone,
  Mail,
  Stethoscope,
} from "lucide-react";
import { getTokenByPath } from "@/lib/helper";
import axios from "axios";
import { Provider } from "@/types/conversations";
import toast from "react-hot-toast";

interface AssignProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: Provider | null;
  onSuccess: () => void;
}

interface Agent {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  clinicId?: string;
}

const formatRole = (role?: string) => {
  if (!role) return "";
  return role
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

// Deterministic avatar accent per agent, cycling through a small clinical palette
const AVATAR_PALETTE = [
  { bg: "#F0FDFA", fg: "#0F766E" }, // teal
  { bg: "#EFF6FF", fg: "#1D4ED8" }, // blue
  { bg: "#FAF5FF", fg: "#7E22CE" }, // violet
  { bg: "#FFF7ED", fg: "#C2410C" }, // amber
  { bg: "#F0FDF4", fg: "#15803D" }, // green
];

const getAvatarColor = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++)
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

const AssignProviderModal: React.FC<AssignProviderModalProps> = ({
  isOpen,
  onClose,
  provider,
  onSuccess,
}) => {
  const token = getTokenByPath();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  // Fetch agents
  useEffect(() => {
    const fetchAgents = async () => {
      if (!isOpen || !token) return;
      try {
        setLoading(true);
        const { data } = await axios.get(`/api/lead-ms/get-agents-options`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (data.success && data?.agents?.length) {
          setAgents(data?.agents || []);
        }
      } catch (error) {
        console.error("Error fetching agents:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, [isOpen, token]);

  // Initialize selected agents from provider
  useEffect(() => {
    if (provider && provider?.owners?.length) {
      const existing = provider?.owners.map((owner: any) =>
        typeof owner === "object" ? owner._id : owner,
      );
      setSelectedAgents(existing);
    } else {
      setSelectedAgents([]);
    }
  }, [provider]);

  // Reset search whenever the modal closes
  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen]);

  const handleToggleAgent = (agentId: string) => {
    setSelectedAgents((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId],
    );
  };

  const filteredAgents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.phone?.toLowerCase().includes(q),
    );
  }, [agents, query]);

  const handleSave = async () => {
    if (!provider) return;
    try {
      setSaving(true);
      const { data } = await axios.post(
        `/api/providers/${provider._id}/assign`,
        { userIds: selectedAgents },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (data.success) {
        toast.success("Provider assigned successfully!");
        onSuccess();
        onClose();
      }
    } catch (error: any) {
      console.error("Error assigning provider:", error);
      toast.error(
        error?.response?.data?.message || "Failed to assign provider",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(15,23,42,0.3)] overflow-hidden border border-slate-100 animate-[modalIn_0.18s_ease-out]">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
                Assign provider
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Choose who handles this provider&apos;s leads
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 -mr-1.5 -mt-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center text-xs font-semibold shrink-0">
              {provider?.label?.charAt(0)?.toUpperCase() || "P"}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-slate-900 text-sm truncate">
                {provider?.label}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {provider?.name} · {provider?.type.join(", ")}
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 pt-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search agents by name, email or phone"
              className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 transition-colors"
            />
          </div>
          <div className="flex items-center justify-between mt-3 mb-1 px-0.5">
            <span className="text-xs font-medium text-slate-500">
              {loading
                ? "Loading agents…"
                : `${filteredAgents.length} of ${agents.length} agent${agents.length === 1 ? "" : "s"}`}
            </span>
            <span className="text-xs font-medium text-teal-700">
              {selectedAgents.length} selected
            </span>
          </div>
        </div>

        {/* Agent list */}
        <div className="px-6 pb-2">
          {loading ? (
            <div className="text-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-200 border-t-teal-700 mx-auto mb-3"></div>
              <p className="text-sm text-slate-500">Loading agents…</p>
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-10">
              <Users className="w-9 h-9 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">
                No agents available for your clinic
              </p>
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="text-center py-10">
              <Search className="w-9 h-9 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">
                No agents match &quot;{query}&quot;
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 -mr-1">
              {filteredAgents.map((agent) => {
                const selected = selectedAgents.includes(agent._id);
                const color = getAvatarColor(agent._id);
                return (
                  <div
                    key={agent._id}
                    onClick={() => handleToggleAgent(agent._id)}
                    className={`group flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selected
                        ? "border-teal-700 bg-teal-50/60"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0"
                      style={{ backgroundColor: color.bg, color: color.fg }}
                    >
                      {getInitials(agent.name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900 text-sm truncate">
                          {agent.name}
                        </p>
                        {agent.role && (
                          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                            <Stethoscope className="w-3 h-3" />
                            {formatRole(agent.role)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-slate-500 truncate">
                          <Mail className="w-3 h-3 shrink-0" />
                          {agent.email}
                        </span>
                        {agent.phone && (
                          <span className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
                            <Phone className="w-3 h-3" />
                            {agent.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        selected
                          ? "bg-teal-700 border-teal-700"
                          : "border-slate-300 group-hover:border-slate-400"
                      }`}
                    >
                      {selected && (
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 mt-2 border-t border-slate-100 bg-slate-50/50">
          <span className="text-xs text-slate-500">
            {selectedAgents.length === 0
              ? "No agents selected"
              : `${selectedAgents.length} agent${selectedAgents.length === 1 ? "" : "s"} will be assigned`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || saving}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {saving ? "Saving…" : "Save assignment"}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default AssignProviderModal;
