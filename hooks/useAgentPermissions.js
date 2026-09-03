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
              // Module-level "all" grants all submodule permissions
              const moduleAll = moduleActions.all === true;
              // If advance is explicitly set in customActions, it overrides "all"
              const hasModuleAdvance = 'advance' in moduleCustomActions;
              const hasSubAdvance = 'advance' in subCustomActions;
              const moduleAdvanceVal = hasModuleAdvance ? moduleCustomActions.advance === true : moduleAll;
              const subAdvanceVal = hasSubAdvance ? subCustomActions.advance === true : (moduleAll || subActions.all === true);
              const hasModuleCopy = 'copy' in moduleCustomActions;
              const hasSubCopy = 'copy' in subCustomActions;
              const moduleCopyVal = hasModuleCopy ? moduleCustomActions.copy === true : moduleAll;
              const subCopyVal = hasSubCopy ? subCustomActions.copy === true : (moduleAll || subActions.all === true);
              
              setPermissions({
                canCreate: moduleAll || moduleActions.create === true || subActions.create === true || subActions.all === true,
                canRead: moduleAll || moduleActions.read === true || subActions.read === true || subActions.all === true,
                canUpdate: moduleAll || moduleActions.update === true || subActions.update === true || subActions.all === true,
                canDelete: moduleAll || moduleActions.delete === true || subActions.delete === true || subActions.all === true,
                canApprove: moduleAll || moduleActions.approve === true || subActions.approve === true || subActions.all === true,
                canPrint: moduleAll || moduleActions.print === true || subActions.print === true || subActions.all === true,
                canExport: moduleAll || moduleActions.export === true || subActions.export === true || subActions.all === true,
                canAdvance: hasSubAdvance ? subAdvanceVal : moduleAdvanceVal,
                canAll: moduleAll || subActions.all === true,
                canCopy: hasSubCopy ? subCopyVal : moduleCopyVal,
              });
            } else {
              // Submodule not found, use module-level permissions
              // If advance is explicitly set in customActions, it overrides "all"
              const hasModuleAdvance = 'advance' in moduleCustomActions;
              const moduleAdvanceVal = hasModuleAdvance ? moduleCustomActions.advance === true : moduleActions.all === true;
              const hasModuleCopy = 'copy' in moduleCustomActions;
const moduleCopyVal = hasModuleCopy ? moduleCustomActions.copy === true : moduleActions.all === true;
              setPermissions({
                canCreate: moduleActions.all === true || moduleActions.create === true,
                canRead: moduleActions.all === true || moduleActions.read === true,
                canUpdate: moduleActions.all === true || moduleActions.update === true,
                canDelete: moduleActions.all === true || moduleActions.delete === true,
                canApprove: moduleActions.all === true || moduleActions.approve === true,
                canPrint: moduleActions.all === true || moduleActions.print === true,
                canExport: moduleActions.all === true || moduleActions.export === true,
                canAdvance: moduleAdvanceVal,
                canCopy: moduleCopyVal,
                canAll: moduleActions.all === true
              });
            }
          } else {
            // Module-level permissions only
            // If advance is explicitly set in customActions, it overrides "all"
            const hasModuleAdvance = 'advance' in moduleCustomActions;
            const moduleAdvanceVal = hasModuleAdvance ? moduleCustomActions.advance === true : moduleActions.all === true;
            const parsedPermissions = {
              canCreate: moduleActions.all === true || moduleActions.create === true,
              canRead: moduleActions.all === true || moduleActions.read === true,
              canUpdate: moduleActions.all === true || moduleActions.update === true,
              canDelete: moduleActions.all === true || moduleActions.delete === true,
              canApprove: moduleActions.all === true || moduleActions.approve === true,
              canPrint: moduleActions.all === true || moduleActions.print === true,
              canExport: moduleActions.all === true || moduleActions.export === true,
              canAdvance: moduleAdvanceVal,
              canAll: moduleActions.all === true
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
          // No permissions found
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
        }
      } catch (err) {
        console.error('Error fetching agent permissions:', err);
        setError(err.response?.data?.message || err.message || 'Failed to fetch permissions');
        setPermissions({
          canCreate: false,
          canRead: false,
          canUpdate: false,
          canDelete: false,
          canApprove: false,
          canPrint: false,
          canExport: false,
          canAdvance: false,
          canAll: false, 
          canCopy: false,
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

