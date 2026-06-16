// Helper function to check agent permissions
import dbConnect from "../../../lib/database";
import AgentPermission from "../../../models/AgentPermission";
import User from "../../../models/Users";

/**
 * Check if agent has permission for a specific module and action
 * @param {Object} agentId - Agent ID (ObjectId)
 * @param {String} moduleKey - Module key (e.g., "lead", "create_offers")
 * @param {String} action - Action (e.g., "create", "read", "update", "delete", "approve")
 * @param {String} subModuleName - Optional submodule name (e.g., "Create Lead", "Assign Lead")
 * @returns {Object} { hasPermission: boolean, error: string | null }
 */
export async function checkAgentPermission(agentId, moduleKey, action, subModuleName = null) {
  await dbConnect();

  if (!agentId) {
    return { hasPermission: false, error: "Agent ID is required" };
  }

  try {
    // Find agent permissions
    const agentPermission = await AgentPermission.findOne({
      agentId,
      isActive: true
    }).lean();

    // If no permissions found, deny access
    if (!agentPermission || !agentPermission.permissions || agentPermission.permissions.length === 0) {
      return { hasPermission: false, error: "No permissions found for this agent" };
    }

    // Handle module key matching (with or without role prefix)
    const moduleCandidates = Array.from(
      new Set([
        moduleKey,
        moduleKey?.replace(/^(admin|clinic|doctor)_/, ''), // Remove role prefix
        moduleKey ? `admin_${moduleKey}` : null,
        moduleKey ? `clinic_${moduleKey}` : null,
        moduleKey ? `doctor_${moduleKey}` : null,
      ].filter(Boolean))
    );

    // Find the module permission using any of the candidate keys
    let modulePermission = null;


    // COMPREHENSIVE SEARCH STRATEGY (in order of precision):
    
    // Strategy 1: EXACT direct module match (highest priority)
    modulePermission = agentPermission.permissions.find(
      (p) => {
        const permModule = p.module || '';
        const found = moduleCandidates.some(candidate => permModule === candidate);
        if (found) 
        return found;
      }
    );

    if (!modulePermission) {
      // Strategy 2: SubModule by EXACT moduleKey match
      for (const permission of agentPermission.permissions) {
        if (Array.isArray(permission.subModules) && permission.subModules.length > 0) {
          const subModule = permission.subModules.find((sm) => {
            if (!sm.moduleKey) return false;
            const found = moduleCandidates.some(candidate => sm.moduleKey === candidate);
            if (found) {
             
            }
            return found;
          });
          if (subModule) {
            modulePermission = subModule;
            break;
          }
        }
      }
    }

    if (!modulePermission) {
      // Strategy 3: Direct module with prefix normalization (only if prefixes match)
      modulePermission = agentPermission.permissions.find(
        (p) => {
          const permModule = p.module || '';
          const found = moduleCandidates.some(candidate => {
            // Only match if they have the same prefix
            const permPrefix = permModule.match(/^(admin|clinic|doctor)_/)?.[0] || '';
            const candidatePrefix = candidate.match(/^(admin|clinic|doctor)_/)?.[0] || '';
            return permPrefix === candidatePrefix && permModule === candidate;
          });
          if (found) 
          return found;
        }
      );
    }

    if (!modulePermission) {
      // Strategy 4: SubModule by normalized moduleKey (fallback)
      for (const permission of agentPermission.permissions) {
        if (Array.isArray(permission.subModules) && permission.subModules.length > 0) {
          const subModule = permission.subModules.find((sm) => {
            if (!sm.moduleKey) return false;
            const found = moduleCandidates.some(candidate => 
              sm.moduleKey.replace(/^(admin|clinic|doctor)_/, '') === candidate.replace(/^(admin|clinic|doctor)_/, '')
            );
            if (found) {
              
            }
            return found;
          });
          if (subModule) {
            modulePermission = subModule;
            break;
          }
        }
      }
    }

    if (!modulePermission) {
      // Strategy 5: SubModule by name fuzzy match (last resort)
      for (const permission of agentPermission.permissions) {
        if (Array.isArray(permission.subModules) && permission.subModules.length > 0) {
          const subModule = permission.subModules.find((sm) => 
            sm.name && moduleCandidates.some(candidate => {
              const candidateName = candidate.replace(/^(admin|clinic|doctor)_/, '').replace(/_/g, ' ').toLowerCase();
              const subModuleName = sm.name.toLowerCase();
              const found = subModuleName.includes(candidateName) || candidateName.includes(subModuleName);
              if (found) 
              return found;
            })
          );
          if (subModule) {
            modulePermission = subModule;
            break;
          }
        }
      }
    }

    if (!modulePermission) {
    }

    // Check module-level "all" permission first (before submodule checks)
    // Handle both boolean true and string "true" cases
    const hasAllPermission = modulePermission.actions?.all === true || 
                             modulePermission.actions?.all === "true" ||
                             String(modulePermission.actions?.all).toLowerCase() === "true";
    
    if (hasAllPermission) {
      // console.log('[agent-permissions-helper] Module has "all" permission, granting access');
      return { hasPermission: true, error: null };
    }

    // If checking submodule permission
    if (subModuleName) {
      // PRIORITY 1: Check module-level "all" first - this grants all permissions including submodules
      // (Already checked above, but keeping for clarity)
      if (hasAllPermission) {
        return { hasPermission: true, error: null };
      }

      // PRIORITY 2: Check module-level specific action - this also grants permission for submodules
      if (Boolean(modulePermission.actions?.[action])) {
        return { hasPermission: true, error: null };
      }

      // PRIORITY 3: Check if submodule exists
      const subModule = modulePermission.subModules?.find(
        (sm) => sm.name === subModuleName
      );

      // If submodule doesn't exist, deny (module-level permissions already checked above)
      if (!subModule) {
        return { hasPermission: false, error: `Submodule ${subModuleName} not found in permissions` };
      }

      // PRIORITY 4: Check submodule-level "all"
      if (Boolean(subModule.actions?.all)) {
        return { hasPermission: true, error: null };
      }

      // PRIORITY 5: Check submodule-level specific action
      if (Boolean(subModule.actions?.[action])) {
        return { hasPermission: true, error: null };
      }

      return { hasPermission: false, error: `Permission denied: ${action} action not allowed for submodule ${subModuleName}` };
    }

    // Check module-level permission
    // If "all" action is enabled, grant all permissions (already checked above, but keeping for safety)
    const hasAllPermissionFinal = modulePermission.actions?.all === true || 
                                   modulePermission.actions?.all === "true" ||
                                   String(modulePermission.actions?.all).toLowerCase() === "true";
    
    if (hasAllPermissionFinal) {
      return { hasPermission: true, error: null };
    }

    // Check specific action - handle both boolean and string cases
    const hasSpecificAction = modulePermission.actions?.[action] === true || 
                               modulePermission.actions?.[action] === "true" ||
                               String(modulePermission.actions?.[action]).toLowerCase() === "true";
    
    if (hasSpecificAction) {
      return { hasPermission: true, error: null };
    }

    return { hasPermission: false, error: `Permission denied: ${action} action not allowed for module ${moduleKey}` };
  } catch (error) {
    // console.error("Error checking agent permission:", error);
    return { hasPermission: false, error: "Error checking permissions" };
  }
}

/**
 * Get agent permissions for a specific module
 * @param {Object} agentId - Agent ID (ObjectId)
 * @param {String} moduleKey - Module key (e.g., "lead")
 * @returns {Object} { permissions: Object | null, error: string | null }
 */
export async function getAgentModulePermissions(agentId, moduleKey) {
  await dbConnect();

  

  if (!agentId) {
   
    return { permissions: null, error: "Agent ID is required" };
  }

  try {
    // Step 1: Fetch all agent permissions from database
    const agentPermission = await AgentPermission.findOne({
      agentId,
      isActive: true
    });

    
    
    if (!agentPermission || !agentPermission.permissions || agentPermission.permissions.length === 0) {
     
      return { permissions: null, error: "No permissions found for this agent" };
    }

    // Step 2: Log ALL stored permissions to see what's in the database
   
    agentPermission.permissions.forEach((perm, index) => {
     
      if (perm.subModules?.length > 0) {
        perm.subModules.forEach((sm, smIndex) => {
         
        });
      }
    });

    // Step 3: Generate all module candidate variations
    const moduleCandidates = Array.from(
      new Set([
        moduleKey,
        moduleKey?.replace(/^(admin|clinic|doctor)_/, ''),
        moduleKey ? `admin_${moduleKey}` : null,
        moduleKey ? `clinic_${moduleKey}` : null,
        moduleKey ? `doctor_${moduleKey}` : null,
      ].filter(Boolean))
    );

    moduleCandidates.forEach((candidate, index) => {
     
    });

    // COMPREHENSIVE SEARCH STRATEGY (in order of precision):
    let modulePermission = null;
    
    // Strategy 1: EXACT direct module match (highest priority)
    modulePermission = agentPermission.permissions.find(
      (p) => {
        const permModule = p.module || '';
        const found = moduleCandidates.some(candidate => permModule === candidate);
        if (found) {
         
        }
        return found;
      }
    );

    if (!modulePermission) {
      // Strategy 2: SubModule by EXACT moduleKey match
      for (const permission of agentPermission.permissions) {
        if (Array.isArray(permission.subModules) && permission.subModules.length > 0) {
          const subModule = permission.subModules.find((sm) => {
            if (!sm.moduleKey) return false;
            const found = moduleCandidates.some(candidate => sm.moduleKey === candidate);
            if (found) {
            
            }
            return found;
          });
          if (subModule) {
            modulePermission = subModule;
            break;
          }
        }
      }
    }

    if (!modulePermission) {
      // Strategy 3: Direct module with SAME prefix only
      modulePermission = agentPermission.permissions.find(
        (p) => {
          const permModule = p.module || '';
          const found = moduleCandidates.some(candidate => {
            const permPrefix = permModule.match(/^(admin|clinic|doctor)_/)?.[0] || '';
            const candidatePrefix = candidate.match(/^(admin|clinic|doctor)_/)?.[0] || '';
            return permPrefix === candidatePrefix && permModule === candidate;
          });
          if (found) {
          
          }
          return found;
        }
      );
    }

    if (!modulePermission) {
      // Strategy 4: SubModule by normalized moduleKey (fallback)
      for (const permission of agentPermission.permissions) {
        if (Array.isArray(permission.subModules) && permission.subModules.length > 0) {
          const subModule = permission.subModules.find((sm) => {
            if (!sm.moduleKey) return false;
            const found = moduleCandidates.some(candidate => 
              sm.moduleKey.replace(/^(admin|clinic|doctor)_/, '') === candidate.replace(/^(admin|clinic|doctor)_/, '')
            );
            if (found) {
            }
            return found;
          });
          if (subModule) {
            modulePermission = subModule;
            break;
          }
        }
      }
    }

    if (!modulePermission) {
      // Strategy 5: SubModule by name fuzzy match (last resort)
      for (const permission of agentPermission.permissions) {
        if (Array.isArray(permission.subModules) && permission.subModules.length > 0) {
          const subModule = permission.subModules.find((sm) => {
            if (!sm.name) return false;
            const found = moduleCandidates.some(candidate => {
              const candidateName = candidate.replace(/^(admin|clinic|doctor)_/, '').replace(/_/g, ' ').toLowerCase();
              const subModuleName = sm.name.toLowerCase();
              return subModuleName.includes(candidateName) || candidateName.includes(subModuleName);
            });
            if (found) {
            }
            return found;
          });
          if (subModule) {
            modulePermission = subModule;
            break;
          }
        }
      }
    }

    // Step 9: Final result

    if (!modulePermission) {
      
      return { permissions: null, error: `No permissions found for module: ${moduleKey}` };
    }

    if (modulePermission.name) {
    }
    if (modulePermission.moduleKey) {
    }
   

    if (!modulePermission) {
     
      return { permissions: null, error: `No permissions found for module: ${moduleKey}` };
    }

    
    
    return { permissions: modulePermission, error: null };
  } catch (error) {
   
    return { permissions: null, error: "Error getting permissions" };
  }
}

