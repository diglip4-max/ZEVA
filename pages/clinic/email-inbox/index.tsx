import React, { ReactElement, useState, useEffect } from "react";
import ClinicLayout from "@/components/ClinicLayout";
import withClinicAuth from "@/components/withClinicAuth";
import { NextPageWithLayout } from "@/pages/_app";
import axios from "axios";
import { useAgentPermissions } from "@/hooks/useAgentPermissions";
import Loader from "@/components/Loader";
import { Calendar } from "lucide-react";

import EmailInboxStyles from "./_components/EmailInboxStyles";
import EmailSidebar from "./_components/EmailSidebar";
import EmailList from "./_components/EmailList";
import EmailReadingPane from "./_components/EmailReadingPane";
import ComposeWindow from "./_components/ComposeWindow";
import EmailToast from "./_components/EmailToast";
import useEmailInbox from "@/hooks/useEmailInbox";
import DeleteConfirmModal from "./_components/DeleteConfirmModal";
import AddTagModal from "./_components/AddTagModal";
import FilterModal from "./_components/FilterModal";

const EMAIL_INBOX_MODULE_KEY = "clinic_email_inbox";

/**
 * EmailInboxPage
 * --------------------------------------------------------------------
 * Thin composition layer only — all business logic lives in
 * useEmailInbox, all presentation lives under ./_components.
 *
 * This is a NEW file (does not replace your existing EmailInboxPage).
 * Once you're happy with it, swap it in for the current page file.
 */
const EmailInboxPage: NextPageWithLayout = () => {
  const inbox = useEmailInbox();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const [permissions, setPermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canRead: false,
    canAssign: false,
  });
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Check if on agent route
  const currentPath =
    typeof window !== "undefined" ? window.location.pathname : "";
  const isAgentRoute = currentPath.startsWith("/agent/");

  // Use agent permissions hook for agent routes
  const agentPermissionsHook: any = useAgentPermissions(
    isAgentRoute ? EMAIL_INBOX_MODULE_KEY : null,
  );
  const agentPermissions = agentPermissionsHook?.permissions || {
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canAll: false,
  };
  const agentPermissionsLoading = agentPermissionsHook?.loading || false;

  // Helper function to get user info from token
  const getUserInfo = (): { role: string | null; id: string | null } => {
    if (typeof window === "undefined") return { role: null, id: null };
    try {
      const TOKEN_PRIORITY = [
        "clinicToken",
        "doctorToken",
        "agentToken",
        "staffToken",
        "userToken",
      ];
      for (const key of TOKEN_PRIORITY) {
        const tokenVal =
          localStorage.getItem(key) || sessionStorage.getItem(key);
        if (tokenVal) {
          try {
            const base64Url = tokenVal.split(".")[1];
            const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
            const jsonPayload = decodeURIComponent(
              atob(base64)
                .split("")
                .map(
                  (c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2),
                )
                .join(""),
            );
            const decoded = JSON.parse(jsonPayload);
            return {
              role: decoded.role || decoded.userRole || null,
              id: decoded.userId || decoded.id || null,
            };
          } catch (e) {
            continue;
          }
        }
      }
    } catch (error) {
      console.error("Error getting user info:", error);
    }
    return { role: null, id: null };
  };

  // Helper function to get user role from token
  const getUserRole = (): string | null => {
    return getUserInfo().role;
  };

  // Helper function to get stored token
  const getStoredToken = (): string | null => {
    if (typeof window === "undefined") return null;
    return (
      localStorage.getItem("agentToken") ||
      sessionStorage.getItem("agentToken") ||
      localStorage.getItem("staffToken") ||
      sessionStorage.getItem("staffToken") ||
      localStorage.getItem("userToken") ||
      sessionStorage.getItem("userToken") ||
      null
    );
  };

  // Handle agent permissions
  useEffect(() => {
    if (!isAgentRoute) return;
    if (agentPermissionsLoading) return;

    const newPermissions = {
      canRead: Boolean(agentPermissions.canAll || agentPermissions.canRead),
      canCreate: Boolean(agentPermissions.canAll || agentPermissions.canCreate),
      canUpdate: Boolean(agentPermissions.canAll || agentPermissions.canUpdate),
      canDelete: Boolean(agentPermissions.canAll || agentPermissions.canDelete),
      canAssign: Boolean(agentPermissions.canAll),
    };

    setPermissions(newPermissions);
    setPermissionsLoaded(true);
  }, [isAgentRoute, agentPermissions, agentPermissionsLoading]);

  // Handle clinic permissions - clinic, doctor have admin-level permissions; agent/doctorStaff need checks
  useEffect(() => {
    if (isAgentRoute) return;
    if (!isMounted) return;
    let isMountedFlag = true;

    // Check which token type is being used
    const clinicToken =
      typeof window !== "undefined"
        ? localStorage.getItem("clinicToken") ||
          sessionStorage.getItem("clinicToken")
        : null;
    const doctorToken =
      typeof window !== "undefined"
        ? localStorage.getItem("doctorToken") ||
          sessionStorage.getItem("doctorToken")
        : null;
    const agentToken =
      typeof window !== "undefined"
        ? localStorage.getItem("agentToken") ||
          sessionStorage.getItem("agentToken")
        : null;
    const staffToken =
      typeof window !== "undefined"
        ? localStorage.getItem("staffToken") ||
          sessionStorage.getItem("staffToken")
        : null;
    const userToken =
      typeof window !== "undefined"
        ? localStorage.getItem("userToken") ||
          sessionStorage.getItem("userToken")
        : null;

    const userRole = getUserRole();
    const authToken =
      clinicToken || doctorToken || agentToken || staffToken || userToken;

    // For admin role, grant full access (bypass permission checks)
    if (userRole === "admin") {
      if (!isMountedFlag) return;
      setPermissions({
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
        canAssign: true,
      });
      setPermissionsLoaded(true);
      return;
    }

    // For clinic and doctor roles, fetch admin-level permissions from /api/clinic/sidebar-permissions
    if (userRole === "clinic" || userRole === "doctor") {
      const fetchClinicPermissions = async () => {
        try {
          if (!authToken) {
            if (!isMountedFlag) return;
            setPermissions({
              canRead: false,
              canCreate: false,
              canUpdate: false,
              canDelete: false,
              canAssign: false,
            });
            setPermissionsLoaded(true);
            return;
          }

          const res = await axios.get("/api/clinic/sidebar-permissions", {
            headers: { Authorization: `Bearer ${authToken}` },
          });

          if (!isMountedFlag) return;

          if (res.data.success) {
            // Check if permissions array exists and is not null
            // If permissions is null, admin hasn't set any restrictions yet - allow full access (backward compatibility)
            if (
              res.data.permissions === null ||
              !Array.isArray(res.data.permissions) ||
              res.data.permissions.length === 0
            ) {
              // No admin restrictions set yet - default to full access for backward compatibility
              setPermissions({
                canRead: true,
                canCreate: true,
                canUpdate: true,
                canDelete: true,
                canAssign: true,
              });
            } else {
              // Admin has set permissions - check the clinic_email_inbox module
              // First check top-level permissions
              let modulePermission = res.data.permissions.find((p: any) => {
                if (!p?.module && !p?.moduleKey) return false;
                // Check for clinic_email_inbox module variations
                if (p.module === EMAIL_INBOX_MODULE_KEY) return true;
                if (p.moduleKey === EMAIL_INBOX_MODULE_KEY) return true;
                if (p.module === "email_inbox") return true;
                if (p.moduleKey === "email_inbox") return true;
                return false;
              });

              // If not found at top level, check in subModules of parent modules
              if (!modulePermission) {
                for (const parentModule of res.data.permissions) {
                  if (
                    parentModule.subModules &&
                    parentModule.subModules.length > 0
                  ) {
                    const foundInSubModule = parentModule.subModules.find(
                      (sm: any) => {
                        if (sm.moduleKey === EMAIL_INBOX_MODULE_KEY)
                          return true;
                        if (sm.moduleKey === "email_inbox") return true;
                        return false;
                      },
                    );
                    if (foundInSubModule) {
                      modulePermission = { actions: foundInSubModule.actions };
                      break;
                    }
                  }
                }
              }

              if (modulePermission) {
                const actions = modulePermission.actions || {};

                // Check if "all" is true, which grants all permissions
                const moduleAll =
                  actions.all === true ||
                  actions.all === "true" ||
                  String(actions.all).toLowerCase() === "true";
                const moduleCreate =
                  actions.create === true ||
                  actions.create === "true" ||
                  String(actions.create).toLowerCase() === "true";
                const moduleRead =
                  actions.read === true ||
                  actions.read === "true" ||
                  String(actions.read).toLowerCase() === "true";
                const moduleUpdate =
                  actions.update === true ||
                  actions.update === "true" ||
                  String(actions.update).toLowerCase() === "true";
                const moduleDelete =
                  actions.delete === true ||
                  actions.delete === "true" ||
                  String(actions.delete).toLowerCase() === "true";

                setPermissions({
                  canRead: moduleAll || moduleRead,
                  canCreate: moduleAll || moduleCreate,
                  canUpdate: moduleAll || moduleUpdate,
                  canDelete: moduleAll || moduleDelete,
                  canAssign: moduleAll,
                });
              } else {
                // Module permission not found in the permissions array - default to read-only
                setPermissions({
                  canRead: true, // Clinic/doctor can always read their own data
                  canCreate: false,
                  canUpdate: false,
                  canDelete: false,
                  canAssign: false,
                });
              }
            }
          } else {
            // API response doesn't have permissions, default to full access (backward compatibility)
            setPermissions({
              canRead: true,
              canCreate: true,
              canUpdate: true,
              canDelete: true,
              canAssign: true,
            });
          }
        } catch (err: any) {
          console.error("Error fetching clinic sidebar permissions:", err);
          // On error, default to full access (backward compatibility)
          if (isMountedFlag) {
            setPermissions({
              canRead: true,
              canCreate: true,
              canUpdate: true,
              canDelete: true,
              canAssign: true,
            });
          }
        } finally {
          if (isMountedFlag) {
            setPermissionsLoaded(true);
          }
        }
      };

      fetchClinicPermissions();
      return;
    }

    // For agent/doctorStaff tokens (when not on agent route), check permissions
    const agentStaffToken = getStoredToken();
    if (!agentStaffToken) {
      setPermissions({
        canRead: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        canAssign: false,
      });
      setPermissionsLoaded(true);
      return;
    }

    // Only check permissions for agent/doctorStaff roles when not on agent route
    if (agentToken || staffToken || userToken) {
      const fetchPermissions = async () => {
        try {
          console.log(
            "Fetching Agent/Staff Permissions for",
            EMAIL_INBOX_MODULE_KEY,
            "...",
          );
          setPermissionsLoaded(false);
          // Use agent permissions API for agent/doctorStaff
          const res = await axios.get("/api/agent/get-module-permissions", {
            params: { moduleKey: EMAIL_INBOX_MODULE_KEY },
            headers: { Authorization: `Bearer ${agentStaffToken}` },
          });
          const data = res.data;
          console.log("Agent Permissions API Response:", data);

          if (!isMountedFlag) return;

          // Default to true if module not found in permissions (matches backend logic)
          if (
            !data?.permissions &&
            data?.error?.includes("not found in agent permissions")
          ) {
            console.log(
              "Module not found in permissions, granting full access by default",
            );
            setPermissions({
              canRead: true,
              canCreate: true,
              canUpdate: true,
              canDelete: true,
              canAssign: true,
            });
            return;
          }

          const actions =
            data?.permissions?.actions || data?.data?.moduleActions || {};
          const isTrue = (val: any) =>
            val === true ||
            val === "true" ||
            String(val || "").toLowerCase() === "true";

          const canAll = isTrue(actions.all);

          const newPerms = {
            canRead: canAll || isTrue(actions.read),
            canCreate: canAll || isTrue(actions.create),
            canUpdate: canAll || isTrue(actions.update),
            canDelete: canAll || isTrue(actions.delete),
            canAssign: canAll,
          };

          console.log("Final Agent/Staff Permissions:", newPerms);
          setPermissions(newPerms);
        } catch (err: any) {
          console.error("Error fetching agent permissions:", err);
          // Swallow agent permission errors; they will just result in no extra access
          setPermissions({
            canRead: false,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            canAssign: false,
          });
        } finally {
          if (isMountedFlag) {
            setPermissionsLoaded(true);
          }
        }
      };

      fetchPermissions();
    } else {
      // Unknown token type - default to full access (likely clinic/doctor)
      if (!isMountedFlag) return;
      setPermissions({
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
        canAssign: true,
      });
      setPermissionsLoaded(true);
    }

    return () => {
      isMountedFlag = false;
    };
  }, [isAgentRoute, isMounted]);

  // Set mounted flag
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Show loading while permissions are being fetched
  if (!permissionsLoaded) {
    return <Loader />;
  }

  // Show access denied message if no permission
  if (!permissions.canRead) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Access Denied
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You do not have permission to view the email inbox. Please contact
            your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pi-root">
      <EmailInboxStyles />
      <EmailSidebar
        folder={inbox.folder}
        onFolderChange={inbox.setFolder}
        onCompose={() => inbox.startCompose("new")}
        unreadCountFor={inbox.unreadCountFor}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        canCreate={permissions.canCreate}
      />
      <EmailList
        folder={inbox.folder}
        messages={inbox.messages}
        loading={inbox.fetchMsgsLoading}
        search={inbox.search}
        onSearchChange={inbox.setSearch}
        selectedMessageId={inbox.selectedMessageId}
        onSelect={(conversationId, messageId) => {
          inbox.fetchConversation(conversationId);
          inbox.selectMessage(messageId);
          inbox.fetchThreadMessages(messageId);
        }}
        onToggleStar={inbox.starMessage}
        hasMore={inbox.hasMoreMessages}
        onLoadMore={inbox.loadMoreEmailMessages}
        listRef={inbox.conversationListRef as any}
        onFilterClick={() => setIsFilterModalOpen(true)}
        hasActiveFilters={!!inbox.filterOwnerId}
      />
      <EmailReadingPane
        messages={inbox.threadMessages}
        loading={inbox.fetchThreadMsgsLoading}
        starred={inbox.selectedMessage?.isStarred || false}
        archived={inbox.selectedMessage?.isArchived || false}
        trashed={inbox.selectedMessage?.isTrashed || false}
        onToggleStar={inbox.starMessage}
        onArchive={inbox.archiveMessage}
        onTrash={inbox.trashMessage}
        onDelete={inbox.deleteMessage}
        onRestoreFromTrash={inbox.restoreFromTrash}
        onRestoreFromArchive={inbox.restoreFromArchive}
        onReply={(m) => inbox.startCompose("reply", m)}
        onForward={(m) => inbox.startCompose("forward", m)}
        agents={inbox.agents}
        selectedAgent={inbox.selectedAgent}
        onAgentSelect={inbox.handleAgentSelect}
        agentFetchLoading={inbox.agentFetchLoading}
        // Tags
        tags={inbox.tags}
        onAddTag={() => inbox.setIsAddTagModalOpen(true)}
        onRemoveTag={(tag) =>
          inbox.handleRemoveTagFromConversation(inbox.leadId, tag)
        }
        leadId={inbox.leadId}
        // Permissions
        canCreate={permissions.canCreate}
        canUpdate={permissions.canUpdate}
        canDelete={permissions.canDelete}
        canAssign={permissions.canAssign}
      />
      {inbox.composeOpen && permissions.canCreate && (
        <ComposeWindow
          emailProviders={inbox.emailProviders}
          selectedProvider={inbox.selectedProvider}
          compose={inbox.compose}
          setCompose={inbox.setCompose}
          attachedFiles={inbox.attachedFiles}
          setAttachedFiles={inbox.setAttachedFiles}
          minimized={inbox.composeMinimized}
          setMinimized={inbox.setComposeMinimized}
          maximized={inbox.composeMaximized}
          setMaximized={inbox.setComposeMaximized}
          sending={inbox.sending}
          onClose={inbox.closeCompose}
          onSend={inbox.sendEmail}
          onSchedule={inbox.scheduleEmail}
        />
      )}
      {/* Delete confirm modal */}
      <DeleteConfirmModal
        isOpen={inbox.isOpenDeleteConfirmModal}
        loading={inbox.isDeletingMessage}
        onClose={inbox.closeDeleteConfirmModal}
        onConfirm={async () => {
          await inbox.deleteMessageForever();
        }}
      />
      {/* Add tag modal */}
      <AddTagModal
        isOpen={inbox.isAddTagModalOpen}
        onClose={() => inbox.setIsAddTagModalOpen(false)}
        leadId={inbox.leadId}
        conversationTitle={inbox.selectedMessage?.subject || "Email"}
        existingTags={inbox.tags}
        handleAddTagToConversation={inbox.handleAddTagToConversation}
        loading={inbox.isAddingTag}
      />
      {/* Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        agents={inbox.agents}
        selectedAgentId={inbox.filterOwnerId}
        onAgentSelect={inbox.setFilterOwnerId}
        onApplyFilters={() => inbox.fetchEmailMessages(1)}
        loading={inbox.fetchMsgsLoading}
      />
      <EmailToast message={inbox.toastMessage} />
    </div>
  );
};

EmailInboxPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

const ProtectedEmailInboxPage = withClinicAuth(
  EmailInboxPage,
) as NextPageWithLayout;
ProtectedEmailInboxPage.getLayout = EmailInboxPage.getLayout;

export default ProtectedEmailInboxPage;
