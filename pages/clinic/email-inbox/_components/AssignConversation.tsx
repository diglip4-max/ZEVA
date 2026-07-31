import React, { useState, useRef, useEffect } from "react";
import { User } from "@/types/users";
import { ChevronDown, Check, User as UserIcon, Search, X } from "lucide-react";

interface AssignConversationProps {
  agents: User[];
  selectedAgents: User[];
  onAgentsSelect: (agents: User[]) => void;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
}

const AssignConversation: React.FC<AssignConversationProps> = ({
  agents,
  selectedAgents,
  onAgentsSelect,
  placeholder = "Assign to agents",
  loading = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter agents based on search
  const filteredAgents = agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleToggleAgent = (agent: User) => {
    const isSelected = selectedAgents.some((a) => a._id === agent._id);
    if (isSelected) {
      onAgentsSelect(selectedAgents.filter((a) => a._id !== agent._id));
    } else {
      onAgentsSelect([...selectedAgents, agent]);
    }
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAgentsSelect([]);
  };

  return (
    <div
      className="relative inline-block"
      ref={dropdownRef}
      style={{ zIndex: 100 }}
    >
      {/* Small Button */}
      <button
        type="button"
        onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
        disabled={disabled || loading}
        style={{
          padding: "8px 12px",
          fontSize: "13px",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          textAlign: "left",
          outline: "none",
          cursor: disabled || loading ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          minWidth: "160px",
          justifyContent: "space-between",
          opacity: disabled ? "0.5" : "1",
          transition: "all 0.12s ease",
        }}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedAgents.length > 0 ? (
            <>
              <UserIcon
                className="w-4 h-4 flex-shrink-0"
                style={{ color: "var(--text-faint)" }}
              />
              <span
                className="truncate font-medium"
                style={{ color: "var(--text-dim)" }}
              >
                {selectedAgents.length === 1
                  ? selectedAgents[0].name?.length > 12
                    ? `${selectedAgents[0].name?.slice(0, 12)}...`
                    : selectedAgents[0].name
                  : `${selectedAgents.length} agents`}
              </span>
            </>
          ) : (
            <>
              <UserIcon
                className="w-4 h-4 flex-shrink-0"
                style={{ color: "var(--text-faint)" }}
              />
              <span className="truncate" style={{ color: "var(--text-faint)" }}>
                {placeholder}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {selectedAgents.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              style={{
                padding: "2px",
                borderRadius: "4px",
                cursor: "pointer",
                background: "transparent",
                border: "none",
              }}
            >
              <X className="w-3 h-3" style={{ color: "var(--text-faint)" }} />
            </button>
          )}
          {loading ? (
            <div
              style={{
                animation: "spin 1s linear infinite",
                borderRadius: "50%",
                width: "12px",
                height: "12px",
                borderBottom: "1px solid var(--primary-bright)",
              }}
            />
          ) : (
            <ChevronDown
              className="w-3 h-3"
              style={{
                color: "var(--text-faint)",
                transition: "transform 0.15s ease",
                transform: isOpen ? "rotate(180deg)" : "none",
              }}
            />
          )}
        </div>
      </button>

      {/* Medium Width Dropdown */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            zIndex: 100,
            right: 0,
            marginTop: "8px",
            width: "280px",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            boxShadow: "0 16px 40px -12px rgba(0,0,0,0.6)",
            overflow: "hidden",
          }}
        >
          {/* Search Input */}
          <div
            style={{
              padding: "12px",
              borderBottom: "1px solid var(--border-soft)",
            }}
          >
            <div style={{ position: "relative" }}>
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
                style={{ color: "var(--text-faint)" }}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search agents..."
                style={{
                  width: "100%",
                  paddingLeft: "32px",
                  paddingRight: "12px",
                  paddingTop: "8px",
                  paddingBottom: "8px",
                  fontSize: "13px",
                  background: "var(--panel-2)",
                  border: "1px solid var(--border-soft)",
                  borderRadius: "8px",
                  color: "var(--text)",
                  outline: "none",
                  fontFamily: "Inter, sans-serif",
                }}
                autoFocus
              />
            </div>
          </div>

          {/* Agents List - Fixed Height */}
          <div style={{ maxHeight: "260px", overflowY: "auto" }}>
            {filteredAgents.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center" }}>
                <p style={{ fontSize: "13px", color: "var(--text-faint)" }}>
                  {searchTerm ? "No agents found" : "No agents available"}
                </p>
              </div>
            ) : (
              <ul style={{ padding: "6px" }}>
                {filteredAgents.map((agent) => {
                  const isSelected = selectedAgents.some(
                    (a) => a._id === agent._id,
                  );
                  return (
                    <li
                      key={agent._id}
                      style={{
                        borderBottom: "1px solid var(--border-soft)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleAgent(agent)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "10px 12px",
                          textAlign: "left",
                          cursor: "pointer",
                          background: isSelected
                            ? "var(--primary-soft)"
                            : "transparent",
                          border: "none",
                          borderRadius: "10px",
                          transition: "background 0.1s ease",
                        }}
                      >
                        {/* Checkmark for selected */}
                        <div className="flex-shrink-0">
                          {isSelected ? (
                            <div
                              style={{
                                width: "20px",
                                height: "20px",
                                background: "var(--primary-bright)",
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Check
                                className="w-3 h-3"
                                style={{ color: "white" }}
                              />
                            </div>
                          ) : (
                            <div
                              style={{
                                width: "20px",
                                height: "20px",
                                border: "1px solid var(--border)",
                                borderRadius: "50%",
                              }}
                            />
                          )}
                        </div>

                        {/* Agent Name & Email Only */}
                        <div className="flex-1 min-w-0">
                          <p
                            style={{
                              fontWeight: 600,
                              color: "var(--text)",
                              fontSize: "14px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              margin: 0,
                            }}
                          >
                            {agent.name}
                          </p>
                          <p
                            style={{
                              fontSize: "12px",
                              color: "var(--text-faint)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              margin: "2px 0 0 0",
                            }}
                          >
                            {agent.email}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Simple Footer */}
          {filteredAgents.length > 0 && (
            <div
              style={{
                padding: "10px 14px",
                background: "var(--panel-2)",
                borderTop: "1px solid var(--border-soft)",
                fontSize: "11px",
                color: "var(--text-faint)",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>{selectedAgents.length} selected</span>
              <span>{filteredAgents.length} agents</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AssignConversation;
