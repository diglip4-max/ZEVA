import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactElement;
  trend?: string;
  trendPositive?: boolean;
  fromColor: string;
  toColor: string;
  iconColor: string;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  trend,
  trendPositive,
  fromColor,
  toColor,
  iconColor,
}) => {
  return (
    <div className="group bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">
          {label}
        </span>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
          style={{
            backgroundImage: `linear-gradient(135deg, ${fromColor}, ${toColor})`,
          }}
        >
          {React.cloneElement(icon, {
            className: `w-4 h-4 ${iconColor}`,
          } as React.HTMLAttributes<SVGElement>)}
        </div>
      </div>
      <div className="text-[27px] font-semibold text-stone-900 dark:text-stone-50">
        {value}
      </div>
      {trend && (
        <div
          className={`flex items-center gap-1 mt-2 text-xs font-semibold ${
            trendPositive
              ? "text-teal-600 dark:text-teal-400"
              : "text-rose-500 dark:text-rose-400"
          }`}
        >
          {trendPositive ? (
            <ArrowUpRight className="w-3 h-3" />
          ) : (
            <ArrowDownRight className="w-3 h-3" />
          )}
          {trend}
        </div>
      )}
    </div>
  );
};

export default StatCard;
