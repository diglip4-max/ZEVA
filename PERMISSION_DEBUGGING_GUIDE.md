# Permission Debugging Guide

## What Was Added

I've added **comprehensive deep debugging** to trace the entire permission flow from saving to retrieval. This will help identify the exact issue in **ONE GO** when you test.

## Files Modified

### 1. `/pages/api/agent/permissions-helper.js`
**Function:** `getAgentModulePermissions()`

**Debug Steps:**
- **Step 1:** Database query result (found/not found, isActive, total count)
- **Step 2:** Logs ALL stored permissions in database with full details
- **Step 3:** Shows all module key candidates generated for matching
- **Step 4:** Searches in subModules (shows if found/not found)
- **Step 5:** Searches in direct modules (shows match details if found)
- **Step 6:** Final result (FOUND or NOT FOUND with reasons)

### 2. `/pages/api/agent/get-module-permissions.js`
**Endpoint:** `GET /api/agent/get-module-permissions?moduleKey=clinic_patient_registration`

**Debug Info:**
- Request method and query parameters
- User authentication details (userId, role, name)
- Requested moduleKey
- Calls to helper function
- Helper function return values
- Normalized actions before response
- Full response data

### 3. `/pages/api/agent/permissions.js`
**Endpoints:** 
- `GET /api/agent/permissions?agentId=xxx` (retrieve all permissions)
- `POST /api/agent/permissions` (save permissions)

**GET Debug Info:**
- Requesting agentId
- Agent found details
- All permissions stored in database with actions

**POST Debug Info:**
- AgentId and permissions count
- Full permissions being saved (modules, actions, subModules)
- Validation results
- Database save confirmation
- Final saved data

## How to Use This Debugging

### Step 1: Open Your Browser Console
1. Navigate to `/clinic/create-agent`
2. Open Developer Tools (F12)
3. Go to **Console** tab

### Step 2: Set Permissions for Agent
1. Click the "Rights" button for the agent
2. Enable permissions for "Patient Registration" module
3. Set `All: true` (or individual actions)
4. Wait for auto-save (you'll see "Saving..." then "Saved")

### Step 3: Check Console Logs for POST
Look for logs like:
```
========== [API DEBUG] /api/agent/permissions (POST) ==========
[API DEBUG] agentId: 691195b236d71f9f6e2ef6a9
[API DEBUG] permissions count: 15
[API DEBUG] Permissions to save:
[DEBUG]   [5] module: "clinic_patient_registration"
[DEBUG]       actions: {
  "all": true,
  "create": true,
  "read": true,
  "update": true,
  "delete": true,
  "print": false,
  "export": false,
  "approve": false
}
[API DEBUG] Save successful!
```

**✅ What to verify:**
- Module name is exactly `clinic_patient_registration`
- Actions show `all: true, create: true, read: true, update: true, delete: true`
- Save was successful

### Step 4: Check Console Logs for GET
After saving, the modal fetches permissions back. Look for:
```
========== [API DEBUG] /api/agent/permissions (GET) ==========
[API DEBUG] Requesting agentId: 691195b236d71f9f6e2ef6a9
[API DEBUG] Agent found: { agentId: "...", role: "agent", name: "..." }
[API DEBUG] Permissions found: true
[DEBUG]   - Total modules: 15
[DEBUG]   [5] module: "clinic_patient_registration"
[DEBUG]       actions: {
  "all": true,
  "create": true,
  "read": true,
  "update": true,
  "delete": true
}
```

**✅ What to verify:**
- Permissions were retrieved successfully
- Module `clinic_patient_registration` exists in the list
- Actions are all `true`

### Step 5: Access Patient Registration Page
1. Navigate to `/clinic/patient-registration` using the **agent's token**
2. Check the browser console for:

```
========== [API DEBUG] /api/agent/get-module-permissions ==========
[API DEBUG] Method: GET
[API DEBUG] Query: { moduleKey: 'clinic_patient_registration' }
[API DEBUG] User authenticated: { userId: "...", role: "agent", name: "..." }
[API DEBUG] Requested moduleKey: clinic_patient_registration
[API DEBUG] Calling getAgentModulePermissions...
```

### Step 6: Check Deep Helper Debug Logs
This is the **MOST IMPORTANT** part. Look for:

```
========== [DEEP DEBUG] getAgentModulePermissions START ==========
[DEBUG] Input agentId: 691195b236d71f9f6e2ef6a9
[DEBUG] Input moduleKey: clinic_patient_registration

[DEBUG] Step 1 - Database Query Result:
[DEBUG]   - AgentPermission found: true
[DEBUG]   - isActive: true
[DEBUG]   - Total permissions count: 15

[DEBUG] Step 2 - ALL Stored Permissions in Database:
  [0] module: "clinic_dashboard"
      actions: { ... }
  [1] module: "clinic_patient_registration"
      actions: {
        "all": true,
        "create": true,
        "read": true,
        "update": true,
        "delete": true,
        "print": false,
        "export": false,
        "approve": false
      }
      subModules count: 0
  ... (more modules)

[DEBUG] Step 3 - Module Key Candidates Generated:
  [0] "clinic_patient_registration"
  [1] "patient_registration"
  [2] "admin_clinic_patient_registration"
  [3] "clinic_clinic_patient_registration"
  [4] "doctor_clinic_patient_registration"

[DEBUG] Step 4 - Searching in subModules...
[DEBUG]   ✗ NOT found in any subModule

[DEBUG] Step 5 - Searching in direct modules...
[DEBUG]   ✓ FOUND in direct module: "clinic_patient_registration"
[DEBUG]   Matching candidate: clinic_patient_registration
[DEBUG]   Module permissions: { ... full object ... }

[DEBUG] Step 6 - Final Result:
[DEBUG]   ✓✓✓ MODULE FOUND ✓✓✓
[DEBUG]   Module: clinic_patient_registration
[DEBUG]   Actions: {
  "all": true,
  "create": true,
  "read": true,
  "update": true,
  "delete": true
}
========== [DEEP DEBUG] getAgentModulePermissions END (SUCCESS) ==========
```

## Possible Issues & Solutions

### Issue 1: Module NOT FOUND in Step 5
**Symptom:** 
```
[DEBUG]   ✗ NOT found in direct modules
[DEBUG]   ✗✗✗ MODULE NOT FOUND ✗✗✗
```

**Possible Causes:**
1. **Permissions not saved** - Check Step 3 POST logs to see if save was successful
2. **Different module name** - Compare the name in Step 2 (database) with Step 3 (candidates)
3. **Agent ID mismatch** - Verify the agentId is the same in all logs

**Solution:** 
- Check if the module name in database matches one of the candidates
- Look for typos or prefix issues

### Issue 2: Module Found but Actions are All FALSE
**Symptom:**
```
[DEBUG]   ✓✓✓ MODULE FOUND ✓✓✓
[DEBUG]   Actions: {
  "all": false,
  "create": false,
  "read": false,
  "update": false,
  "delete": false
}
```

**Possible Causes:**
1. **Database has false values** - Check Step 2 logs to see what's actually stored
2. **Save didn't work** - Check Step 3 POST logs to see what was sent
3. **Overwritten by another save** - Check if there are multiple POST requests

**Solution:**
- Re-save the permissions and watch the POST logs
- Verify the modal is sending the correct data

### Issue 3: Module Name Mismatch
**Symptom:**
```
[DEBUG] Step 2 - ALL Stored Permissions in Database:
  [5] module: "patient_registration"  ← WITHOUT prefix
  
[DEBUG] Step 3 - Module Key Candidates Generated:
  [0] "clinic_patient_registration"  ← WITH prefix
  [1] "patient_registration"         ← This should match!
```

**Solution:**
The matching logic should handle this, but if it doesn't, we need to check the matching algorithm in Step 5.

### Issue 4: AgentPermission Not Found
**Symptom:**
```
[DEBUG] Step 1 - Database Query Result:
[DEBUG]   - AgentPermission found: false
[DEBUG] ERROR: No permissions found for this agent
```

**Possible Causes:**
1. **No permissions saved yet** - Need to save permissions first
2. **isActive is false** - Check the database record
3. **Wrong agentId** - Verify the agent ID is correct

**Solution:**
- Save permissions via the modal first
- Check database directly if needed

## What to Share With Me

After testing, please share:

1. **Complete console logs** from Step 3 (POST save)
2. **Complete console logs** from Step 6 (Deep helper debug)
3. **The exact error** you're seeing on the patient-registration page

This will tell us **exactly** what's wrong and how to fix it in one shot!

## Expected Behavior (When Working Correctly)

When everything works:
1. POST saves `clinic_patient_registration` with `all: true, create: true, read: true, update: true, delete: true`
2. GET retrieves it successfully
3. `get-module-permissions` finds the module and returns the correct actions
4. Patient registration page shows with full access

## Quick Test Command

You can also test the API directly in browser:

```
http://localhost:3000/api/agent/get-module-permissions?moduleKey=clinic_patient_registration
```

With the agent token in Authorization header. The console will show all the debug logs.
