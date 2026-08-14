import React, { useEffect, useRef, useState } from "react";
import { Search, ChevronDown, CheckCircle2 } from "lucide-react";

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  label?: string;
  icon?: React.ReactNode;
  required?: boolean;
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  onSearchChange?: (search: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  loading?: boolean;
  emptyText?: string;
}

export default function SearchableSelect({
  label,
  icon,
  required,
  options,
  value,
  onChange,
  onSearchChange,
  placeholder = "Select an option",
  searchPlaceholder = "Search…",
  loading = false,
  emptyText = "Nothing found",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const updateSearch = (v: string) => {
    setSearch(v);
    onSearchChange?.(v);
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        updateSearch("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = options.find((o) => o.value === value);

  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(search.toLowerCase()) ||
      (o.sublabel || "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-2 relative" ref={ref}>
      {label && (
        <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
          {icon}
          {label}
          {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div
        onClick={() => setOpen(!open)}
        className={`w-full px-4 py-2.5 bg-white dark:bg-stone-800 border rounded-xl text-sm font-medium flex items-center justify-between cursor-pointer transition-all ${
          open
            ? "border-teal-400 ring-2 ring-teal-100 dark:ring-teal-900"
            : "border-stone-200 dark:border-stone-700 hover:border-teal-300 dark:hover:border-teal-700"
        }`}
      >
        <span
          className={`truncate ${selected ? "text-stone-900 dark:text-stone-50" : "text-stone-400 dark:text-stone-500"}`}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-stone-400 dark:text-stone-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </div>

      {open && (
        <div className="absolute z-30 w-full mt-1.5 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl shadow-2xl max-h-72 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
          <div className="p-2.5 border-b border-stone-100 dark:border-stone-700 bg-stone-50/60 dark:bg-stone-900/40">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
              <input
                autoFocus
                value={search}
                onChange={(e) => updateSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-sm text-stone-800 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 focus:border-teal-400 transition-all"
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-6 text-center text-stone-400 dark:text-stone-500 text-sm">
                Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-stone-400 dark:text-stone-500 text-sm italic">
                {emptyText}
              </div>
            ) : (
              <ul className="py-1.5">
                {filtered.map((o) => (
                  <li
                    key={o.value}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                      updateSearch("");
                    }}
                    className={`px-4 py-2.5 cursor-pointer transition-colors group ${
                      value === o.value
                        ? "bg-teal-50 dark:bg-teal-950/40"
                        : "hover:bg-stone-50 dark:hover:bg-stone-700/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col min-w-0">
                        <span
                          className={`text-sm font-semibold truncate ${
                            value === o.value
                              ? "text-teal-700 dark:text-teal-300"
                              : "text-stone-800 dark:text-stone-100"
                          }`}
                        >
                          {o.label}
                        </span>
                        {o.sublabel && (
                          <span className="text-[11px] text-stone-400 dark:text-stone-500">
                            {o.sublabel}
                          </span>
                        )}
                      </div>
                      {value === o.value && (
                        <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
