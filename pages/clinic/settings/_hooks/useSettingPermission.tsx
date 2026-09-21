import React, { useState, useEffect } from "react";
import axios from "axios";
import { getTokenByPath } from "@/lib/helper";
import { Lock, ShieldX, Settings2 } from "lucide-react";

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

export interface UseSettingPermissionOptions {
  moduleKey: string;
  parentModuleKey?: string;
  subModuleMatchers?: SubModuleMatcher[];
  debugLabel?: string;
}

export interface UseSettingPermissionReturn {
  permissions: ModulePermissions;
  permissionsLoaded: boolean;
  isAgentStaff: boolean;
  role: string | null;
  AccessDenied: React.FC;
  PermissionLoading: React.FC;
  canAccessPage: boolean;
}

// ============================================================
// PURE HELPERS — stable identity, defined at module level
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

const useSettingPermission = (
  options: UseSettingPermissionOptions,
): UseSettingPermissionReturn => {
  const {
    moduleKey,
    parentModuleKey,
    subModuleMatchers = [],
    debugLabel = moduleKey,
  } = options;

  const [permissions, setPermissions] =
    useState<ModulePermissions>(FULL_PERMISSIONS);
  const [permissionsLoaded, setPermissionsLoaded] = useState<boolean>(false);
  const [isAgentStaff, setIsAgentStaff] = useState<boolean>(false);
  const [role, setRole] = useState<string | null>(null);

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
  }, [moduleKey, parentModuleKey, debugLabel]);

  // ============================================================
  // PermissionLoading — Elegant, matches Settings UI
  // ============================================================
  const PermissionLoading: React.FC = () => (
    <div className="min-h-[60vh] flex items-center justify-center p-4 bg-white dark:bg-[#0f1513]">
      <div className="flex flex-col items-center gap-5">
        {/* Spinner with subtle ring */}
        <div className="relative">
          <div className="w-14 h-14 rounded-full border-[3px] border-stone-100 dark:border-stone-800" />
          <div className="absolute inset-0 w-14 h-14 rounded-full border-[3px] border-transparent border-t-teal-600 dark:border-t-teal-400 animate-spin" />
          <Settings2 className="absolute inset-0 m-auto w-5 h-5 text-teal-600 dark:text-teal-400" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-stone-700 dark:text-stone-200">
            Loading settings…
          </p>
          <p className="text-xs text-stone-400 dark:text-stone-500">
            {debugLabel}
          </p>
        </div>
      </div>
    </div>
  );

  // ============================================================
  // AccessDenied — Clean, modern card, fits Settings UI
  // ============================================================
  const AccessDenied: React.FC = () => (
    <div className="min-h-[60vh] flex items-center justify-center p-4 md:p-6 bg-white dark:bg-[#0f1513]">
      <div className="w-full max-w-lg">
        <div className="bg-white dark:bg-[#16211d] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
          {/* Accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-rose-500 to-rose-400" />

          <div className="px-8 py-10 md:px-12 md:py-12 text-center">
            {/* Icon */}
            <div className="mx-auto w-20 h-20 mb-6 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 flex items-center justify-center">
              <div className="relative">
                <ShieldX className="w-9 h-9 text-rose-500 dark:text-rose-400 stroke-[1.75]" />
                <div className="absolute -bottom-1 -right-2 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center shadow ring-2 ring-white dark:ring-[#16211d]">
                  <Lock className="w-2.5 h-2.5 text-white" />
                </div>
              </div>
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 text-[10px] font-bold tracking-[0.15em] uppercase mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              Restricted
            </div>

            {/* Title */}
            <h2 className="text-2xl md:text-3xl font-semibold text-stone-900 dark:text-stone-50 mb-3 tracking-tight">
              Access Denied
            </h2>

            {/* Description */}
            <p className="text-sm text-stone-500 dark:text-stone-400 max-w-sm mx-auto mb-8 leading-relaxed">
              You don&apos;t have permission to view this settings module.
              Please contact your administrator to request access.
            </p>

            {/* Footer */}
            <div className="pt-6 border-t border-stone-100 dark:border-stone-800">
              <p className="text-[10px] uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500 font-semibold">
                Module &middot; {debugLabel}
              </p>
            </div>
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

export default useSettingPermission;
