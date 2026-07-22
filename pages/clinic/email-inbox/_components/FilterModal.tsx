import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Filter,
  Users,
  ChevronDown,
  Check,
  Search,
  Mail,
} from "lucide-react";
import { User as UserType } from "@/types/users";
import { Provider } from "@/types/conversations";
import { useAuth } from "@/context/AuthContext";

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: UserType[];
  selectedAgentId: string | null;
  onAgentSelect: (agentId: string | null) => void;
  providers: Provider[];
  selectedProviderId: string | null;
  onProviderSelect: (providerId: string | null) => void;
  onApplyFilters: () => void;
  loading?: boolean;
}

const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  agents,
  selectedAgentId,
  onAgentSelect,
  providers,
  selectedProviderId,
  onProviderSelect,
  onApplyFilters,
  loading = false,
}: FilterModalProps) => {
  const { user } = useAuth();
  const [localAgentId, setLocalAgentId] = useState<string | null>(
    selectedAgentId,
  );
  const [localProviderId, setLocalProviderId] = useState<string | null>(
    selectedProviderId,
  );
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const agentDropdownRef = useRef<HTMLDivElement | null>(null);
  const providerDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalAgentId(selectedAgentId);
      setLocalProviderId(selectedProviderId);
      setAgentDropdownOpen(false);
      setProviderDropdownOpen(false);
      setSearchTerm("");
    }
  }, [isOpen, selectedAgentId, selectedProviderId]);

  // Click outside handling for custom select dropdowns
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const clickIsOutsideAgentDropdown =
        agentDropdownRef.current &&
        !agentDropdownRef.current.contains(event.target as Node);
      const clickIsOutsideProviderDropdown =
        providerDropdownRef.current &&
        !providerDropdownRef.current.contains(event.target as Node);

      if (clickIsOutsideAgentDropdown && clickIsOutsideProviderDropdown) {
        setAgentDropdownOpen(false);
        setProviderDropdownOpen(false);
        setSearchTerm("");
      }
    };
    if (agentDropdownOpen || providerDropdownOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [agentDropdownOpen, providerDropdownOpen]);

  const handleApply = () => {
    onAgentSelect(localAgentId);
    onProviderSelect(localProviderId);
    onApplyFilters();
    onClose();
  };

  const handleReset = () => {
    setLocalAgentId(null);
    setLocalProviderId(null);
    setSearchTerm("");
  };

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (!loading) {
      onClose();
    }
  };

  // Find selected agent
  const selectedAgentObj = agents.find((a) => a._id === localAgentId);
  const selectedAgentName = selectedAgentObj
    ? selectedAgentObj.name || selectedAgentObj.email || "Selected Agent"
    : "All Agents";
  const selectedAgentInitials = selectedAgentObj
    ? selectedAgentObj.name
      ? selectedAgentObj.name.slice(0, 2)
      : selectedAgentObj.email?.slice(0, 2) || "A"
    : "ALL";

  // Find selected provider
  const selectedProviderObj = providers.find((p) => p._id === localProviderId);
  const selectedProviderName = selectedProviderObj
    ? selectedProviderObj.label ||
      selectedProviderObj.name ||
      "Selected Provider"
    : "All Providers";

  // Filter agents based on search term
  const filteredAgents = agents.filter((agent) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      (agent.name && agent.name.toLowerCase().includes(term)) ||
      (agent.email && agent.email.toLowerCase().includes(term)) ||
      (agent.phone && agent.phone.toLowerCase().includes(term))
    );
  });

  return (
    <div className="pi-filter-modal-backdrop" onClick={handleBackdropClick}>
      <div
        className="pi-filter-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-modal-title"
      >
        <div className="pi-filter-modal-header">
          <div className="pi-filter-modal-header-inner">
            <div className="pi-filter-modal-icon-ring">
              <Filter size={16} />
            </div>
            <div>
              <h2 className="pi-filter-modal-title" id="filter-modal-title">
                Filter Emails
              </h2>
              <p className="pi-filter-modal-subtitle">
                Apply agent or provider filter to narrow down email
                conversations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="pi-icon-btn subtle"
            aria-label="Close filters"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="pi-filter-modal-body">
          {/* Provider Filter */}
          <div className="pi-filter-modal-section">
            <label className="pi-filter-modal-label">
              <Mail className="w-4 h-4 inline mr-2 text-primary-bright" />
              Email Provider
            </label>
            <div
              className="pi-filter-modal-select-wrapper"
              ref={providerDropdownRef}
            >
              <button
                type="button"
                onClick={() => {
                  if (!loading) {
                    setProviderDropdownOpen((prev) => !prev);
                  }
                }}
                className="pi-filter-modal-custom-select-btn"
                disabled={loading}
                aria-expanded={providerDropdownOpen}
              >
                <div className="pi-filter-modal-custom-select-preview">
                  <div
                    className="pi-filter-modal-agent-avatar"
                    style={{ background: "var(--primary-soft)" }}
                  >
                    <Mail size={14} />
                  </div>
                  <span className="pi-filter-modal-agent-name">
                    {selectedProviderName}
                  </span>
                </div>
                <ChevronDown
                  size={16}
                  style={{
                    transform: providerDropdownOpen ? "rotate(180deg)" : "none",
                    transition: "transform 0.2s ease",
                    color: "var(--text-faint)",
                  }}
                />
              </button>

              {providerDropdownOpen && (
                <div className="pi-filter-modal-custom-menu">
                  <button
                    type="button"
                    className={`pi-filter-modal-custom-item ${!localProviderId ? "active" : ""}`}
                    onClick={() => {
                      setLocalProviderId(null);
                      setProviderDropdownOpen(false);
                    }}
                  >
                    <div
                      className="pi-filter-modal-agent-avatar"
                      style={{ background: "var(--border)" }}
                    >
                      ALL
                    </div>
                    <div className="pi-filter-modal-item-info">
                      <div className="pi-filter-modal-item-name">
                        All Providers
                      </div>
                    </div>
                    {!localProviderId && (
                      <Check className="pi-filter-modal-item-check" size={14} />
                    )}
                  </button>

                  {providers.length === 0 ? (
                    <div
                      style={{
                        padding: "12px",
                        textAlign: "center",
                        color: "var(--text-faint)",
                        fontSize: "13px",
                      }}
                    >
                      No providers found
                    </div>
                  ) : (
                    providers.map((provider) => {
                      const isActive = localProviderId === provider._id;
                      return (
                        <button
                          key={provider._id}
                          type="button"
                          className={`pi-filter-modal-custom-item ${isActive ? "active" : ""}`}
                          onClick={() => {
                            setLocalProviderId(provider._id);
                            setProviderDropdownOpen(false);
                          }}
                        >
                          <div
                            className="pi-filter-modal-agent-avatar"
                            style={{ background: "var(--primary-soft)" }}
                          >
                            <Mail size={14} />
                          </div>
                          <div className="pi-filter-modal-item-info">
                            <div className="pi-filter-modal-item-name">
                              {provider.label ||
                                provider.name ||
                                "Unknown Provider"}
                            </div>
                            {provider.email && (
                              <div className="pi-filter-modal-item-email">
                                {provider.email}
                              </div>
                            )}
                          </div>
                          {isActive && (
                            <Check
                              className="pi-filter-modal-item-check"
                              size={14}
                            />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Agent Filter */}
          {user?.role === "clinic" && (
            <div className="pi-filter-modal-section">
              <label className="pi-filter-modal-label">
                <Users className="w-4 h-4 inline mr-2 text-primary-bright" />
                Assigned Agent
              </label>
              <div
                className="pi-filter-modal-select-wrapper"
                ref={agentDropdownRef}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (!loading) {
                      setAgentDropdownOpen((prev) => !prev);
                      setSearchTerm("");
                    }
                  }}
                  className="pi-filter-modal-custom-select-btn"
                  disabled={loading}
                  aria-expanded={agentDropdownOpen}
                >
                  <div className="pi-filter-modal-custom-select-preview">
                    <div className="pi-filter-modal-agent-avatar">
                      {selectedAgentInitials}
                    </div>
                    <span className="pi-filter-modal-agent-name">
                      {selectedAgentName}
                    </span>
                  </div>
                  <ChevronDown
                    size={16}
                    style={{
                      transform: agentDropdownOpen ? "rotate(180deg)" : "none",
                      transition: "transform 0.2s ease",
                      color: "var(--text-faint)",
                    }}
                  />
                </button>

                {agentDropdownOpen && (
                  <div className="pi-filter-modal-custom-menu">
                    {/* Search box inside custom select menu */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 12px",
                        borderBottom: "1px solid var(--border-soft)",
                        marginBottom: "6px",
                        color: "var(--text-faint)",
                      }}
                    >
                      <Search size={14} />
                      <input
                        type="text"
                        placeholder="Search agent by name or email…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                          background: "none",
                          border: "none",
                          outline: "none",
                          color: "var(--text)",
                          fontSize: "13px",
                          width: "100%",
                          fontFamily: "inherit",
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()} // Prevent dropdown closing on input click
                      />
                    </div>

                    <button
                      type="button"
                      className={`pi-filter-modal-custom-item ${!localAgentId ? "active" : ""}`}
                      onClick={() => {
                        setLocalAgentId(null);
                        setAgentDropdownOpen(false);
                        setSearchTerm("");
                      }}
                    >
                      <div
                        className="pi-filter-modal-agent-avatar"
                        style={{ background: "var(--border)" }}
                      >
                        ALL
                      </div>
                      <div className="pi-filter-modal-item-info">
                        <div className="pi-filter-modal-item-name">
                          All Agents
                        </div>
                      </div>
                      {!localAgentId && (
                        <Check
                          className="pi-filter-modal-item-check"
                          size={14}
                        />
                      )}
                    </button>

                    {filteredAgents.length === 0 ? (
                      <div
                        style={{
                          padding: "12px",
                          textAlign: "center",
                          color: "var(--text-faint)",
                          fontSize: "13px",
                        }}
                      >
                        No agents found
                      </div>
                    ) : (
                      filteredAgents.map((agent) => {
                        const agentInitials = agent.name
                          ? agent.name.slice(0, 2)
                          : agent.email?.slice(0, 2) || "A";
                        const isActive = localAgentId === agent._id;
                        return (
                          <button
                            key={agent._id}
                            type="button"
                            className={`pi-filter-modal-custom-item ${isActive ? "active" : ""}`}
                            onClick={() => {
                              setLocalAgentId(agent._id);
                              setAgentDropdownOpen(false);
                              setSearchTerm("");
                            }}
                          >
                            <div className="pi-filter-modal-agent-avatar">
                              {agentInitials}
                            </div>
                            <div className="pi-filter-modal-item-info">
                              <div className="pi-filter-modal-item-name">
                                {agent.name || "Unknown Agent"}
                              </div>
                              {agent.email && (
                                <div className="pi-filter-modal-item-email">
                                  {agent.email}
                                </div>
                              )}
                            </div>
                            {isActive && (
                              <Check
                                className="pi-filter-modal-item-check"
                                size={14}
                              />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {(localAgentId || localProviderId) && (
            <div className="pi-filter-modal-active-box">
              <h4 className="pi-filter-modal-active-title">Active Filters</h4>
              <div className="flex flex-wrap gap-2">
                {localAgentId && (
                  <span
                    className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border"
                    style={{
                      background: "var(--primary-soft)",
                      borderColor: "var(--primary-line)",
                      color: "var(--primary-bright)",
                    }}
                  >
                    Agent: {selectedAgentName}
                    <button
                      onClick={() => {
                        setLocalAgentId(null);
                        setSearchTerm("");
                      }}
                      className="ml-2 text-primary-bright hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                )}
                {localProviderId && (
                  <span
                    className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border"
                    style={{
                      background: "var(--primary-soft)",
                      borderColor: "var(--primary-line)",
                      color: "var(--primary-bright)",
                    }}
                  >
                    Provider: {selectedProviderName}
                    <button
                      onClick={() => {
                        setLocalProviderId(null);
                      }}
                      className="ml-2 text-primary-bright hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="pi-filter-modal-actions">
          <button
            onClick={handleReset}
            disabled={(!localAgentId && !localProviderId) || loading}
            className="pi-secondary-btn"
          >
            Reset
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="pi-secondary-btn"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={loading}
              className="pi-filter-modal-primary-btn"
            >
              {loading ? "Applying..." : "Apply Filters"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterModal;
