// config/actionRegistry.js
// ─────────────────────────────────────────────────────────────────────────────
// Central registry of module-specific custom permission actions.
//
// This is the SINGLE SOURCE OF TRUTH for which custom actions exist per module.
// Adding a new custom action for any module requires ONLY an entry here
// plus a database write — zero schema/model changes.
//
// Each key in MODULE_CUSTOM_ACTIONS is a moduleKey (matching ClinicNavigationItem).
// Each value is an array of { key, label } definitions.
//   - key:   stored in DB inside customActions Map (e.g. "advance")
//   - label: human-readable label shown in the UI (e.g. "Add Advance")
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Record<string, Array<{key: string, label: string}>>} */
export const MODULE_CUSTOM_ACTIONS = {
  // Patient Registration – "Add Advance" button in patient profile
  clinic_patient_registration: [
    { key: 'advance', label: 'Add Advance' },
  ],

   clinic_zeva_connect: [
    { key: 'copy', label: 'copy' },
  ],

  // Example entries for future modules (uncomment when needed):
  // clinic_billing: [
  //   { key: 'approve',  label: 'Approve' },
  //   { key: 'refund',   label: 'Refund' },
  //   { key: 'print',    label: 'Print Receipt' },
  // ],
  // clinic_pharmacy: [
  //   { key: 'dispense', label: 'Dispense' },
  //   { key: 'restock',  label: 'Restock' },
  // ],
};

/**
 * Get available custom actions for a module.
 * @param {string} moduleKey
 * @returns {Array<{key: string, label: string}>}
 */
export function getCustomActionsForModule(moduleKey) {
  return MODULE_CUSTOM_ACTIONS[moduleKey] || [];
}

/**
 * Check whether a given action key is registered for a module.
 * @param {string} moduleKey
 * @param {string} actionKey
 * @returns {boolean}
 */
export function isRegisteredCustomAction(moduleKey, actionKey) {
  const actions = MODULE_CUSTOM_ACTIONS[moduleKey];
  if (!actions) return false;
  return actions.some((a) => a.key === actionKey);
}
