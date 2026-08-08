// lib/hasPermission.js
// ─────────────────────────────────────────────────────────────────────────────
// Enterprise permission-check helpers that support both fixed CRUD actions
// (create / read / update / delete / import / export) AND dynamic custom
// actions stored in the customActions Map on each module / submodule.
//
// These utilities are pure functions — they do NOT touch the database.
// They operate on an already-loaded actions object (from .lean() or Mongoose doc).
// ─────────────────────────────────────────────────────────────────────────────

import { isRegisteredCustomAction } from '../config/actionRegistry';

// Fixed action keys that live as real boolean fields on the actions schema.
const FIXED_ACTIONS = new Set(['all', 'create', 'read', 'update', 'delete', 'import', 'export']);

/**
 * Normalize a single action value to a boolean.
 * Handles: true, false, "true", "false", and other string representations.
 */
function toBool(val) {
  if (val === true || val === 'true') return true;
  if (val === false || val === 'false') return false;
  return Boolean(val);
}

/**
 * Read an action value from a permission object that may be:
 *   - a plain object  (from .lean())
 *   - a Mongoose sub-document
 *   - contain a customActions Map or plain-object equivalent
 *
 * customActions lives at the SAME level as actions (not inside it).
 *
 * @param {Object} permObj   – the full permission object (has .actions and .customActions)
 *                             OR the actions object itself (backward compat)
 * @param {string} actionKey – the action to check (e.g. "create", "advance")
 * @returns {boolean|undefined} – true / false / undefined (if key not found)
 */
export function getActionValue(permObj, actionKey) {
  if (!permObj) return undefined;

  // 1. Fixed action fields (direct boolean properties on .actions)
  if (FIXED_ACTIONS.has(actionKey)) {
    // permObj might be the actions object itself (backward compat)
    // or the full permission object with .actions
    const actions = permObj.actions || permObj;
    return toBool(actions[actionKey]);
  }

  // 2. Custom actions – stored in customActions at the SAME level as actions
  // Try permObj.customActions first (full permission object)
  // Fall back to permObj.actions.customActions (backward compat)
  const custom = permObj.customActions || permObj.actions?.customActions;
  if (!custom) return undefined;

  // Mongoose Map: use .get()
  if (custom instanceof Map) {
    return custom.has(actionKey) ? toBool(custom.get(actionKey)) : undefined;
  }

  // Plain object (from .lean() or JSON deserialization)
  if (typeof custom === 'object') {
    return actionKey in custom ? toBool(custom[actionKey]) : undefined;
  }

  return undefined;
}

/**
 * Check whether a specific action is granted on a permission object.
 * - Returns true immediately if actions.all is true.
 * - Checks fixed boolean fields first.
 * - Falls back to customActions for non-fixed keys.
 *
 * @param {Object} permObj   – the full permission object (has .actions and .customActions)
 *                             OR the actions object itself (backward compat)
 * @param {string} actionKey – the action to check
 * @returns {boolean}
 */
export function hasActionPermission(permObj, actionKey) {
  if (!permObj) return false;

  const actions = permObj.actions || permObj;
  // "all" overrides everything
  if (toBool(actions.all)) return true;

  const val = getActionValue(permObj, actionKey);
  return val === true;
}

/**
 * High-level permission check that mirrors the logic in checkClinicPermission
 * but for an already-loaded module permission object.
 *
 * Supports both standard and custom actions through the same signature.
 * customActions is at the SAME level as actions (not inside it).
 *
 * @param {Object} modulePermission – a single module entry from permissions[]
 * @param {string} actionKey        – action to check (e.g. "create", "advance")
 * @param {string} [subModuleName]  – optional submodule name for scoped check
 * @returns {boolean}
 */
export function hasPermission(modulePermission, actionKey, subModuleName) {
  if (!modulePermission) return false;

  // Module-level "all" short-circuit
  if (toBool(modulePermission.actions?.all)) return true;

  // Submodule-scoped check
  if (subModuleName) {
    const sub = modulePermission.subModules?.find(
      (sm) =>
        sm.name === subModuleName ||
        sm.name?.toLowerCase() === subModuleName?.toLowerCase(),
    );

    if (sub) {
      // Submodule "all"
      if (toBool(sub.actions?.all)) return true;
      // Submodule specific action (fixed or custom) – pass full sub object
      const subVal = getActionValue(sub, actionKey);
      if (subVal !== undefined) return subVal === true;
    }

    // Fallback to module-level specific action – pass full modulePermission
    const modVal = getActionValue(modulePermission, actionKey);
    if (modVal !== undefined) return modVal === true;

    // Fallback: check if ANY submodule grants the action
    if (modulePermission.subModules?.length) {
      return modulePermission.subModules.some((sm) =>
        hasActionPermission(sm, actionKey),
      );
    }

    return false;
  }

  // No submodule – module-level specific action (fixed or custom)
  return hasActionPermission(modulePermission, actionKey);
}

/**
 * Validate that an action key is a registered custom action for the given module.
 * Thin wrapper around the registry for convenience.
 *
 * @param {string} moduleKey
 * @param {string} actionKey
 * @returns {boolean}
 */
export function isValidCustomAction(moduleKey, actionKey) {
  return isRegisteredCustomAction(moduleKey, actionKey);
}
