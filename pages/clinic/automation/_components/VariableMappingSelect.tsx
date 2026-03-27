import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  Zap,
  User,
  Building,
  Webhook,
  Calendar,
  ChevronRight,
  ChevronDown,
  X,
  MessageSquare,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";

function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

interface Variable {
  label: string;
  value: string;
  category: string;
  icon: any;
}

interface VariableMappingSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  entity?: string; // Lead, Appointment, etc.
  className?: string;
}

const VariableMappingSelect: React.FC<VariableMappingSelectProps> = ({
  value,
  onChange,
  placeholder = "Select variable...",
  entity = "Lead",
  className,
}) => {
  console.log({ entity });
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const variables: Variable[] = [
    // Lead
    {
      label: "Lead Name",
      value: "{{lead.name}}",
      category: "Lead",
      icon: User,
    },
    {
      label: "Lead Email",
      value: "{{lead.email}}",
      category: "Lead",
      icon: User,
    },
    {
      label: "Lead Phone",
      value: "{{lead.phone}}",
      category: "Lead",
      icon: User,
    },
    {
      label: "Lead Gender",
      value: "{{lead.gender}}",
      category: "Lead",
      icon: User,
    },
    { label: "Lead Age", value: "{{lead.age}}", category: "Lead", icon: User },
    {
      label: "Lead Source",
      value: "{{lead.source}}",
      category: "Lead",
      icon: User,
    },
    {
      label: "Lead Custom Source",
      value: "{{lead.customSource}}",
      category: "Lead",
      icon: User,
    },
    {
      label: "Lead Offer",
      value: "{{lead.offerTag}}",
      category: "Lead",
      icon: User,
    },
    {
      label: "Lead Status",
      value: "{{lead.status}}",
      category: "Lead",
      icon: User,
    },
    {
      label: "Lead Custom Status",
      value: "{{lead.customStatus}}",
      category: "Lead",
      icon: User,
    },
    {
      label: "Clinic Name",
      value: "{{lead.clinicName}}",
      category: "Lead",
      icon: Building,
    },

    // Patient
    {
      label: "Patient Name",
      value: "{{patient.name}}",
      category: "Patient",
      icon: User,
    },
    {
      label: "Patient Email",
      value: "{{patient.email}}",
      category: "Patient",
      icon: User,
    },
    {
      label: "Patient Phone",
      value: "{{patient.phone}}",
      category: "Patient",
      icon: User,
    },
    {
      label: "Patient Gender",
      value: "{{patient.gender}}",
      category: "Patient",
      icon: User,
    },
    {
      label: "Patient Age",
      value: "{{patient.age}}",
      category: "Patient",
      icon: User,
    },
    {
      label: "Patient Source",
      value: "{{patient.source}}",
      category: "Patient",
      icon: User,
    },
    {
      label: "Patient Custom Source",
      value: "{{patient.customSource}}",
      category: "Patient",
      icon: User,
    },
    {
      label: "Patient Status",
      value: "{{patient.status}}",
      category: "Patient",
      icon: User,
    },
    {
      label: "Patient Custom Status",
      value: "{{patient.customStatus}}",
      category: "Patient",
      icon: User,
    },
    {
      label: "Clinic Name",
      value: "{{patient.clinicName}}",
      category: "Patient",
      icon: Building,
    },

    // Clinic
    {
      label: "Clinic Name",
      value: "{{clinic.name}}",
      category: "Clinic",
      icon: Building,
    },
    {
      label: "Clinic Address",
      value: "{{clinic.address}}",
      category: "Clinic",
      icon: Building,
    },
    {
      label: "Clinic Phone",
      value: "{{clinic.phone}}",
      category: "Clinic",
      icon: Building,
    },

    // Webhook
    {
      label: "Webhook Payload",
      value: "{{webhook.payload}}",
      category: "Webhook",
      icon: Webhook,
    },

    // Message
    {
      label: "Message Content",
      value: "{{message.content}}",
      category: "Message",
      icon: MessageSquare,
    },
    {
      label: "Message Channel",
      value: "{{message.channel}}",
      category: "Message",
      icon: MessageSquare,
    },
    {
      label: "Message Direction",
      value: "{{message.direction}}",
      category: "Message",
      icon: MessageSquare,
    },
    {
      label: "Message Sender",
      value: "{{message.senderId}}",
      category: "Message",
      icon: User,
    },
    {
      label: "Message Recipient",
      value: "{{message.recipientId}}",
      category: "Message",
      icon: User,
    },

    // Appointment
    {
      label: "Appointment Date",
      value: "{{appointment.date}}",
      category: "Appointment",
      icon: Calendar,
    },
    {
      label: "Appointment Time",
      value: "{{appointment.time}}",
      category: "Appointment",
      icon: Calendar,
    },
    {
      label: "Doctor Name",
      value: "{{appointment.doctor}}",
      category: "Appointment",
      icon: User,
    },

    // System
    {
      label: "Current Date",
      value: "{{system.date}}",
      category: "System",
      icon: Zap,
    },
    {
      label: "Current Time",
      value: "{{system.time}}",
      category: "System",
      icon: Zap,
    },
  ];

  const filteredVariables = variables.filter(
    (v) =>
      v.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.value.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const categories = Array.from(
    new Set(filteredVariables.map((v) => v.category)),
  );

  const selectedVariable = variables.find((v) => v.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={cn("relative w-full", className)} ref={dropdownRef}>
      {/* Select Trigger */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between cursor-pointer transition-all hover:bg-gray-100",
          isOpen
            ? "ring-2 ring-blue-100 border-blue-500 bg-white"
            : "hover:border-gray-300",
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {selectedVariable ? (
            <>
              <div className="p-1.5 bg-blue-50 rounded text-blue-600 shrink-0">
                <selectedVariable.icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-gray-900 truncate">
                  {selectedVariable.label}
                </span>
                <span className="text-[10px] text-gray-400 font-mono leading-none">
                  {selectedVariable.value}
                </span>
              </div>
            </>
          ) : (
            <span className="text-xs text-gray-400 font-medium">
              {placeholder}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="p-1 hover:bg-gray-200 rounded-full text-gray-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              "w-4 h-4 text-gray-400 transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[110] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden max-h-[400px]">
          {/* Search Header */}
          <div className="p-3 border-b border-gray-100 bg-gray-50/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                autoFocus
                type="text"
                placeholder="Search variables..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Variables List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {categories.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-xs text-gray-400 font-medium italic">
                  No variables found
                </p>
              </div>
            ) : (
              categories.map((cat) => (
                <div key={cat} className="mb-2 last:mb-0">
                  <h4 className="px-2 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    {cat}
                  </h4>
                  <div className="space-y-0.5">
                    {filteredVariables
                      .filter((v) => v.category === cat)
                      .map((variable) => {
                        const Icon = variable.icon;
                        const isSelected = value === variable.value;
                        return (
                          <button
                            key={variable.value}
                            type="button"
                            onClick={() => {
                              onChange(variable.value);
                              setIsOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center justify-between p-2 rounded-lg group/var transition-all text-left",
                              isSelected ? "bg-blue-50" : "hover:bg-gray-50",
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "p-1.5 rounded transition-colors",
                                  isSelected
                                    ? "bg-blue-100"
                                    : "bg-gray-100 group-hover/var:bg-blue-50",
                                )}
                              >
                                <Icon
                                  className={cn(
                                    "w-3.5 h-3.5",
                                    isSelected
                                      ? "text-blue-600"
                                      : "text-gray-500 group-hover/var:text-blue-500",
                                  )}
                                />
                              </div>
                              <div>
                                <p
                                  className={cn(
                                    "text-xs font-bold leading-none",
                                    isSelected
                                      ? "text-blue-700"
                                      : "text-gray-700 group-hover/var:text-blue-600",
                                  )}
                                >
                                  {variable.label}
                                </p>
                                <p className="text-[10px] text-gray-400 font-mono mt-1 leading-none">
                                  {variable.value}
                                </p>
                              </div>
                            </div>
                            {isSelected ? (
                              <ChevronRight className="w-3.5 h-3.5 text-blue-500" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover/var:opacity-100 transition-all" />
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2 bg-gray-50 border-t border-gray-100">
            <p className="text-[9px] text-center text-gray-400 font-medium">
              Mapping this field to a dynamic workflow variable
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VariableMappingSelect;
