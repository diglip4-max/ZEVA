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
      agent.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleAgent = (agent: User) => {
    const isSelected = selectedAgents.some(a => a._id === agent._id);
    if (isSelected) {
      onAgentsSelect(selectedAgents.filter(a => a._id !== agent._id));
    } else {
      onAgentsSelect([...selectedAgents, agent]);
    }
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAgentsSelect([]);
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Small Button */}
      <button
        type="button"
        onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className={`
          px-3 py-2 text-sm bg-white border rounded-lg
          text-left focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500
          transition-all duration-150 hover:border-gray-400
          flex items-center gap-2 min-w-[150px] justify-between
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          ${isOpen ? "ring-1 ring-gray-500 border-gray-500" : "border-gray-300"}
        `}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedAgents.length > 0 ? (
            <>
              <UserIcon className="w-4 h-4 text-gray-600 flex-shrink-0" />
              <span className="truncate font-medium">
                {selectedAgents.length === 1
                  ? (selectedAgents[0].name?.length > 12
                    ? `${selectedAgents[0].name?.slice(0, 12)}...`
                    : selectedAgents[0].name)
                  : `${selectedAgents.length} agents`}
              </span>
            </>
          ) : (
            <>
              <UserIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-500 truncate">{placeholder}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {selectedAgents.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="p-0.5 hover:bg-gray-100 rounded"
            >
              <X className="w-3 h-3 text-gray-400 hover:text-gray-600" />
            </button>
          )}
          {loading ? (
            <div className="animate-spin rounded-full h-3 w-3 border-b-1 border-gray-500"></div>
          ) : (
            <ChevronDown
              className={`w-3 h-3 text-gray-400 transition-transform duration-150 ${
                isOpen ? "transform rotate-180" : ""
              }`}
            />
          )}
        </div>
      </button>

      {/* Medium Width Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-b-gray-200">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search agents..."
                className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-gray-500"
                autoFocus
              />
            </div>
          </div>

          {/* Agents List - Fixed Height */}
          <div className="max-h-64 overflow-y-auto">
            {filteredAgents.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm text-gray-500">
                  {searchTerm ? "No agents found" : "No agents available"}
                </p>
              </div>
            ) : (
              <ul className="py-1">
                {filteredAgents.map((agent) => {
                  const isSelected = selectedAgents.some(a => a._id === agent._id);
                  return (
                    <li
                      key={agent._id}
                      className="border-b border-gray-100 last:border-b-0"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleAgent(agent)}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2
                          text-left hover:bg-gray-50 transition-colors text-sm
                          ${isSelected ? "bg-gray-50" : ""}
                        `}
                      >
                        {/* Checkmark for selected */}
                        <div className="flex-shrink-0">
                          {isSelected ? (
                            <div className="w-5 h-5 bg-gray-700 rounded-full flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 border border-gray-300 rounded-full"></div>
                          )}
                        </div>

                        {/* Agent Name & Email Only */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {agent.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
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
            <div className="px-3 py-2 bg-gray-50 border-t border-t-gray-200 text-xs text-gray-500 flex justify-between">
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
