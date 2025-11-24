# Detailed Explanation of Changes - Agent & DoctorStaff Management Merge

This document explains every change made to merge staff management and lead management systems into a centralized solution.

---

## 📋 Overview

**Problem**: Previously, staff management and lead management were separate systems. Staff and agents were created separately in different panels.

**Solution**: Merged both systems so that agents and doctorStaff can be created in one place (`admin/create-agent`), with proper filtering so each dashboard only shows records created by the logged-in user.

---

## 🔧 File 1: `/pages/api/lead-ms/create-agent.js`

### **Change 1: Added Role Parameter Support**

**Before:**
```javascript
const { name, email, phone, password } = req.body;
// Only created agents, no role parameter
```

**After:**
```javascript
const { name, email, phone, password, role } = req.body;
if (!name || !email || !password || !role) {
  return res.status(400).json({ 
    success: false, 
    message: "Missing required fields: name, email, password, and role are required" 
  });
}

// Validate role
if (!["agent", "doctorStaff"].includes(role)) {
  return res.status(400).json({ 
    success: false, 
    message: "Invalid role. Allowed roles: agent, doctorStaff" 
  });
}
```

**Why**: 
- The API now accepts a `role` parameter to create either `agent` or `doctorStaff`
- Validates the role to prevent invalid values
- Both roles can be created through the same endpoint

---

### **Change 2: Updated Role-Based Permissions**

**Before:**
```javascript
// Only allowed admin, clinic, doctor, agent to create agents
if (!me || !requireRole(me, ["admin", "clinic", "doctor", "agent"])) {
  return res.status(403).json({ success: false, message: "Access denied" });
}
```

**After:**
```javascript
// For agent creation: Allow admin, clinic, doctor, and agent roles
// For doctorStaff creation: Allow admin, clinic, and doctor roles (same as agents)
if (role === "agent") {
  if (!requireRole(me, ["admin", "clinic", "doctor", "agent"])) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }
} else if (role === "doctorStaff") {
  if (!requireRole(me, ["admin", "clinic", "doctor"])) {
    return res.status(403).json({ 
      success: false, 
      message: "Access denied. Admin, clinic, or doctor only for doctorStaff creation" 
    });
  }
}
```

**Why**:
- Different roles have different permissions for creating `agent` vs `doctorStaff`
- Agents cannot create `doctorStaff` (only admin, clinic, doctor can)
- Maintains proper access control

---

### **Change 3: Fixed ClinicId Assignment Logic**

**Before:**
```javascript
// Only handled agent creation
if (role === "agent") {
  if (me.role === "clinic") {
    const clinic = await Clinic.findOne({ owner: me._id });
    clinicId = clinic._id;
  }
}
```

**After:**
```javascript
// Find clinic based on role - IMPORTANT: Set clinicId for clinic/doctor/agent roles
if (me.role === "clinic") {
  // Clinic creating agent or doctorStaff - find their clinic
  const clinic = await Clinic.findOne({ owner: me._id });
  if (!clinic) {
    return res.status(400).json({ 
      success: false, 
      message: "Clinic not found for this user" 
    });
  }
  clinicId = clinic._id;
  // For agents created by clinic, set clinicId. For doctorStaff, we can optionally set it too
} else if (me.role === "agent") {
  // Agent creating another agent - use their clinicId
  clinicId = me.clinicId;
  if (!clinicId) {
    return res.status(400).json({ 
      success: false, 
      message: "Clinic not found for this agent" 
    });
  }
  // Only agents can be created by agents, not doctorStaff
  if (role === "doctorStaff") {
    return res.status(403).json({ 
      success: false, 
      message: "Agents cannot create doctorStaff" 
    });
  }
} else if (me.role === "doctor") {
  // Doctor creating agent or doctorStaff - use their clinicId if they have one
  clinicId = me.clinicId || null;
} else if (me.role === "admin") {
  // Admin creating agent or doctorStaff - clinicId is null (not tied to any clinic)
  clinicId = null;
}
```

**Why**:
- **Clinic**: When clinic creates an agent/doctorStaff, we find their clinic and set `clinicId`. This ensures the agent is tied to the clinic.
- **Doctor**: Uses their `clinicId` if they have one, otherwise `null`
- **Admin**: Always sets `clinicId` to `null` (admin-created agents are not tied to any clinic)
- **Agent**: Can only create agents (not doctorStaff), uses their own `clinicId`

**Example Flow**:
```javascript
// Clinic logs in → creates agent
// 1. me.role = "clinic"
// 2. Find clinic: Clinic.findOne({ owner: me._id })
// 3. clinicId = clinic._id (e.g., "507f1f77bcf86cd799439011")
// 4. userData.clinicId = clinicId ✅ (Now agent has clinicId!)
```

---

### **Change 4: Always Set `createdBy` Field**

**Before:**
```javascript
const agentData = {
  name,
  email,
  phone: phone || undefined,
  password: hashedPassword,
  role: "agent",
  isApproved: true,
  declined: false,
};
// createdBy was not always set
```

**After:**
```javascript
const userData = {
  name,
  email,
  phone: phone || undefined,
  password: hashedPassword,
  role,
  createdBy: me._id, // ✅ ALWAYS store who created this user
  isApproved: true,
  declined: false,
};
```

**Why**:
- **Critical for filtering**: The `createdBy` field is used to filter records in dashboards
- When clinic creates an agent, `createdBy = clinic._id`
- When admin creates an agent, `createdBy = admin._id`
- This ensures each dashboard only shows records created by that user

**Example**:
```javascript
// Clinic (ID: "clinic123") creates agent
// createdBy: "clinic123" ✅

// Admin (ID: "admin456") creates agent  
// createdBy: "admin456" ✅

// Later, when clinic queries agents:
// Query: { createdBy: "clinic123" } → Only shows clinic's agents ✅
```

---

### **Change 5: Conditional ClinicId Assignment**

**Before:**
```javascript
if (role === "agent" && clinicId) {
  agentData.clinicId = clinicId;
}
// Only set clinicId for agents
```

**After:**
```javascript
// Set clinicId based on role and creator
if (role === "agent") {
  // Agents should have clinicId if created by clinic, doctor, or agent
  // Admin-created agents have clinicId as null
  if (clinicId) {
    userData.clinicId = clinicId;
  }
} else if (role === "doctorStaff") {
  // doctorStaff can optionally have clinicId to track which clinic they belong to
  // This helps with filtering in dashboards
  if (clinicId) {
    userData.clinicId = clinicId;
  }
  // If clinicId is null (admin-created), that's fine too
}
```

**Why**:
- **Agents**: Must have `clinicId` if created by clinic/doctor/agent (ties them to a clinic)
- **doctorStaff**: Can optionally have `clinicId` (helps with filtering, but not required)
- **Admin-created**: Both have `clinicId = null` (not tied to any clinic)

---

## 🔧 File 2: `/pages/api/lead-ms/get-agents.js`

### **Change 1: Added Role Filter Parameter**

**Before:**
```javascript
// Always fetched only agents
let query = { role: 'agent' };
```

**After:**
```javascript
// Get role filter from query parameter (optional: 'agent', 'doctorStaff', or undefined for both)
const roleFilter = req.query.role;

// Build role query
let roleQuery;
if (roleFilter === 'agent') {
  roleQuery = { role: 'agent' };
} else if (roleFilter === 'doctorStaff') {
  roleQuery = { role: 'doctorStaff' };
} else {
  // If no role specified, default to agent (for backward compatibility)
  roleQuery = { role: 'agent' };
}
```

**Why**:
- Supports the toggle functionality in the UI
- Frontend can call `/api/lead-ms/get-agents?role=agent` or `?role=doctorStaff`
- Allows fetching both types of users separately

**Example Usage**:
```javascript
// Fetch only agents
GET /api/lead-ms/get-agents?role=agent

// Fetch only doctorStaff
GET /api/lead-ms/get-agents?role=doctorStaff

// Default (no role param) = agents
GET /api/lead-ms/get-agents
```

---

### **Change 2: Strict Filtering by `createdBy` for Admin**

**Before:**
```javascript
if (me.role === 'admin') {
  query.createdBy = me._id;
  // But query also had role: 'agent', which might conflict
}
```

**After:**
```javascript
if (me.role === 'admin') {
  // Admin sees ONLY agents/doctorStaff they created
  query = { ...roleQuery, createdBy: me._id };
}
```

**Why**:
- **Critical Fix**: Admin should ONLY see records they created
- Uses spread operator to combine `roleQuery` and `createdBy` filter
- Ensures admin doesn't see clinic-created or doctor-created records

**Example Query**:
```javascript
// Admin (ID: "admin123") fetching agents
// Query: { role: 'agent', createdBy: ObjectId("admin123") }
// Result: Only agents where createdBy = admin123 ✅
```

---

### **Change 3: Fixed Clinic Query Structure**

**Before:**
```javascript
if (me.role === 'clinic') {
  const clinic = await Clinic.findOne({ owner: me._id });
  if (clinic) {
    query.$or = [
      { clinicId: clinic._id },
      { createdBy: me._id }
    ];
    // Problem: query already had role: 'agent', this overwrites it
  }
}
```

**After:**
```javascript
if (me.role === 'clinic') {
  const clinic = await Clinic.findOne({ owner: me._id });
  
  if (roleFilter === 'agent') {
    // Only agents - clinic sees agents from their clinic OR agents they created
    if (clinic) {
      query = {
        role: 'agent',
        $or: [
          { clinicId: clinic._id },
          { createdBy: me._id }
        ]
      };
    } else {
      query = { role: 'agent', createdBy: me._id };
    }
  } else if (roleFilter === 'doctorStaff') {
    // Only doctorStaff - STRICT: clinic can ONLY see ones they created
    query = { role: 'doctorStaff', createdBy: me._id };
  }
}
```

**Why**:
- **Fixed Query Structure**: Builds the complete query object from scratch to avoid conflicts
- **For Agents**: Clinic sees agents from their clinic OR agents they created (flexible)
- **For doctorStaff**: Clinic ONLY sees doctorStaff they created (strict filtering)
- **Why $or for agents?**: Clinic might have agents created by other users but assigned to their clinic

**Example Queries**:
```javascript
// Clinic fetching agents
// Query: {
//   role: 'agent',
//   $or: [
//     { clinicId: ObjectId("clinic123") },  // Agents assigned to this clinic
//     { createdBy: ObjectId("clinic123") }   // Agents created by this clinic
//   ]
// }

// Clinic fetching doctorStaff
// Query: {
//   role: 'doctorStaff',
//   createdBy: ObjectId("clinic123")  // STRICT: Only clinic's doctorStaff
// }
```

---

### **Change 4: Added Role Field to Response**

**Before:**
```javascript
const agents = await User.find(query).select('_id name email phone isApproved declined clinicId createdBy');
// Missing 'role' field
```

**After:**
```javascript
const users = await User.find(query).select('_id name email phone isApproved declined clinicId createdBy role');
// Added 'role' field so frontend can distinguish between agent and doctorStaff
```

**Why**:
- Frontend needs to know if a record is `agent` or `doctorStaff` to display correctly
- Used in the toggle functionality to separate the lists

---

### **Change 5: Updated PATCH Endpoint for Both Roles**

**Before:**
```javascript
let agentQuery = { _id: agentId, role: 'agent' };
// Only worked for agents
```

**After:**
```javascript
// Build query to find agent or doctorStaff based on who is requesting
// STRICT: Only allow modification of records created by the current user (or agents from clinic)
let agentQuery = { _id: agentId, role: { $in: ['agent', 'doctorStaff'] } };

if (me.role === 'admin') {
  // Admin can only modify agents/doctorStaff they created
  agentQuery.createdBy = me._id;
} else if (me.role === 'clinic') {
  // Clinic can modify agents from their clinic OR agents they created
  // For doctorStaff, they can ONLY modify ones they created
  const clinic = await Clinic.findOne({ owner: me._id });
  if (clinic) {
    agentQuery.$or = [
      { role: 'agent', clinicId: clinic._id },
      { createdBy: me._id }
    ];
  } else {
    agentQuery.createdBy = me._id;
  }
}
```

**Why**:
- PATCH endpoint now works for both `agent` and `doctorStaff`
- Maintains strict filtering: users can only modify records they created (or agents from their clinic)
- Prevents unauthorized modifications

---

## 🔧 File 3: `/components/CreateAgentModal.jsx`

### **Change 1: Added Role State**

**Before:**
```javascript
const [name, setName] = useState('');
const [email, setEmail] = useState('');
const [phone, setPhone] = useState('');
const [password, setPassword] = useState('');
// No role state
```

**After:**
```javascript
const [name, setName] = useState('');
const [email, setEmail] = useState('');
const [phone, setPhone] = useState('');
const [password, setPassword] = useState('');
const [role, setRole] = useState('agent'); // Default to agent
```

**Why**:
- Tracks which role is being created (agent or doctorStaff)
- Defaults to 'agent' for backward compatibility

---

### **Change 2: Fixed Token Priority**

**Before:**
```javascript
// Determine which token to use: priority order is adminToken > doctorToken > token
const authToken = adminToken || doctorToken || token || null;
```

**After:**
```javascript
// Determine which token to use: priority order should match the logged-in user
// token = clinicToken, doctorToken = doctorToken, adminToken = adminToken
// Use the first available token (this should be the logged-in user's token)
const authToken = token || doctorToken || adminToken || null;
```

**Why**:
- **CRITICAL FIX**: The old priority (`adminToken` first) caused clinic to use admin token if both existed
- New priority: `token` (clinicToken) → `doctorToken` → `adminToken`
- Ensures the correct token is used based on who is logged in

**Example Problem**:
```javascript
// Before (WRONG):
// localStorage has both clinicToken and adminToken
// authToken = adminToken (wrong! clinic is logged in)
// Result: Agent created with createdBy = admin._id ❌

// After (CORRECT):
// localStorage has both clinicToken and adminToken
// authToken = clinicToken (correct! clinic is logged in)
// Result: Agent created with createdBy = clinic._id ✅
```

---

### **Change 3: Added Role Selector UI**

**Before:**
```javascript
// No role selector - only created agents
```

**After:**
```javascript
// Show role selector only if adminToken is present (admin can create both agent and doctorStaff)
const showRoleSelector = !!adminToken;

// In JSX:
{showRoleSelector && (
  <div>
    <label className="block text-sm text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
    <select
      value={role}
      onChange={(e) => setRole(e.target.value)}
      required
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none"
    >
      <option value="agent">Agent</option>
      <option value="doctorStaff">Doctor Staff</option>
    </select>
  </div>
)}
```

**Why**:
- Only admin can create both `agent` and `doctorStaff`
- Clinic and doctor can only create `agent` (role selector hidden)
- Provides clear UI for role selection

---

### **Change 4: Include Role in API Request**

**Before:**
```javascript
const { data } = await axios.post(
  '/api/lead-ms/create-agent',
  { name, email, phone, password },
  // Missing role parameter
);
```

**After:**
```javascript
const { data } = await axios.post(
  '/api/lead-ms/create-agent',
  { name, email, phone, password, role }, // ✅ Added role
  { headers: { Authorization: `Bearer ${authToken}` } }
);
```

**Why**:
- API requires `role` parameter to know whether to create `agent` or `doctorStaff`
- Without it, the API would reject the request

---

## 🔧 File 4: `/pages/admin/create-agent.tsx`

### **Change 1: Added DoctorStaff State**

**Before:**
```javascript
const [agents, setAgents] = useState<Agent[]>([]);
// Only agents state
```

**After:**
```javascript
const [agents, setAgents] = useState<Agent[]>([]);
const [doctorStaff, setDoctorStaff] = useState<Agent[]>([]);
const [activeView, setActiveView] = useState<'agents' | 'doctorStaff'>('agents');
```

**Why**:
- Separate state for `agents` and `doctorStaff` lists
- `activeView` tracks which list is currently displayed (for toggle)

---

### **Change 2: Separate Loading Functions**

**Before:**
```javascript
async function loadAgents() {
  const { data } = await axios.get('/api/lead-ms/get-agents', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (data.success) setAgents(data.agents);
}
```

**After:**
```javascript
async function loadAgents() {
  try {
    const { data } = await axios.get('/api/lead-ms/get-agents?role=agent', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (data.success) setAgents(data.agents);
  } catch (err) {
    console.error(err);
  }
}

async function loadDoctorStaff() {
  try {
    const { data } = await axios.get('/api/lead-ms/get-agents?role=doctorStaff', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (data.success) setDoctorStaff(data.agents);
  } catch (err) {
    console.error(err);
  }
}

async function loadAll() {
  await Promise.all([loadAgents(), loadDoctorStaff()]);
}
```

**Why**:
- **Separate API calls**: Fetches agents and doctorStaff separately using `?role=` parameter
- **Parallel loading**: `Promise.all()` loads both simultaneously for better performance
- **Role filtering**: API filters by role, ensuring correct data is fetched

---

### **Change 3: Added Toggle Slider UI**

**Before:**
```javascript
// No toggle - only showed agents
```

**After:**
```javascript
{/* Toggle Slider - Subtle integration */}
<div className="mb-6 flex items-center justify-between">
  <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
    <button
      onClick={() => setActiveView('agents')}
      className={`px-4 py-2 text-xs font-medium rounded-md transition-colors ${
        activeView === 'agents'
          ? 'bg-gray-900 text-white shadow-sm'
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      Agents ({totalAgents})
    </button>
    <button
      onClick={() => setActiveView('doctorStaff')}
      className={`px-4 py-2 text-xs font-medium rounded-md transition-colors ${
        activeView === 'doctorStaff'
          ? 'bg-gray-900 text-white shadow-sm'
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      Doctor Staff ({totalDoctorStaff})
    </button>
  </div>
</div>
```

**Why**:
- Provides visual toggle to switch between viewing agents and doctorStaff
- Shows counts for each type
- Maintains original UI design while adding functionality

---

### **Change 4: Dynamic Table Content**

**Before:**
```javascript
{agents.map((agent) => (
  // Always showed agents
))}
```

**After:**
```javascript
const currentList = activeView === 'agents' ? agents : doctorStaff;

// Later in JSX:
{currentList.map((agent) => (
  // Shows agents or doctorStaff based on activeView
))}
```

**Why**:
- Single table component that displays different data based on `activeView`
- Avoids code duplication
- Cleaner implementation

---

### **Change 5: Updated Action Handlers**

**Before:**
```javascript
if (data.success) {
  setAgents((prev) =>
    prev.map((a) => (a._id === agentId ? data.agent : a))
  );
}
```

**After:**
```javascript
if (data.success) {
  if (data.agent.role === 'doctorStaff') {
    setDoctorStaff((prev) =>
      prev.map((a) => (a._id === agentId ? data.agent : a))
    );
  } else {
    setAgents((prev) =>
      prev.map((a) => (a._id === agentId ? data.agent : a))
    );
  }
}
```

**Why**:
- Updates the correct state based on the record's role
- If updating a doctorStaff, updates `doctorStaff` state
- If updating an agent, updates `agents` state

---

## 🔧 File 5: `/pages/lead/create-agent.jsx`

### **Change 1: Fixed Token Handling**

**Before:**
```javascript
const token = typeof window !== 'undefined'
  ? localStorage.getItem('clinicToken') ||
    localStorage.getItem('doctorToken') ||
    localStorage.getItem('adminToken')
  : null;

const adminToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
```

**After:**
```javascript
// Get the appropriate token based on what's available (clinic > doctor > admin)
// This ensures we use the correct token for the logged-in user
const clinicToken = typeof window !== 'undefined' ? localStorage.getItem('clinicToken') : null;
const doctorToken = typeof window !== 'undefined' ? localStorage.getItem('doctorToken') : null;
const adminToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;

// Determine which token to use based on what's available
// Priority: clinicToken > doctorToken > adminToken
const token = clinicToken || doctorToken || adminToken;
```

**Why**:
- **Separates tokens explicitly**: No longer uses fallback chain that could pick wrong token
- **Correct priority**: Clinic token takes priority (since this is clinic dashboard)
- **Passes correct tokens to modal**: Each token is passed separately to `CreateAgentModal`

---

### **Change 2: Pass Correct Tokens to Modal**

**Before:**
```javascript
<CreateAgentModal
  token={token || undefined}
  doctorToken={undefined}
  adminToken={undefined}
/>
```

**After:**
```javascript
<CreateAgentModal
  token={clinicToken || undefined}
  doctorToken={doctorToken || undefined}
  adminToken={adminToken || undefined}
/>
```

**Why**:
- Passes each token explicitly
- Modal can determine which token to use based on what's available
- Ensures clinic uses `clinicToken`, not `adminToken`

---

## 🎯 Key Concepts Explained

### **1. Why `createdBy` is Critical**

```javascript
// When clinic creates agent:
createdBy: clinic._id  // e.g., "507f1f77bcf86cd799439011"

// When admin creates agent:
createdBy: admin._id   // e.g., "507f191e810c19729de860ea"

// Later, when fetching:
// Clinic query: { createdBy: clinic._id } → Only clinic's agents ✅
// Admin query: { createdBy: admin._id } → Only admin's agents ✅
```

**Without `createdBy`**: All users would see all records (security issue!)
**With `createdBy`**: Each user only sees their own records (secure!)

---

### **2. Why `clinicId` Matters for Clinic-Created Agents**

```javascript
// Clinic creates agent:
clinicId: clinic._id  // e.g., "507f1f77bcf86cd799439011"

// This allows:
// 1. Clinic to see agents from their clinic (even if created by someone else)
// 2. Proper filtering: { clinicId: clinic._id } OR { createdBy: clinic._id }
```

**Without `clinicId`**: Clinic-created agents wouldn't be tied to the clinic
**With `clinicId`**: Agents are properly associated with their clinic

---

### **3. Token Priority Fix**

**The Bug**:
```javascript
// OLD (WRONG):
const authToken = adminToken || doctorToken || token;
// If adminToken exists (even from previous session), it's used
// Result: Clinic uses admin token → createdBy = admin._id ❌
```

**The Fix**:
```javascript
// NEW (CORRECT):
const authToken = token || doctorToken || adminToken;
// token = clinicToken (for clinic dashboard)
// Result: Clinic uses clinic token → createdBy = clinic._id ✅
```

---

### **4. Query Structure for Clinic**

```javascript
// Clinic fetching agents:
query = {
  role: 'agent',
  $or: [
    { clinicId: clinic._id },      // Agents assigned to this clinic
    { createdBy: me._id }          // Agents created by this clinic
  ]
}

// This means clinic sees:
// 1. Agents from their clinic (clinicId matches)
// 2. Agents they created (createdBy matches)
// 3. NOT agents created by admin or other clinics ✅
```

---

## 🔍 Debugging Logs Added

### **In `create-agent.js`**:
```javascript
console.log('CREATE Agent - Current User:', { 
  role: me.role, 
  _id: me._id.toString(),
  email: me.email 
});

console.log('CREATE Agent - User Data:', {
  role: userData.role,
  clinicId: userData.clinicId?.toString() || null,
  createdBy: userData.createdBy.toString()
});
```

**Purpose**: Verify who is creating and what data is being saved

---

### **In `get-agents.js`**:
```javascript
console.log('GET Agents Query:', JSON.stringify(query, null, 2));
console.log('Current User:', { role: me.role, _id: me._id.toString() });
console.log('Found users:', users.length);
```

**Purpose**: Verify the query being executed and what results are returned

---

### **In `CreateAgentModal.jsx`**:
```javascript
console.log('CreateAgentModal - Token used:', {
  hasToken: !!token,
  hasDoctorToken: !!doctorToken,
  hasAdminToken: !!adminToken,
  usingToken: token ? 'clinicToken' : doctorToken ? 'doctorToken' : 'adminToken'
});
```

**Purpose**: Verify which token is being used for API calls

---

## ✅ Summary of All Changes

1. **`create-agent.js` API**:
   - ✅ Added `role` parameter support (agent/doctorStaff)
   - ✅ Fixed `clinicId` assignment for clinic-created agents
   - ✅ Always sets `createdBy` field
   - ✅ Allows clinic/doctor to create doctorStaff

2. **`get-agents.js` API**:
   - ✅ Added role filter parameter (`?role=agent` or `?role=doctorStaff`)
   - ✅ Strict filtering by `createdBy` for all roles
   - ✅ Fixed query structure to avoid conflicts
   - ✅ Returns `role` field in response

3. **`CreateAgentModal.jsx`**:
   - ✅ Added role selector (only for admin)
   - ✅ Fixed token priority (clinicToken first)
   - ✅ Includes role in API request

4. **`admin/create-agent.tsx`**:
   - ✅ Added toggle slider for agents/doctorStaff
   - ✅ Separate state for both lists
   - ✅ Dynamic table content based on active view

5. **`lead/create-agent.jsx`**:
   - ✅ Fixed token handling (explicit clinicToken/doctorToken/adminToken)
   - ✅ Added toggle functionality
   - ✅ Same features as admin page

---

## 🎓 Learning Points

1. **Always track creator**: Use `createdBy` field to filter records by creator
2. **Token priority matters**: Wrong token = wrong user context = wrong `createdBy`
3. **Query structure**: Build queries explicitly to avoid MongoDB conflicts
4. **Role-based filtering**: Different roles need different query logic
5. **State management**: Separate state for different data types (agents vs doctorStaff)

---

This implementation ensures:
- ✅ Clinic-created agents show only in clinic dashboard
- ✅ Admin-created agents show only in admin dashboard
- ✅ Doctor-created agents show only in doctor dashboard
- ✅ Proper `clinicId` assignment for clinic-created agents
- ✅ Secure filtering based on `createdBy` field

