import React from "react";
import { Layers } from "lucide-react";

const renderIcon = (iconString) => {
  if (!iconString) return null;
  if (typeof iconString === "string" && iconString.length <= 2) {
    return <span className="text-2xl">{iconString}</span>;
  }
  return <span className="text-xl">{iconString}</span>;
};

export default function OperationsModules({
  isLoading,
  navigationItems,
  router,
}) {
  return (
    <>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3 mt-6">
        <Layers className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
        Modules & Operations
      </h2>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-600 dark:text-gray-400">
            Loading dashboard...
          </div>
        </div>
      ) : navigationItems.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-600 dark:text-gray-400 text-center">
            <p className="text-lg font-semibold mb-2">
              No modules available
            </p>
            <p className="text-sm">
              You don't have permissions to view any dashboard modules yet.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3 mt-2">
          {navigationItems.map((item, index) => (
            <div
              key={item.moduleKey || index}
              onClick={() => item.path && router.push(item.path)}
              className={`
                group relative rounded-lg bg-gradient-to-br from-cyan-600 to-cyan-400 
                hover:shadow-lg transition-all duration-200 cursor-pointer
                border border-transparent hover:border-white/20
                flex flex-col justify-between
                p-2.5 md:p-3 min-h-[120px] md:min-h-[130px]
                ${item.path
                  ? "hover:scale-[1.02]"
                  : "opacity-60 cursor-not-allowed"
                }
              `}
            >
              {/* Icon */}
              <div className="flex items-start justify-between mb-1.5">
                <div className="p-1.5 bg-white/10 rounded-md backdrop-blur-sm">
                  {renderIcon(item.icon)}
                </div>
                {item.subModules && item.subModules.length > 0 && (
                  <span className="text-xs text-white/70 bg-white/10 px-1.5 py-0.5 rounded">
                    {item.subModules.length}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col justify-end">
                <h3 className="text-base md:text-lg font-bold text-white leading-tight mb-0.5">
                  {item.label}
                </h3>
                <p className="text-xs md:text-sm text-white/70 leading-relaxed line-clamp-2">
                  {item.description}
                </p>
              </div>

              {/* Hover indicator */}
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg
                  className="w-4 h-4 text-white/60"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
