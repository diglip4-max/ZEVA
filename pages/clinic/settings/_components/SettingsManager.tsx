import React, { useState } from "react";
import { Settings, Bell } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import useClinic from "@/hooks/useClinic";
import NotificationSettingsTab from "./NotificationSettingsTab";

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,450;9..144,560;9..144,650&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.zsm-display { font-family: 'Fraunces', serif; letter-spacing: -0.01em; }
.zsm-body { font-family: 'Manrope', sans-serif; }
.zsm-mono { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
`;

export default function SettingsManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("view") || "notifications";
  const { clinic } = useClinic();

  const [activeTab, setActiveTab] = useState<"notifications">(
    currentTab as any,
  );

  const tabs: {
    id: typeof activeTab;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }[] = [{ id: "notifications", label: "Notifications", icon: Bell }];

  return (
    <div>
      <div className="zsm-body min-h-screen bg-slate-50/50 dark:bg-slate-900 transition-colors duration-300">
        <style>{FONTS}</style>

        <div className="relative bg-white dark:bg-[#0F172A] border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <div className="relative w-full px-6 sm:px-10 pt-8 pb-5 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-md shadow-teal-500/20 shrink-0">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest mb-1">
                  {clinic?.name || "Zeva"}
                </div>
                <h1 className="zsm-display text-[28px] font-semibold text-slate-900 dark:text-slate-100 leading-none">
                  Settings
                </h1>
              </div>
            </div>
          </div>
          <div className="relative w-full px-6 sm:px-10 pb-4">
            <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 rounded-full p-1">
              {tabs.map((t) => {
                const TabIcon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setActiveTab(t.id);
                      router.push(`/clinic/settings?view=${t.id}`, undefined, {
                        shallow: true,
                      });
                    }}
                    className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200 flex items-center gap-2 ${
                      activeTab === t.id
                        ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-sm border border-slate-200/80 dark:border-slate-600/50"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                    }`}
                  >
                    <TabIcon size={16} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="w-full px-6 sm:px-12 py-8 sm:py-12">
          <>{activeTab === "notifications" && <NotificationSettingsTab />}</>
        </div>
      </div>
    </div>
  );
}
