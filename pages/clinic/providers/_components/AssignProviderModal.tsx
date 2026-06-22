import React, { useState, useEffect } from "react";
import { X, Users, CheckCircle2 } from "lucide-react";
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
}

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

  // Fetch agents
  useEffect(() => {
    const fetchAgents = async () => {
      if (!isOpen || !token) return;
      try {
        setLoading(true);
        const { data } = await axios.get(`/api/users/agents`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (data.success) {
          setAgents(data.data || []);
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

  const handleToggleAgent = (agentId: string) => {
    setSelectedAgents((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId],
    );
  };

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Assign Provider</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 cursor-pointer"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Provider
            </label>
            <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
              <p className="font-semibold text-gray-900">{provider?.label}</p>
              <p className="text-xs text-gray-500">
                {provider?.name} - {provider?.type.join(", ")}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Assign to Agents
            </label>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">Loading agents...</p>
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  No agents available for your clinic
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {agents.map((agent) => (
                  <div
                    key={agent._id}
                    onClick={() => handleToggleAgent(agent._id)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedAgents.includes(agent._id)
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm">
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {agent.name}
                        </p>
                        <p className="text-xs text-gray-500">{agent.email}</p>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        selectedAgents.includes(agent._id)
                          ? "bg-blue-600 border-blue-600"
                          : "border-gray-300"
                      }`}
                    >
                      {selectedAgents.includes(agent._id) && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || saving}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignProviderModal;
