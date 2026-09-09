import React, { useState, useEffect } from "react";
import axios from "axios";
import { getTokenByPath } from "@/lib/helper";
import {
  Lock,
  //  Home, LogOut,
  ShieldX,
  Loader2,
} from "lucide-react";
// import { useRouter } from "next/router";

export interface ModulePermissions {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canImport: boolean;
  canExport: boolean;
}

export interface SubModuleMatcher {
  name?: string;
  path?: string;
  moduleKey?: string;
}

export interface UseFinancePermissionOptions {
  moduleKey: string;
  parentModuleKey?: string;
  subModuleMatchers?: SubModuleMatcher[];
  debugLabel?: string;
}

export interface UseFinancePermissionReturn {
  permissions: ModulePermissions;
  permissionsLoaded: boolean;
  isAgentStaff: boolean;
  role: string | null;
  AccessDenied: React.FC;
  PermissionLoading: React.FC;
  canAccessPage: boolean;
}

// ============================================================
// PURE HELPERS — defined at module level (stable identity)
// This ELIMINATES the infinite loop caused by inline
// subModuleMatchers arrays in the useEffect dep chain.
// ============================================================

const isTrueValue = (val: any): boolean =>
  val === true || val === "true" || String(val || "").toLowerCase() === "true";

const FULL_PERMISSIONS: ModulePermissions = {
  canRead: true,
  canCreate: true,
  canUpdate: true,
  canDelete: true,
  canImport: true,
  canExport: true,
};

const READ_ONLY_PERMISSIONS: ModulePermissions = {
  canRead: true,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
  canImport: false,
  canExport: false,
};

const AGENT_STAFF_ROLES = new Set(["agent", "staff", "doctorstaff"]);

const resolveActionsToPermissions = (
  actions: Record<string, any>,
): ModulePermissions => {
  const all = isTrueValue(actions.all);
  return {
    canRead: all || isTrueValue(actions.read),
    canCreate: all || isTrueValue(actions.create),
    canUpdate: all || isTrueValue(actions.update),
    canDelete: all || isTrueValue(actions.delete),
    canImport: all || isTrueValue(actions.import),
    canExport: all || isTrueValue(actions.export),
  };
};

const findModuleInClinicPermissions = (
  permissionList: any[],
  moduleKey: string,
  parentModuleKey: string | undefined,
  subModuleMatchers: SubModuleMatcher[],
  debugLabel: string,
): any => {
  if (!Array.isArray(permissionList) || permissionList.length === 0) {
    return null;
  }

  const directMatch = permissionList.find((p: any) => p?.module === moduleKey);
  if (directMatch) {
    console.log(`[${debugLabel}] Direct module permission found:`, directMatch);
    return directMatch;
  }

  if (parentModuleKey) {
    const parentModule = permissionList.find(
      (p: any) => p?.module === parentModuleKey && Array.isArray(p.subModules),
    );

    if (parentModule) {
      console.log(`[${debugLabel}] Parent module found:`, parentModule);

      const matchers: SubModuleMatcher[] = [
        { moduleKey },
        ...subModuleMatchers,
      ];

      for (const matcher of matchers) {
        const subMatch = parentModule.subModules.find((sm: any) => {
          if (matcher.moduleKey && sm?.moduleKey === matcher.moduleKey)
            return true;
          if (matcher.name && sm?.name === matcher.name) return true;
          if (matcher.path && sm?.path === matcher.path) return true;
          return false;
        });

        if (subMatch) {
          console.log(`[${debugLabel}] Submodule permission found:`, subMatch);
          return subMatch;
        }
      }
    }
  }

  console.log(`[${debugLabel}] No module permission entry found`);
  return null;
};

// ============================================================
// HOOK
// ============================================================

const useFinancePermission = (
  options: UseFinancePermissionOptions,
): UseFinancePermissionReturn => {
  const {
    moduleKey,
    parentModuleKey,
    subModuleMatchers = [],
    debugLabel = moduleKey,
  } = options;

  //   const router = useRouter();

  const [permissions, setPermissions] =
    useState<ModulePermissions>(FULL_PERMISSIONS);
  const [permissionsLoaded, setPermissionsLoaded] = useState<boolean>(false);
  const [isAgentStaff, setIsAgentStaff] = useState<boolean>(false);
  const [role, setRole] = useState<string | null>(null);

  // ---------- useEffect deps are now ONLY primitive strings ----------
  // No more reference churn from inline arrays/objects → no infinite loop.
  useEffect(() => {
    let cancelled = false;

    const fetchPermissions = async () => {
      try {
        if (!cancelled) setPermissionsLoaded(false);

        const token = getTokenByPath();
        if (!token) {
          if (!cancelled) setPermissionsLoaded(true);
          return;
        }

        const decoded = JSON.parse(atob(token.split(".")[1]));
        if (!cancelled) setRole(decoded.role);

        const _isAgentStaff = AGENT_STAFF_ROLES.has(decoded.role);
        if (!cancelled) setIsAgentStaff(_isAgentStaff);

        if (_isAgentStaff) {
          console.log(`[${debugLabel}] Fetching Agent/Staff permissions...`);
          if (!cancelled) setPermissionsLoaded(false);

          const agentRes = await axios.get(
            "/api/agent/get-module-permissions",
            {
              params: { moduleKey },
              headers: { Authorization: `Bearer ${token}` },
            },
          );

          if (cancelled) return;

          const data = agentRes.data;
          console.log(`[${debugLabel}] Agent Permissions API Response:`, data);

          if (
            !data?.permissions &&
            typeof data?.error === "string" &&
            data.error.includes("No permissions found for module")
          ) {
            console.log(
              `[${debugLabel}] Module not in permissions, granting full access by default`,
            );
            setPermissions(FULL_PERMISSIONS);
          } else if (agentRes.data.success) {
            const actions = data?.permissions?.actions || {};
            const newPerms = resolveActionsToPermissions(actions);
            console.log(`[${debugLabel}] Setting permissions:`, newPerms);
            setPermissions(newPerms);
          }
        } else {
          const clinicRes = await axios.get("/api/clinic/sidebar-permissions", {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (cancelled) return;

          if (clinicRes.data.success) {
            console.log(
              `[${debugLabel}] Clinic Sidebar Permissions Response:`,
              clinicRes.data,
            );

            const clinicPerms = clinicRes.data.permissions;
            if (
              clinicPerms === null ||
              !Array.isArray(clinicPerms) ||
              clinicPerms.length === 0
            ) {
              console.log(
                `[${debugLabel}] No permissions set, granting full access`,
              );
              setPermissions(FULL_PERMISSIONS);
            } else {
              const modulePermission = findModuleInClinicPermissions(
                clinicPerms,
                moduleKey,
                parentModuleKey,
                subModuleMatchers,
                debugLabel,
              );

              if (modulePermission) {
                const actions = modulePermission.actions || {};
                console.log(
                  `[${debugLabel}] Module permission actions:`,
                  actions,
                );
                const newPerms = resolveActionsToPermissions(actions);
                console.log(`[${debugLabel}] Setting permissions:`, newPerms);
                setPermissions(newPerms);
              } else {
                setPermissions(READ_ONLY_PERMISSIONS);
              }
            }
          }
        }
      } catch (err) {
        console.error(`[${debugLabel}] Error fetching permissions:`, err);
      } finally {
        if (!cancelled) setPermissionsLoaded(true);
      }
    };

    fetchPermissions();

    return () => {
      cancelled = true;
    };
    // Only primitive strings here — no array/object reference churn.
  }, [moduleKey, parentModuleKey, debugLabel]);

  // ============================================================
  // PermissionLoading — flat, matches the cream/dark-green
  // Finance Manager theme (no gradients/blur blobs)
  // ============================================================
  const PermissionLoading: React.FC = () => (
    <div className="min-h-screen bg-[#F8F5EF] dark:bg-[#0b1512] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#111d19] rounded-3xl shadow-sm border border-[#EDE7DA] dark:border-[#1a2622] px-10 py-10 flex flex-col items-center gap-6 min-w-[280px]">
        <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-950/40 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-teal-600 dark:text-teal-400 animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-base font-semibold text-stone-800 dark:text-stone-100 tracking-wide">
            Checking permissions…
          </p>
          <p className="text-xs text-stone-400 dark:text-stone-500">
            {debugLabel}
          </p>
        </div>
        {/* Dots */}
        <div className="flex items-center gap-1.5 pt-1">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-bounce [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-bounce [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-bounce" />
        </div>
      </div>
    </div>
  );

  // ============================================================
  // AccessDenied — flat, matches the cream/dark-green
  // Finance Manager theme (no gradients/blur blobs)
  // ============================================================
  const AccessDenied: React.FC = () => (
    <div className="min-h-screen bg-[#F8F5EF] dark:bg-[#0b1512] flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-2xl">
        <div className="bg-white dark:bg-[#111d19] rounded-3xl shadow-sm border border-[#EDE7DA] dark:border-[#1a2622] overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1.5 w-full bg-rose-500" />

          <div className="px-8 py-10 md:px-14 md:py-14 text-center">
            {/* Icon */}
            <div className="mx-auto w-24 h-24 mb-8 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 flex items-center justify-center">
              <div className="relative">
                <ShieldX className="w-11 h-11 text-rose-600 dark:text-rose-400 stroke-[1.75]" />
                <Lock className="w-5 h-5 text-white bg-rose-600 dark:bg-rose-500 rounded-full p-1 absolute -bottom-1 -right-2 shadow-md ring-2 ring-white dark:ring-[#111d19]" />
              </div>
            </div>

            {/* Title */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold tracking-widest uppercase mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              Restricted Area
            </div>
            <h2 className="zfm-display text-3xl md:text-4xl font-semibold text-stone-900 dark:text-stone-50 mb-3 tracking-tight">
              Access Denied
            </h2>
            <p className="text-stone-500 dark:text-stone-400 text-sm md:text-base max-w-md mx-auto mb-10 leading-relaxed">
              Your role doesn&apos;t have the necessary permissions to access
              this module. Please reach out to your clinic administrator to
              request access.
            </p>

            {/* CTA buttons */}
            {/* <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => router.push("/clinic/clinic-dashboard")}
                className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold shadow-sm hover:shadow transition-all duration-200 cursor-pointer"
              >
                <Home className="w-4 h-4 group-hover:scale-110 transition-transform" />
                Go to Dashboard
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem("token");
                  router.push("/");
                }}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl border border-[#E8E3D8] dark:border-[#1f2e29] bg-white dark:bg-[#16231f] hover:bg-[#F8F5EF] dark:hover:bg-[#1c2a25] text-stone-700 dark:text-stone-200 text-sm font-semibold transition-all duration-200 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div> */}

            {/* Footer note */}
            <p className="mt-10 text-[11px] uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500 font-semibold">
              Module &middot; {debugLabel}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const canAccessPage = permissions.canRead || permissions.canCreate;

  return {
    permissions,
    permissionsLoaded,
    isAgentStaff,
    role,
    AccessDenied,
    PermissionLoading,
    canAccessPage,
  };
};

export default useFinancePermission;
