import React, { useState, useEffect, useRef } from "react";
import { X, Filter, Users, ChevronDown, Check, Search } from "lucide-react";
import { User as UserType } from "@/types/users";
import { useAuth } from "@/context/AuthContext";

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: UserType[];
  selectedAgentId: string | null;
  onAgentSelect: (agentId: string | null) => void;
  onApplyFilters: () => void;
  loading?: boolean;
}

const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  agents,
  selectedAgentId,
  onAgentSelect,
  onApplyFilters,
  loading = false,
}) => {
  const { user } = useAuth();
  const [localAgentId, setLocalAgentId] = useState<string | null>(selectedAgentId);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalAgentId(selectedAgentId);
      setDropdownOpen(false);
      setSearchTerm("");
    }
  }, [isOpen, selectedAgentId]);

  // Click outside handling for custom select dropdown
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
        setSearchTerm("");
      }
    };
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [dropdownOpen]);

  const handleApply = () => {
    onAgentSelect(localAgentId);
    onApplyFilters();
    onClose();
  };

  const handleReset = () => {
    setLocalAgentId(null);
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
    ? (selectedAgentObj.name || selectedAgentObj.email || "Selected Agent")
    : "All Agents";
  const selectedAgentInitials = selectedAgentObj
    ? (selectedAgentObj.name ? selectedAgentObj.name.slice(0, 2) : selectedAgentObj.email?.slice(0, 2) || "A")
    : "ALL";

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
                Apply agent filter to narrow down email conversations
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
          {/* Agent Filter */}
          {user?.role === "clinic" && (
            <div className="pi-filter-modal-section">
              <label className="pi-filter-modal-label">
                <Users className="w-4 h-4 inline mr-2 text-primary-bright" />
                Assigned Agent
              </label>
              <div className="pi-filter-modal-select-wrapper" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    if (!loading) {
                      setDropdownOpen((prev) => !prev);
                      setSearchTerm("");
                    }
                  }}
                  className="pi-filter-modal-custom-select-btn"
                  disabled={loading}
                  aria-expanded={dropdownOpen}
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
                      transform: dropdownOpen ? "rotate(180deg)" : "none",
                      transition: "transform 0.2s ease",
                      color: "var(--text-faint)"
                    }}
                  />
                </button>

                {dropdownOpen && (
                  <div className="pi-filter-modal-custom-menu">
                    {/* Search box inside custom select menu */}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      borderBottom: "1px solid var(--border-soft)",
                      marginBottom: "6px",
                      color: "var(--text-faint)"
                    }}>
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
                          fontFamily: "inherit"
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
                        setDropdownOpen(false);
                        setSearchTerm("");
                      }}
                    >
                      <div className="pi-filter-modal-agent-avatar" style={{ background: "var(--border)" }}>
                        ALL
                      </div>
                      <div className="pi-filter-modal-item-info">
                        <div className="pi-filter-modal-item-name">All Agents</div>
                      </div>
                      {!localAgentId && <Check className="pi-filter-modal-item-check" size={14} />}
                    </button>

                    {filteredAgents.length === 0 ? (
                      <div style={{ padding: "12px", textAlign: "center", color: "var(--text-faint)", fontSize: "13px" }}>
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
                              setDropdownOpen(false);
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
                            {isActive && <Check className="pi-filter-modal-item-check" size={14} />}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {localAgentId && (
            <div className="pi-filter-modal-active-box">
              <h4 className="pi-filter-modal-active-title">
                Active Filter
              </h4>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border"
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
              </div>
            </div>
          )}
        </div>

        <div className="pi-filter-modal-actions">
          <button
            onClick={handleReset}
            disabled={!localAgentId || loading}
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
