import React, { useEffect, useState, useCallback } from "react";
import {
  X,
  Database,
  Save,
  Loader2,
  Plus,
  Trash2,
  Globe,
  Settings2,
  KeyRound,
} from "lucide-react";
import axios from "axios";
import { getTokenByPath } from "@/lib/helper";
import { clsx, type ClassValue } from "clsx";
import VariableMappingDropdown from "./VariableMappingDropdown";
import { WorkflowEntity } from "@/types/workflows";

function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

interface RestApiActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionId: string | null;
  onUpdate: (updatedAction: any) => void;
  entity?: WorkflowEntity;
}

const RestApiActionModal: React.FC<RestApiActionModalProps> = ({
  isOpen,
  onClose,
  actionId,
  onUpdate,
  entity = "Lead",
}) => {
  const [apiMethod, setApiMethod] = useState<string>("POST");
  const [apiEndPointUrl, setApiEndPointUrl] = useState<string>("");
  const [apiPayloadType, setApiPayloadType] = useState<string>("JSON");
  const [apiAuthType, setApiAuthType] = useState<string>("NO_AUTH");
  const [apiHeaders, setApiHeaders] = useState<
    { key: string; value: string }[]
  >([]);
  const [apiParameters, setApiParameters] = useState<
    { key: string; value: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"general" | "headers" | "params">(
    "general",
  );

  const fetchAction = useCallback(async () => {
    if (!actionId) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = getTokenByPath();
      const { data } = await axios.get(
        `/api/workflows/actions/update/${actionId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (data.success) {
        const params = data.data.parameters || {};
        setApiMethod(params.apiMethod || "POST");
        setApiEndPointUrl(params.apiEndPointUrl || "");
        setApiPayloadType(params.apiPayloadType || "JSON");
        setApiAuthType(params.apiAuthType || "NO_AUTH");
        setApiHeaders(params.apiHeaders || []);
        setApiParameters(params.apiParameters || []);
      }
    } catch (err: any) {
      console.error("Error fetching rest api action:", err);
      setError("Failed to load action details.");
    } finally {
      setIsLoading(false);
    }
  }, [actionId]);

  useEffect(() => {
    if (isOpen && actionId) {
      fetchAction();
    }
  }, [isOpen, actionId, fetchAction]);

  const handleSave = async () => {
    if (!actionId) return;
    setIsSaving(true);
    setError(null);
    try {
      const token = getTokenByPath();
      const { data } = await axios.put(
        `/api/workflows/actions/update/${actionId}`,
        {
          parameters: {
            apiMethod,
            apiEndPointUrl,
            apiPayloadType,
            apiAuthType,
            apiHeaders,
            apiParameters,
          },
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (data.success) {
        onUpdate(data.data);
        onClose();
      }
    } catch (err: any) {
      console.error("Error saving rest api action:", err);
      setError("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const addHeader = () =>
    setApiHeaders([...apiHeaders, { key: "", value: "" }]);
  const removeHeader = (index: number) =>
    setApiHeaders(apiHeaders.filter((_, i) => i !== index));
  const updateHeader = (
    index: number,
    field: "key" | "value",
    value: string,
  ) => {
    const newHeaders = [...apiHeaders];
    newHeaders[index][field] = value;
    setApiHeaders(newHeaders);
  };

  const addParam = () =>
    setApiParameters([...apiParameters, { key: "", value: "" }]);
  const removeParam = (index: number) =>
    setApiParameters(apiParameters.filter((_, i) => i !== index));
  const updateParam = (
    index: number,
    field: "key" | "value",
    value: string,
  ) => {
    const newParams = [...apiParameters];
    newParams[index][field] = value;
    setApiParameters(newParams);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end text-gray-500">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Content */}
      <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Database className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                REST API Settings
              </h3>
              <p className="text-xs text-gray-500 font-medium">
                Configure API request
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 border-b border-gray-100 bg-gray-50/30">
          <button
            onClick={() => setActiveTab("general")}
            className={cn(
              "px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2",
              activeTab === "general"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-400 hover:text-gray-600",
            )}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab("headers")}
            className={cn(
              "px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2",
              activeTab === "headers"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-400 hover:text-gray-600",
            )}
          >
            Headers
          </button>
          <button
            onClick={() => setActiveTab("params")}
            className={cn(
              "px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2",
              activeTab === "params"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-400 hover:text-gray-600",
            )}
          >
            Parameters
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm font-medium">Loading settings...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-red-600 text-sm font-medium">
              {error}
            </div>
          ) : (
            <div className="space-y-6">
              {activeTab === "general" && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-gray-400" /> Endpoint URL
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={apiMethod}
                        onChange={(e) => setApiMethod(e.target.value)}
                        className="w-32 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                      </select>
                      <input
                        type="url"
                        value={apiEndPointUrl}
                        onChange={(e) => setApiEndPointUrl(e.target.value)}
                        className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="https://api.example.com/v1/..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-gray-400" /> Payload
                        Type
                      </label>
                      <select
                        value={apiPayloadType}
                        onChange={(e) => setApiPayloadType(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      >
                        <option value="JSON">JSON</option>
                        <option value="FORM_DATA">Form Data</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-gray-400" /> Auth Type
                      </label>
                      <select
                        value={apiAuthType}
                        onChange={(e) => setApiAuthType(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      >
                        <option value="NO_AUTH">No Auth</option>
                        <option value="BEARER_TOKEN">Bearer Token</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "headers" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-700">
                      Custom Headers
                    </h4>
                    <button
                      onClick={addHeader}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Header
                    </button>
                  </div>
                  {apiHeaders.length === 0 ? (
                    <div className="p-8 border-2 border-dashed border-gray-100 rounded-2xl text-center">
                      <p className="text-xs text-gray-400 font-medium italic">
                        No custom headers configured
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {apiHeaders.map((header, idx) => (
                        <div key={idx} className="flex gap-2 group">
                          <input
                            placeholder="Key"
                            value={header.key}
                            onChange={(e) =>
                              updateHeader(idx, "key", e.target.value)
                            }
                            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          />
                          <input
                            placeholder="Value"
                            value={header.value}
                            onChange={(e) =>
                              updateHeader(idx, "value", e.target.value)
                            }
                            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          />
                          <VariableMappingDropdown
                            onSelect={(value: string) =>
                              updateHeader(idx, "value", value)
                            }
                            entity={entity}
                            align="right"
                            nodeId={actionId as string}
                          />
                          <button
                            onClick={() => removeHeader(idx)}
                            className="p-2 rounded-lg border border-gray-200 bg-white hover:border-red-300 text-gray-400 hover:text-red-500 transition-colors shadow-sm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "params" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-700">
                      Query Parameters
                    </h4>
                    <button
                      onClick={addParam}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Parameter
                    </button>
                  </div>
                  {apiParameters.length === 0 ? (
                    <div className="p-8 border-2 border-dashed border-gray-100 rounded-2xl text-center">
                      <p className="text-xs text-gray-400 font-medium italic">
                        No query parameters configured
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {apiParameters.map((param, idx) => (
                        <div key={idx} className="flex gap-2 group">
                          <input
                            placeholder="Key"
                            value={param.key}
                            onChange={(e) =>
                              updateParam(idx, "key", e.target.value)
                            }
                            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          />
                          <input
                            placeholder="Value"
                            value={param.value}
                            onChange={(e) =>
                              updateParam(idx, "value", e.target.value)
                            }
                            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          />
                          <VariableMappingDropdown
                            onSelect={(value: string) =>
                              updateParam(idx, "value", value)
                            }
                            entity={entity}
                            align="right"
                            nodeId={actionId as string}
                          />
                          <button
                            onClick={() => removeParam(idx)}
                            className="p-2 rounded-lg border border-gray-200 bg-white hover:border-red-300 text-gray-400 hover:text-red-500 transition-colors shadow-sm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50/50">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all shadow-sm"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="flex-1 px-4 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestApiActionModal;
