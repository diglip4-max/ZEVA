// hooks/useAgentPermissions.js
// React hook for checking agent permissions on the frontend
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

/**
 * Hook to check agent permissions for a module/submodule
 * @param {string|null} moduleKey - The module key (e.g., "lead", "create_offers"). Pass null to skip fetching.
 * @param {string} subModuleName - Optional submodule name (e.g., "Create Lead")
 * @returns {Object} { permissions, loading, error, checkPermission }
 */
export function useAgentPermissions(moduleKey, subModuleName = null) {
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false,
    canApprove: false,
    canPrint: false,
    canExport: false,
    canAdvance: false,
    canCopy: false,
    canAll: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPermissions = async () => {
      // MODIFIED: Always reset loading to true when moduleKey changes to ensure proper loading state
      setLoading(true);
      setError(null);
      
      // If moduleKey is null/undefined, skip fetching (for non-agent users)
      if (!moduleKey) {
        setPermissions({
          canCreate: false,
          canRead: false,
          canUpdate: false,
          canDelete: false,
          canApprove: false,
          canPrint: false,
          canExport: false,
          canAdvance: false,
          canAll: false
        });
        setLoading(false);
        return;
      }

      try {
        // Check for multiple token types (priority: agentToken > userToken > clinicToken > doctorToken > adminToken)
        const token = 
          localStorage.getItem('agentToken') || 
          sessionStorage.getItem('agentToken') ||
          localStorage.getItem('userToken') || 
          sessionStorage.getItem('userToken') ||
          localStorage.getItem('clinicToken') || 
          sessionStorage.getItem('clinicToken') ||
          localStorage.getItem('doctorToken') || 
          sessionStorage.getItem('doctorToken') ||
          localStorage.getItem('adminToken') || 
          sessionStorage.getItem('adminToken');
          
        if (!token) {
          setError('No authentication token found');
          setPermissions({
            canCreate: true,
            canRead: true,
            canUpdate: true,
            canDelete: true,
            canApprove: true,
            canPrint: true,
            canExport: true,
            canAdvance: true,
            canCopy: true,
            canAll: true
          });
          setLoading(false);
          return;
        }

        const { data } = await axios.get('/api/agent/get-module-permissions', {
          params: { moduleKey },
          headers: { Authorization: `Bearer ${token}` }
        });

        if (data.success && data.permissions) {
          const moduleActions = data.permissions.actions || {};
          // customActions is at the module level (same level as actions), not inside actions
          const moduleCustomActions = data.permissions.customActions || {};
          
          // Debug: Log the raw API response
         
          
          // Verify moduleKey matches (with or without prefix)
          const storedModule = data.permissions.module || '';
          const moduleMatches = storedModule === moduleKey || 
                               storedModule.replace(/^(admin|clinic|doctor)_/, '') === moduleKey.replace(/^(admin|clinic|doctor)_/, '') ||
                               moduleKey === storedModule.replace(/^(admin|clinic|doctor)_/, '') ||
                               `admin_${moduleKey}` === storedModule ||
                               `clinic_${moduleKey}` === storedModule ||
                               `doctor_${moduleKey}` === storedModule;
          
          if (!moduleMatches) {
            console.warn('ModuleKey mismatch! Requested:', moduleKey, 'Got:', storedModule);
          }
          
          // If checking submodule permissions
          if (subModuleName) {
            const subModule = data.permissions.subModules?.find(
              sm => sm.name === subModuleName
            );
            
            if (subModule) {
              const subActions = subModule.actions || {};
              // customActions at module and submodule levels
              const subCustomActions = subModule.customActions || {};
              // Helper function to check if a value is truthy (handles boolean true, string "true", etc.)
              const isTrue = (val) => val === true || val === "true" || String(val || "").toLowerCase() === "true";
              // Module-level "all" grants all submodule permissions
              const moduleAll = isTrue(moduleActions.all);
              // If advance is explicitly set in customActions, it overrides "all"
              const hasModuleAdvance = 'advance' in moduleCustomActions;
              const hasSubAdvance = 'advance' in subCustomActions;
              const moduleAdvanceVal = hasModuleAdvance ? moduleCustomActions.advance === true : moduleAll;
              const subAdvanceVal = hasSubAdvance ? subCustomActions.advance === true : (moduleAll || isTrue(subActions.all));
              const hasModuleCopy = 'copy' in moduleCustomActions;
              const hasSubCopy = 'copy' in subCustomActions;
              const moduleCopyVal = hasModuleCopy ? moduleCustomActions.copy === true : moduleAll;
              const subCopyVal = hasSubCopy ? subCustomActions.copy === true : (moduleAll || isTrue(subActions.all));
              
              setPermissions({
                canCreate: moduleAll || isTrue(moduleActions.create) || isTrue(subActions.create) || isTrue(subActions.all),
                canRead: moduleAll || isTrue(moduleActions.read) || isTrue(subActions.read) || isTrue(subActions.all),
                canUpdate: moduleAll || isTrue(moduleActions.update) || isTrue(subActions.update) || isTrue(subActions.all),
                canDelete: moduleAll || isTrue(moduleActions.delete) || isTrue(subActions.delete) || isTrue(subActions.all),
                canApprove: moduleAll || isTrue(moduleActions.approve) || isTrue(subActions.approve) || isTrue(subActions.all),
                canPrint: moduleAll || isTrue(moduleActions.print) || isTrue(subActions.print) || isTrue(subActions.all),
                canExport: moduleAll || isTrue(moduleActions.export) || isTrue(subActions.export) || isTrue(subActions.all),
                canAdvance: hasSubAdvance ? subAdvanceVal : moduleAdvanceVal,
                canAll: moduleAll || isTrue(subActions.all),
                canCopy: hasSubCopy ? subCopyVal : moduleCopyVal,
              });
            } else {
              // Submodule not found, use module-level permissions
              // Helper function to check if a value is truthy (handles boolean true, string "true", etc.)
              const isTrue = (val) => val === true || val === "true" || String(val || "").toLowerCase() === "true";
              // If advance is explicitly set in customActions, it overrides "all"
              const hasModuleAdvance = 'advance' in moduleCustomActions;
              const moduleAdvanceVal = hasModuleAdvance ? moduleCustomActions.advance === true : isTrue(moduleActions.all);
              const hasModuleCopy = 'copy' in moduleCustomActions;
              const moduleCopyVal = hasModuleCopy ? moduleCustomActions.copy === true : isTrue(moduleActions.all);
              setPermissions({
                canCreate: isTrue(moduleActions.all) || isTrue(moduleActions.create),
                canRead: isTrue(moduleActions.all) || isTrue(moduleActions.read),
                canUpdate: isTrue(moduleActions.all) || isTrue(moduleActions.update),
                canDelete: isTrue(moduleActions.all) || isTrue(moduleActions.delete),
                canApprove: isTrue(moduleActions.all) || isTrue(moduleActions.approve),
                canPrint: isTrue(moduleActions.all) || isTrue(moduleActions.print),
                canExport: isTrue(moduleActions.all) || isTrue(moduleActions.export),
                canAdvance: moduleAdvanceVal,
                canCopy: moduleCopyVal,
                canAll: isTrue(moduleActions.all)
              });
            }
          } else {
            // Module-level permissions only
            // Helper function to check if a value is truthy (handles boolean true, string "true", etc.)
            const isTrue = (val) => val === true || val === "true" || String(val || "").toLowerCase() === "true";
            
            // If advance is explicitly set in customActions, it overrides "all"
            const hasModuleAdvance = 'advance' in moduleCustomActions;
            const moduleAdvanceVal = hasModuleAdvance ? moduleCustomActions.advance === true : isTrue(moduleActions.all);
            const parsedPermissions = {
              canCreate: isTrue(moduleActions.all) || isTrue(moduleActions.create),
              canRead: isTrue(moduleActions.all) || isTrue(moduleActions.read),
              canUpdate: isTrue(moduleActions.all) || isTrue(moduleActions.update),
              canDelete: isTrue(moduleActions.all) || isTrue(moduleActions.delete),
              canApprove: isTrue(moduleActions.all) || isTrue(moduleActions.approve),
              canPrint: isTrue(moduleActions.all) || isTrue(moduleActions.print),
              canExport: isTrue(moduleActions.all) || isTrue(moduleActions.export),
              canAdvance: moduleAdvanceVal,
              canAll: isTrue(moduleActions.all)
            };
            
            // Ensure all values are proper booleans (not undefined)
            const finalPermissions = {
              canCreate: Boolean(parsedPermissions.canCreate),
              canRead: Boolean(parsedPermissions.canRead),
              canUpdate: Boolean(parsedPermissions.canUpdate),
              canDelete: Boolean(parsedPermissions.canDelete),
              canApprove: Boolean(parsedPermissions.canApprove),
              canPrint: Boolean(parsedPermissions.canPrint),
              canExport: Boolean(parsedPermissions.canExport),
              canAdvance: Boolean(parsedPermissions.canAdvance),
              canAll: Boolean(parsedPermissions.canAll)
            };
            
            setPermissions(finalPermissions);
            
            // Debug logging to help identify permission issues
            console.log('Agent Permissions Parsed:', {
              moduleKey,
              moduleActions,
              rawDelete: moduleActions.delete,
              rawDeleteType: typeof moduleActions.delete,
              rawAll: moduleActions.all,
              rawAllType: typeof moduleActions.all,
              parsedDelete: parsedPermissions.canDelete,
              parsedDeleteType: typeof parsedPermissions.canDelete,
              finalDelete: finalPermissions.canDelete,
              finalDeleteType: typeof finalPermissions.canDelete,
              finalPermissions,
              willShowDeleteButton: finalPermissions.canDelete === true || finalPermissions.canAll === true
            });
          }
        } else {
          // No permissions found - default to full access for backward compatibility
          setPermissions({
            canCreate: true,
            canRead: true,
            canUpdate: true,
            canDelete: true,
            canApprove: true,
            canPrint: true,
            canExport: true,
            canAdvance: true,
            canCopy: true,
            canAll: true
          });
        }
      } catch (err) {
        const status = err.response?.status;
        if (status !== 401 && status !== 403) {
          console.debug("Agent module permissions fetch issue:", err.message || String(err));
        }
        setError(err.response?.data?.message || err.message || 'Failed to fetch permissions');
        setPermissions({
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canDelete: true,
          canApprove: true,
          canPrint: true,
          canExport: true,
          canAdvance: true,
          canCopy: true,
          canAll: true,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [moduleKey, subModuleName]);

  // Function to check a specific permission
  const checkPermission = useCallback(async (action) => {
    if (!moduleKey || !action) return false;

    try {
      // Check for multiple token types
      const token = 
        localStorage.getItem('agentToken') || 
        sessionStorage.getItem('agentToken') ||
        localStorage.getItem('userToken') || 
        sessionStorage.getItem('userToken') ||
        localStorage.getItem('clinicToken') || 
        sessionStorage.getItem('clinicToken') ||
        localStorage.getItem('doctorToken') || 
        sessionStorage.getItem('doctorToken') ||
        localStorage.getItem('adminToken') || 
        sessionStorage.getItem('adminToken');
        
      if (!token) return false;

      const { data } = await axios.get('/api/agent/check-permission', {
        params: { 
          moduleKey, 
          action,
          ...(subModuleName && { subModuleName })
        },
        headers: { Authorization: `Bearer ${token}` }
      });

      return data.success && data.hasPermission === true;
    } catch (err) {
      console.error('Error checking permission:', err);
      return false;
    }
  }, [moduleKey, subModuleName]);

  return { permissions, loading, error, checkPermission };
}

