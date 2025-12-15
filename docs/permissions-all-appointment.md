# All Appointments – Permission Flow (agent/doctorStaff)

## Tokens and Roles
- Agent context prefers `agentToken`, then `userToken`; clinic context prefers `clinicToken`, then `agentToken`, then `userToken`.
- Role is decoded from JWT payload (`role`).
- Roles `clinic` and `doctor` bypass permission checks (full access).
- Roles `agent` and `doctorStaff` fetch module permissions; all other roles default to no access on this page.

## Module Permission Source
- Endpoint: `/api/agent/get-module-permissions?moduleKey=clinic_ScheduledAppointment`.
- Actions considered: `all`, `read`, `update`, `create`.
- Derived flags: `canRead`, `canUpdate`, `canCreate`.

## Read Guards (skip API calls when no read)
- Filter data (`/api/clinic/appointment-data`) and appointment list (`/api/clinic/all-appointments`) are **not called** when:
  - `permissionsLoaded` is true,
  - role is agent/doctorStaff,
  - `canRead` is false.
- When read is blocked: appointments array is emptied, totals zeroed, loading ends.

## UI Action Gating
- Edit / Delete buttons: require `canUpdate`.
- Report / Billing / Complaint buttons: require `canCreate` (plus status conditions).
- History button: always visible (not gated).
- Clinic/doctor roles see all actions because their perms are forced true.

## Notes and Scope
- This is client-side gating; server endpoints must still enforce permissions.
- Only `clinic/all-appointment` uses this module key; add similar checks to other pages if needed.

