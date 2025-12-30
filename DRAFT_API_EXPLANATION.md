# Draft API (draft.js) - Complete Step-by-Step Explanation

## Overview
This API handles CRUD operations for blog drafts. It implements role-based access control where:
- **Clinic, Doctor, Admin roles**: Bypass permission checks (full access)
- **Agent, DoctorStaff roles**: Must have explicit permissions checked

---

## 🔐 STEP 1: Getting Logged-In User Information

### Lines 25-28: Extract User from Request
```javascript
const me = await getUserFromReq(req);
if (!me || !requireRole(me, ["clinic", "doctor", "doctorStaff", "agent", "admin"])) {
  return res.status(403).json({ success: false, message: "Access denied" });
}
```

**Purpose:**
- `getUserFromReq(req)` extracts the user object from the JWT token in the Authorization header
- Returns user object with: `_id`, `role`, `email`, `name`, `clinicId` (if agent/staff), etc.
- `requireRole()` validates the user has one of the allowed roles
- If invalid, returns 403 Forbidden

**What we get:**
- `me._id` = User's MongoDB ObjectId (e.g., "68909b30faa98f63e97e3d17")
- `me.role` = User's role ("clinic", "doctor", "agent", "doctorStaff", "admin")

---

### Lines 30-36: Get Clinic ID and Role Flags
```javascript
const { clinicId, error, isAdmin } = await getClinicIdFromUser(me);
const isDoctor = me.role === "doctor";
const isDoctorStaff = me.role === "doctorStaff";
const isAgent = me.role === "agent";
if (error && !isAdmin && !isDoctor && !isDoctorStaff && !isAgent) {
  return res.status(404).json({ success: false, message: error });
}
```

**Purpose:**
- `getClinicIdFromUser(me)` finds the clinic associated with the user:
  - **For clinic role**: Finds clinic where `Clinic.owner = me._id`
  - **For agent/doctorStaff**: Gets `clinicId` from `me.clinicId` field
  - **For doctor**: Gets `clinicId` from `me.clinicId` field
  - **For admin**: Returns `null` (admin doesn't need clinicId)
- Sets boolean flags for easy role checking
- Returns error if clinic not found (except for roles that can work without clinic)

**What we get:**
- `clinicId` = Clinic's MongoDB ObjectId (e.g., "68909b30faa98f63e97e3d17") or `null`
- `isAdmin` = true if user is admin
- `isDoctor`, `isDoctorStaff`, `isAgent` = boolean flags for each role

---

## 🔒 STEP 2: Permission Check Logic (THE KEY PART)

### Lines 38-55: Permission Check for Reading Drafts
```javascript
// ✅ Check permission for reading drafts (only for agent/doctorStaff, clinic/admin/doctor bypass)
if (!["admin", "clinic", "doctor"].includes(me.role) && clinicId) {
  if (isAgent || isDoctorStaff) {
    const result = await checkAgentPermission(
      me._id,
      "clinic_write_blog",
      "read",
      null
    );
    if (!result.hasPermission) {
      return res.status(403).json({
        success: false,
        message: result.error || "You do not have permission to view drafts"
      });
    }
  }
  // Clinic, admin, and doctor users bypass permission checks
}
```

**Purpose:**
This is the **CORE LOGIC** that bypasses permissions for clinic role and checks for agent/doctorStaff.

**How it works:**

1. **Condition Check**: `!["admin", "clinic", "doctor"].includes(me.role) && clinicId`
   - This means: "If user is NOT admin/clinic/doctor AND has a clinicId"
   - **Result**: Only `agent` and `doctorStaff` roles enter this block
   - **Clinic, doctor, admin roles SKIP this entire block** (bypass permission check)

2. **Permission Check for Agent/DoctorStaff**:
   - `checkAgentPermission(me._id, "clinic_write_blog", "read", null)`
   - Checks the `AgentPermission` collection for:
     - User ID: `me._id`
     - Module: `"clinic_write_blog"`
     - Action: `"read"`
   - Returns: `{ hasPermission: true/false, error: "message" }`
   - If no permission, returns 403 Forbidden

3. **Bypass Logic**:
   - If user is `clinic`, `doctor`, or `admin`, the condition `!["admin", "clinic", "doctor"].includes(me.role)` is **FALSE**
   - So the entire `if` block is **SKIPPED**
   - Clinic/doctor/admin users **never reach** the permission check code
   - They automatically have access (bypass)

**Visual Flow:**
```
User Role = "clinic"
  ↓
Check: !["admin", "clinic", "doctor"].includes("clinic")
  ↓
Result: FALSE (clinic IS in the array)
  ↓
Skip entire if block
  ↓
Continue to query logic (full access granted)
```

```
User Role = "agent"
  ↓
Check: !["admin", "clinic", "doctor"].includes("agent")
  ↓
Result: TRUE (agent is NOT in the array)
  ↓
Enter if block
  ↓
Check permission in AgentPermission collection
  ↓
If hasPermission = true → Continue
If hasPermission = false → Return 403 Forbidden
```

---

## 🔍 STEP 2 DETAILED: How `me._id` Flows Through Each Line

### Complete Line-by-Line Breakdown with `me._id` Flow

#### **Line 38: Comment**
```javascript
// ✅ Check permission for reading drafts (only for agent/doctorStaff, clinic/admin/doctor bypass)
```
**Purpose:** Documentation comment explaining the permission check logic.

---

#### **Line 39: The Bypass Condition - CRITICAL LINE!**
```javascript
if (!["admin", "clinic", "doctor"].includes(me.role) && clinicId) {
```

**Detailed Breakdown:**

**What `me.role` contains:**
- `me.role` = String value from user object: `"clinic"`, `"agent"`, `"doctor"`, `"doctorStaff"`, or `"admin"`
- This comes from the database User document

**Step-by-step evaluation:**

**For Clinic Role:**
```javascript
me.role = "clinic"

Step 1: ["admin", "clinic", "doctor"].includes("clinic")
        → Returns: true (clinic IS in the array)

Step 2: !true
        → Returns: false (negation)

Step 3: false && clinicId
        → Returns: false (short-circuit evaluation)

Result: ENTIRE IF BLOCK IS SKIPPED
        → Clinic user BYPASSES permission check ✅
        → me._id is NEVER used in permission check
```

**For Agent Role:**
```javascript
me.role = "agent"

Step 1: ["admin", "clinic", "doctor"].includes("agent")
        → Returns: false (agent is NOT in the array)

Step 2: !false
        → Returns: true (negation)

Step 3: true && clinicId
        → Returns: true (if clinicId exists)

Result: ENTERS IF BLOCK
        → Agent user MUST check permissions ✅
        → me._id WILL be used in permission check
```

**Why `&& clinicId` is important:**
- If agent doesn't have `clinicId`, they can only see their own data
- So we skip permission check if no `clinicId` (they only see their own drafts anyway)

---

#### **Line 40: Double-Check Role**
```javascript
if (isAgent || isDoctorStaff) {
```

**What `isAgent` and `isDoctorStaff` contain:**
- `isAgent = me.role === "agent"` (boolean: true/false)
- `isDoctorStaff = me.role === "doctorStaff"` (boolean: true/false)
- These were set on Line 33

**Purpose:**
- Extra safety check (though Line 39 already filtered this)
- Ensures we only check permissions for agent/doctorStaff roles
- If somehow another role got past Line 39, this catches it

**Flow:**
- If `isAgent = true` OR `isDoctorStaff = true` → Enter block
- Otherwise → Skip permission check

---

#### **Lines 41-46: THE PERMISSION CHECK - Where `me._id` is Used!**
```javascript
const result = await checkAgentPermission(
  me._id,                    // ← PARAMETER 1: User's ID from JWT token
  "clinic_write_blog",       // ← PARAMETER 2: Module to check
  "read",                    // ← PARAMETER 3: Action to check
  null                       // ← PARAMETER 4: No submodule
);
```

**Line 41: `const result = await checkAgentPermission(`**
- **`const result`**: Variable to store the permission check result
- **`await`**: Waits for the async function to complete (database query)
- **`checkAgentPermission`**: Function that checks permissions in database
- **Result format**: `{ hasPermission: boolean, error: string | null }`

**Line 42: `me._id,` - THE MOST IMPORTANT PARAMETER!**

**What is `me._id`?**
- `me._id` = MongoDB ObjectId of the logged-in user
- **Type**: `ObjectId("691192f736d71f9f6e2ef67d")` or string `"691192f736d71f9f6e2ef67d"`
- **Source**: Extracted from JWT token on Line 25: `const me = await getUserFromReq(req)`
- **Example value**: `"691192f736d71f9f6e2ef67d"`

**How `me._id` flows into `checkAgentPermission`:**

**Step 1: Function Call**
```javascript
checkAgentPermission(me._id, "clinic_write_blog", "read", null)
```
- `me._id` is passed as the first argument
- Function receives it as parameter `agentId`

**Step 2: Inside `checkAgentPermission` function (permissions-helper.js)**

**Line 14: Function Definition**
```javascript
export async function checkAgentPermission(agentId, moduleKey, action, subModuleName = null) {
```
- **`agentId`** parameter receives `me._id`
- So now: `agentId = me._id = "691192f736d71f9f6e2ef67d"`

**Line 17-19: Validation**
```javascript
if (!agentId) {
  return { hasPermission: false, error: "Agent ID is required" };
}
```
- **Purpose**: Ensures `me._id` was provided
- **If `me._id` is null/undefined**: Returns error immediately
- **If `me._id` exists**: Continues to database query

**Line 23-26: Database Query Using `me._id`**
```javascript
const agentPermission = await AgentPermission.findOne({
  agentId,  // ← This is me._id!
  isActive: true
}).lean();
```

**What this does:**
- **MongoDB Query**: Searches `AgentPermission` collection
- **Query**: `{ agentId: me._id, isActive: true }`
- **Example Query**:
  ```javascript
  AgentPermission.findOne({
    agentId: ObjectId("691192f736d71f9f6e2ef67d"),  // me._id value
    isActive: true
  })
  ```

**Database Collection Structure:**
```javascript
AgentPermission Collection:
{
  _id: ObjectId("..."),
  agentId: ObjectId("691192f736d71f9f6e2ef67d"),  // ← MATCHES me._id
  isActive: true,
  permissions: [
    {
      module: "clinic_write_blog",
      actions: {
        all: false,
        read: true,    // ← THIS IS WHAT WE'RE CHECKING
        create: true,
        update: false,
        delete: false
      }
    }
  ],
  grantedBy: ObjectId("..."),
  createdAt: Date,
  updatedAt: Date
}
```

**What the query returns:**
- **If found**: Returns the permission document for this specific user (identified by `me._id`)
- **If not found**: Returns `null` (user has no permissions)

**Line 29-31: Check if Permission Document Exists**
```javascript
if (!agentPermission || !agentPermission.permissions || agentPermission.permissions.length === 0) {
  return { hasPermission: false, error: "No permissions found for this agent" };
}
```
- **If no document found**: User (identified by `me._id`) has NO permissions
- **Returns**: `{ hasPermission: false, error: "No permissions found..." }`
- **If document found**: Continues to check specific permissions

**Line 45-53: Find Module Permission**
```javascript
const modulePermission = agentPermission.permissions.find(
  (p) => {
    const permModule = p.module || '';
    return moduleCandidates.some(candidate => 
      permModule === candidate || 
      permModule.replace(/^(admin|clinic|doctor)_/, '') === candidate.replace(/^(admin|clinic|doctor)_/, '')
    );
  }
);
```
- **Purpose**: Searches through `agentPermission.permissions` array
- **Looks for**: Module matching `"clinic_write_blog"`
- **This is specific to the user identified by `me._id`**
- **Returns**: Permission object for this module, or `undefined` if not found

**Line 61-68: Check "all" Permission**
```javascript
const hasAllPermission = modulePermission.actions?.all === true || 
                         modulePermission.actions?.all === "true" ||
                         String(modulePermission.actions?.all).toLowerCase() === "true";

if (hasAllPermission) {
  return { hasPermission: true, error: null };
}
```
- **Purpose**: Checks if user (identified by `me._id`) has "all" permission
- **If `actions.all = true`**: User has ALL permissions for this module
- **Returns**: `{ hasPermission: true, error: null }` immediately
- **If not**: Continues to check specific action

**Line 117-123: Check Specific Action Permission**
```javascript
const hasSpecificAction = modulePermission.actions?.[action] === true || 
                           modulePermission.actions?.[action] === "true" ||
                           String(modulePermission.actions?.[action]).toLowerCase() === "true";

if (hasSpecificAction) {
  return { hasPermission: true, error: null };
}
```
- **Purpose**: Checks if user (identified by `me._id`) has specific action permission
- **`action`** = `"read"` (from Line 44)
- **Checks**: `modulePermission.actions.read === true`
- **If true**: Returns `{ hasPermission: true, error: null }`
- **If false**: Continues to deny

**Line 125: Return Denial**
```javascript
return { hasPermission: false, error: `Permission denied: ${action} action not allowed...` };
```
- **Returns**: Permission denied result back to draft.js

**Line 43: `"clinic_write_blog",`**
- **Purpose**: Module key to check in permissions
- **Must match**: A module in the user's `AgentPermission` document
- **Example**: User's permissions must have a module with `module: "clinic_write_blog"`

**Line 44: `"read",`**
- **Purpose**: Action to check: "read", "create", "update", "delete"
- **Checks**: If user has this specific action permission
- **Example**: Checks `actions.read === true` in the permission document

**Line 45: `null`**
- **Purpose**: No submodule check (module-level only)
- **If checking submodule**: Would pass submodule name here (e.g., `"Create Blog"`)

---

#### **Lines 47-52: Handle Permission Result**
```javascript
if (!result.hasPermission) {
  return res.status(403).json({
    success: false,
    message: result.error || "You do not have permission to view drafts"
  });
}
```

**Line 47: `if (!result.hasPermission)`**
- **`result`**: Return value from `checkAgentPermission(me._id, ...)`
- **`result.hasPermission`**: `true` or `false` (from database check)
- **`!result.hasPermission`**: `true` if permission was DENIED

**What happens:**
- **If `result.hasPermission = false`**: User does NOT have permission
- **Action**: Returns HTTP 403 Forbidden immediately
- **Request stops here**: Never reaches query logic
- **User sees**: Error message in response

**If permission granted:**
- **If `result.hasPermission = true`**: User HAS permission
- **Action**: Code continues to Line 57 (query construction)
- **User can proceed**: To read drafts

**Line 48-51: Error Response**
- **Returns**: JSON error response to client
- **`result.error`**: Error message from permission check
- **Example messages**:
  - `"No permissions found for this agent"`
  - `"Module clinic_write_blog not found in agent permissions"`
  - `"Permission denied: read action not allowed..."`

---

#### **Line 53: Closing Brace**
```javascript
}
```
- **Closes**: The `if (isAgent || isDoctorStaff)` block
- **Only agent/doctorStaff**: Reach this point

---

#### **Line 54: Comment**
```javascript
// Clinic, admin, and doctor users bypass permission checks
```
- **Explains**: That clinic/admin/doctor never reached the permission check code
- **They bypassed**: At Line 39

---

#### **Line 55: Closing Brace**
```javascript
}
```
- **Closes**: The main `if (!["admin", "clinic", "doctor"].includes(me.role) && clinicId)` block
- **All code after this**: Executes for ALL roles (including clinic/admin/doctor)

---

## 📊 COMPLETE DATA FLOW WITH `me._id` - REAL EXAMPLE

### Example 1: Agent User Reading Drafts

```
STEP 1: REQUEST ARRIVES
   ↓
   HTTP GET /api/blog/draft
   Headers: { Authorization: "Bearer <JWT_TOKEN>" }
   
STEP 2: Line 25 - Extract User from Token
   ↓
   const me = await getUserFromReq(req)
   
   JWT Token Decoded:
   {
     userId: "691192f736d71f9f6e2ef67d",  ← THIS BECOMES me._id
     role: "agent",
     email: "agent@example.com"
   }
   
   Result:
   me = {
     _id: ObjectId("691192f736d71f9f6e2ef67d"),  ← EXTRACTED FROM JWT
     role: "agent",
     clinicId: ObjectId("68909b30faa98f63e97e3d17"),
     email: "agent@example.com",
     name: "John Agent"
   }
   
STEP 3: Line 30 - Get Clinic ID
   ↓
   const { clinicId, error, isAdmin } = await getClinicIdFromUser(me)
   
   Function checks: me.clinicId (from User document)
   Result:
   clinicId = "68909b30faa98f63e97e3d17"
   error = null
   isAdmin = undefined
   
STEP 4: Line 33 - Set Role Flags
   ↓
   const isAgent = me.role === "agent"
   Result: isAgent = true
   
STEP 5: Line 39 - Check Bypass Condition
   ↓
   if (!["admin", "clinic", "doctor"].includes(me.role) && clinicId)
   
   Evaluation:
   - me.role = "agent"
   - ["admin", "clinic", "doctor"].includes("agent") = false
   - !false = true
   - true && clinicId = true
   
   Result: ENTER IF BLOCK ✅
   
STEP 6: Line 40 - Double-Check Role
   ↓
   if (isAgent || isDoctorStaff)
   
   Evaluation:
   - isAgent = true
   - true || false = true
   
   Result: ENTER IF BLOCK ✅
   
STEP 7: Lines 41-46 - Permission Check (me._id is used here!)
   ↓
   const result = await checkAgentPermission(
     me._id,  // "691192f736d71f9f6e2ef67d"
     "clinic_write_blog",
     "read",
     null
   )
   
   INSIDE checkAgentPermission FUNCTION:
   ↓
   Step 7a: Function receives parameters
   agentId = me._id = "691192f736d71f9f6e2ef67d"
   moduleKey = "clinic_write_blog"
   action = "read"
   subModuleName = null
   
   Step 7b: Line 17-19 - Validate agentId
   if (!agentId)  // Checks if me._id exists
   Result: agentId exists, continue
   
   Step 7c: Line 23-26 - Database Query
   ↓
   AgentPermission.findOne({
     agentId: "691192f736d71f9f6e2ef67d",  // ← me._id used here!
     isActive: true
   })
   
   MONGODB QUERY EXECUTES:
   ↓
   Collection: AgentPermission
   Query: {
     agentId: ObjectId("691192f736d71f9f6e2ef67d"),  // ← me._id
     isActive: true
   }
   
   RETURNS DOCUMENT:
   {
     _id: ObjectId("..."),
     agentId: ObjectId("691192f736d71f9f6e2ef67d"),  // ← MATCHES me._id
     isActive: true,
     permissions: [
       {
         module: "clinic_write_blog",
         actions: {
           all: false,
           read: true,    // ← THIS IS WHAT WE'RE CHECKING
           create: true,
           update: false,
           delete: false
         }
       }
     ]
   }
   
   Step 7d: Line 45-53 - Find Module
   ↓
   Searches permissions array for module: "clinic_write_blog"
   Found: modulePermission = { module: "clinic_write_blog", actions: { read: true, ... } }
   
   Step 7e: Line 61-68 - Check "all" Permission
   ↓
   modulePermission.actions.all = false
   hasAllPermission = false
   Continue to specific action check
   
   Step 7f: Line 117-123 - Check "read" Action
   ↓
   modulePermission.actions.read = true
   hasSpecificAction = true
   
   Step 7g: Return Result
   ↓
   return { hasPermission: true, error: null }
   
STEP 8: Line 47 - Check Result
   ↓
   if (!result.hasPermission)
   !true = false
   
   Result: SKIP ERROR BLOCK ✅
   
STEP 9: Line 57 - Continue to Query
   ↓
   User has permission, proceed to fetch drafts
   me._id will be used in query to find drafts
```

### Example 2: Clinic User Reading Drafts

```
STEP 1: REQUEST ARRIVES
   ↓
   HTTP GET /api/blog/draft
   Headers: { Authorization: "Bearer <JWT_TOKEN>" }
   
STEP 2: Line 25 - Extract User from Token
   ↓
   const me = await getUserFromReq(req)
   
   Result:
   me = {
     _id: ObjectId("68909b30faa98f63e97e3d17"),  ← CLINIC OWNER ID
     role: "clinic",
     email: "clinic@example.com",
     name: "Clinic Owner"
   }
   
STEP 3: Line 30 - Get Clinic ID
   ↓
   const { clinicId, error, isAdmin } = await getClinicIdFromUser(me)
   
   Function checks: Clinic.findOne({ owner: me._id })
   Result:
   clinicId = "68909b30faa98f63e97e3d17"  (found via me._id)
   error = null
   isAdmin = undefined
   
STEP 4: Line 39 - Check Bypass Condition
   ↓
   if (!["admin", "clinic", "doctor"].includes(me.role) && clinicId)
   
   Evaluation:
   - me.role = "clinic"
   - ["admin", "clinic", "doctor"].includes("clinic") = true
   - !true = false
   - false && clinicId = false
   
   Result: SKIP ENTIRE IF BLOCK ✅ (BYPASS!)
   
STEP 5: Line 57 - Continue Directly to Query
   ↓
   me._id is NEVER passed to checkAgentPermission
   Permission check is COMPLETELY SKIPPED
   User automatically has access
   me._id will be used in query to find drafts
```

---

## 🎯 KEY INSIGHTS ABOUT `me._id`:

1. **`me._id` is the User's Unique Identity**:
   - Extracted from JWT token (Line 25)
   - Used to identify which user is making the request
   - Used to find user-specific permissions in database

2. **`me._id` is Only Used for Agent/DoctorStaff Permission Checks**:
   - Clinic/doctor/admin roles NEVER pass `me._id` to `checkAgentPermission`
   - They bypass the entire permission check at Line 39
   - `me._id` is only used in database query for agent/doctorStaff

3. **Database Query Pattern**:
   ```javascript
   AgentPermission.findOne({ agentId: me._id })
   ```
   - Finds permission document WHERE `agentId` field matches `me._id`
   - This is how we get user-specific permissions
   - Each user has their own permission document

4. **Permission Check Flow**:
   ```
   me._id (from JWT) 
     → checkAgentPermission(me._id, ...) 
     → Database Query: { agentId: me._id } 
     → Permission Document 
     → Check Actions 
     → Return { hasPermission: true/false }
   ```

5. **Bypass Flow**:
   ```
   me.role = "clinic" 
     → Condition evaluates to false 
     → Skip checkAgentPermission() 
     → me._id never used in permission check
     → Direct access granted
   ```

6. **Why `me._id` is Critical**:
   - Without `me._id`, we can't identify which user's permissions to check
   - `me._id` links the JWT token user to their permission document in database
   - Each agent/doctorStaff has unique permissions stored by their `agentId` (which is `me._id`)

---

## 📋 STEP 3: Query Construction Based on Role

### Lines 99-142: Single Draft Query (when `id` is provided)

#### For Clinic Role (Lines 99-132):
```javascript
else if (me.role === "clinic") {
  const orConditions = [{ postedBy: me._id }];
  
  if (clinicId) {
    const clinic = await Clinic.findById(clinicId).select("owner");
    const clinicUserIds = [];
    
    if (clinic && clinic.owner) {
      clinicUserIds.push(clinic.owner);
    }
    
    const clinicUsers = await User.find({ 
      clinicId: clinicId 
    }).select("_id");
    
    clinicUsers.forEach(u => {
      if (!clinicUserIds.some(id => id.toString() === u._id.toString())) {
        clinicUserIds.push(u._id);
      }
    });
    
    if (clinicUserIds.length > 0) {
      orConditions.push({ postedBy: { $in: clinicUserIds } });
    }
  }
  
  orConditions.push({ role: "admin" });
  draftQuery.$or = orConditions;
}
```

**Purpose:**
- Clinic role sees ALL drafts from their clinic
- Query structure: `{ status: "draft", $or: [...] }`
- `$or` conditions:
  1. `{ postedBy: me._id }` - Drafts posted by clinic owner (themselves)
  2. `{ postedBy: { $in: clinicUserIds } }` - Drafts posted by any clinic user (agents, staff, doctors)
  3. `{ role: "admin" }` - Admin drafts

**Why this works:**
- Clinic owner's ID (`me._id`) is used to find their own drafts
- All users with `clinicId` are found and included
- This matches the job-postings pattern

---

#### For Agent/DoctorStaff (Lines 67-91):
```javascript
if ((isAgent || isDoctorStaff) && clinicId) {
  const clinic = await Clinic.findById(clinicId).select("owner");
  if (clinic) {
    const clinicUsers = await User.find({
      $or: [
        { _id: clinic.owner },
        { clinicId: clinicId, role: "doctor" },
      ],
    }).select("_id");
    const clinicUserIds = clinicUsers.map(u => u._id);
    clinicUserIds.push(me._id);
    
    draftQuery.$or = [
      { postedBy: { $in: clinicUserIds } },
      { role: "admin" },
    ];
  }
}
```

**Purpose:**
- Agent/doctorStaff see drafts from their clinic (if they have permission)
- Includes: clinic owner, doctors, and themselves
- They can see clinic-wide drafts (not just their own)

---

#### For Doctor (Lines 92-98):
```javascript
else if (me.role === "doctor") {
  draftQuery.role = me.role;
  draftQuery.$or = [
    { postedBy: me._id },
    { role: "admin" },
  ];
}
```

**Purpose:**
- Doctor sees only their own drafts + admin drafts
- Filters by `role: "doctor"` to ensure only doctor blogs

---

#### For Admin (Lines 133-135):
```javascript
else if (isAdmin) {
  // Admin can see any draft - no additional filters needed
}
```

**Purpose:**
- Admin sees ALL drafts (no filtering)

---

### Lines 157-247: All Drafts Query (when no `id` provided)

**Same logic as single draft query, but for fetching all drafts.**

---

## 📝 STEP 4: POST (Create Draft)

### Lines 275-292: Permission Check for Creating
```javascript
// ✅ Check permission for creating drafts (only for agent/doctorStaff, clinic/admin/doctor bypass)
if (!["admin", "clinic", "doctor"].includes(me.role) && clinicId) {
  if (isAgent || isDoctorStaff) {
    const result = await checkAgentPermission(
      me._id,
      "clinic_write_blog",
      "create",
      null
    );
    if (!result.hasPermission) {
      return res.status(403).json({
        success: false,
        message: result.error || "You do not have permission to create drafts"
      });
    }
  }
  // Clinic, admin, and doctor users bypass permission checks
}
```

**Purpose:**
- Same bypass logic as GET
- Clinic/doctor/admin bypass (skip this block)
- Agent/doctorStaff must have "create" permission

### Lines 323-337: Create Draft
```javascript
let blogRole = me.role;
if (me.role === "agent" || me.role === "doctorStaff") {
  blogRole = "clinic"; // Agent/doctorStaff blogs are associated with clinic
}

const draft = await Blog.create({
  title: title || "Untitled Draft",
  content: content || "",
  paramlink,
  status: "draft",
  postedBy: me._id,
  role: blogRole,
});
```

**Purpose:**
- Creates draft with `postedBy: me._id` (whoever is logged in)
- Sets `role` to "clinic" for agent/doctorStaff (Blog model only accepts "clinic" or "doctor")

---

## ✏️ STEP 5: PUT (Update Draft)

### Lines 415-432: Permission Check for Updating
```javascript
// ✅ Check permission for updating drafts (only for agent/doctorStaff, clinic/admin/doctor bypass)
if (!["admin", "clinic", "doctor"].includes(me.role) && clinicId) {
  if (isAgent || isDoctorStaff) {
    const result = await checkAgentPermission(
      me._id,
      "clinic_write_blog",
      "update",
      null
    );
    if (!result.hasPermission) {
      return res.status(403).json({
        success: false,
        message: result.error || "You do not have permission to update drafts"
      });
    }
  }
  // Clinic, admin, and doctor users bypass permission checks
}
```

**Purpose:**
- Same bypass logic
- Checks "update" permission for agent/doctorStaff

---

## 🗑️ STEP 6: DELETE (Delete Draft)

### Lines 526-543: Permission Check for Deleting
```javascript
// ✅ Check permission for deleting drafts (only for agent/doctorStaff, clinic/admin/doctor bypass)
if (!["admin", "clinic", "doctor"].includes(me.role) && clinicId) {
  if (isAgent || isDoctorStaff) {
    const result = await checkAgentPermission(
      me._id,
      "clinic_write_blog",
      "delete",
      null
    );
    if (!result.hasPermission) {
      return res.status(403).json({
        success: false,
        message: result.error || "You do not have permission to delete drafts"
      });
    }
  }
  // Clinic, admin, and doctor users bypass permission checks
}
```

**Purpose:**
- Same bypass logic
- Checks "delete" permission for agent/doctorStaff

---

## 🎯 Summary: Permission Bypass Pattern

### The Key Pattern (Used in ALL operations):
```javascript
if (!["admin", "clinic", "doctor"].includes(me.role) && clinicId) {
  // Only agent/doctorStaff enter here
  if (isAgent || isDoctorStaff) {
    // Check permission
  }
  // Clinic/admin/doctor NEVER reach this code = BYPASS
}
```

### Why This Works:
1. **Clinic role**: `!["admin", "clinic", "doctor"].includes("clinic")` = `false` → Skip block → Bypass ✅
2. **Doctor role**: `!["admin", "clinic", "doctor"].includes("doctor")` = `false` → Skip block → Bypass ✅
3. **Admin role**: `!["admin", "clinic", "doctor"].includes("admin")` = `false` → Skip block → Bypass ✅
4. **Agent role**: `!["admin", "clinic", "doctor"].includes("agent")` = `true` → Enter block → Check permission ✅
5. **DoctorStaff role**: `!["admin", "clinic", "doctor"].includes("doctorStaff")` = `true` → Enter block → Check permission ✅

---

## 📊 Data Flow Example

### Example: Clinic User Reading Drafts

1. **Request comes in** with JWT token
2. **Extract user**: `me = { _id: "68909b30...", role: "clinic", ... }`
3. **Get clinicId**: `clinicId = "68909b30..."` (found via `Clinic.findOne({ owner: me._id })`)
4. **Permission check**: 
   - `!["admin", "clinic", "doctor"].includes("clinic")` = `false`
   - Skip permission check block
   - **BYPASS** ✅
5. **Build query**:
   ```javascript
   {
     status: "draft",
     $or: [
       { postedBy: "68909b30..." },  // Clinic owner's drafts
       { postedBy: { $in: ["agent1", "agent2", ...] } },  // Clinic users' drafts
       { role: "admin" }  // Admin drafts
     ]
   }
   ```
6. **Execute query**: Returns all matching drafts
7. **Return response**: `{ success: true, drafts: [...] }`

---

### Example: Agent User Reading Drafts

1. **Request comes in** with JWT token
2. **Extract user**: `me = { _id: "691192f7...", role: "agent", clinicId: "68909b30..." }`
3. **Get clinicId**: `clinicId = "68909b30..."` (from `me.clinicId`)
4. **Permission check**:
   - `!["admin", "clinic", "doctor"].includes("agent")` = `true`
   - Enter permission check block
   - Call `checkAgentPermission("691192f7...", "clinic_write_blog", "read")`
   - Check `AgentPermission` collection
   - If `hasPermission = true` → Continue ✅
   - If `hasPermission = false` → Return 403 ❌
5. **Build query**: Same as clinic (if permission granted)
6. **Execute query**: Returns matching drafts
7. **Return response**: `{ success: true, drafts: [...] }`

---

## 🔑 Key Takeaways

1. **User Identification**: `getUserFromReq(req)` extracts user from JWT token
2. **Clinic ID Retrieval**: `getClinicIdFromUser(me)` finds clinic based on role
3. **Permission Bypass**: Condition `!["admin", "clinic", "doctor"].includes(me.role)` ensures clinic/doctor/admin skip permission checks
4. **Permission Check**: Only agent/doctorStaff roles check `AgentPermission` collection
5. **Query Building**: Different query structures for each role to show appropriate data
6. **Consistency**: Same pattern used in GET, POST, PUT, DELETE operations

