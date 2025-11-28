# DoctorStaff Permissions Flow - Complete Documentation

This document explains how `doctorStaff` role (using `userToken`) works with the agent portal system, including all file changes and the complete permission flow from clinic to agent dashboard.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Key Changes Made](#key-changes-made)
3. [Complete Permission Flow](#complete-permission-flow)
4. [File-by-File Changes](#file-by-file-changes)
5. [How It Works End-to-End](#how-it-works-end-to-end)
6. [Technical Details](#technical-details)

---

## 🎯 Overview

**Problem Solved:**
- `doctorStaff` users (with `userToken`) were being redirected to `/staff/staff-dashboard` instead of `/agent/dashboard`
- When clicking sidebar modules, they were navigating to clinic routes, causing layout switches
- Permissions were working but navigation was inconsistent

**Solution:**
- Both `staff` (agentToken) and `doctorStaff` (userToken) now use the same agent portal system
- All navigation stays within `/agent/*` routes
- Permissions are enforced consistently through the same API

---

## 🔧 Key Changes Made

### Files Modified:

1. **`pages/staff.jsx`** - Login redirect fix
2. **`components/AgentSidebar.tsx`** - Token detection for doctorStaff
3. **`pages/api/staff/sidebar-permissions.js`** - Path conversion for doctorStaff
4. **`pages/agent/[slug].tsx`** - Support for userToken
5. **`components/withAgentAuth.tsx`** - Authentication for both tokens
6. **`pages/clinic/get-Enquiry.tsx`** - Token fallback for API calls

---

## 🔄 Complete Permission Flow

### Step 1: Clinic Grants Permissions

**Location:** `/lead/create-agent` page

1. Clinic admin selects a `doctorStaff` user
2. Clicks "Manage Permissions"
3. Grants permissions via `/api/agent/permissions` API
4. Permissions are saved to `AgentPermission` model:
   ```javascript
   {
     agentId: doctorStaffUserId,
     permissions: [
       {
         module: "clinic_enquiry",
         actions: { read: true, create: true, ... },
         subModules: [...]
       }
     ]
   }
   ```

### Step 2: DoctorStaff Login

**Location:** `/staff` login page (`pages/staff.jsx`)

**Before Fix:**
```javascript
if (tokenKey === "agentToken") {
  router.push("/agent/dashboard");
} else {
  router.push("/staff/staff-dashboard"); // ❌ Wrong route
}
```

**After Fix:**
```javascript
if (tokenKey === "agentToken") {
  localStorage.setItem("agentToken", token);
  localStorage.removeItem("userToken");
  router.push("/agent/dashboard");
} else {
  localStorage.setItem("userToken", token); // ✅ doctorStaff uses userToken
  localStorage.removeItem("agentToken");
  router.push("/agent/dashboard"); // ✅ Same route as staff
}
```

**Result:** Both roles now land on `/agent/dashboard`

---

### Step 3: Sidebar Loads with Permissions

**Location:** `components/AgentSidebar.tsx`

**Token Detection:**
```typescript
// Check for both agentToken (staff) and userToken (doctorStaff)
const agentToken = typeof window !== "undefined" 
  ? (localStorage.getItem("agentToken") || sessionStorage.getItem("agentToken"))
  : null;
const userToken = typeof window !== "undefined"
  ? (localStorage.getItem("userToken") || sessionStorage.getItem("userToken"))
  : null;

// Use whichever token is available
const token = agentToken || userToken;
```

**API Call:**
```typescript
const res = await axios.get("/api/agent/sidebar-permissions", {
  headers: { Authorization: `Bearer ${token}` },
});
```

---

### Step 4: API Filters Navigation Items

**Location:** `pages/api/agent/sidebar-permissions.js`

**Process:**

1. **Authentication:**
   ```javascript
   const me = await getUserFromReq(req);
   // Supports both 'agent' and 'doctorStaff' roles
   if (!['agent', 'doctorStaff'].includes(me.role)) {
     return res.status(403).json({ ... });
   }
   ```

2. **Determine Navigation Role:**
   ```javascript
   let navigationRole = 'clinic'; // default
   if (me.createdBy) {
     const creator = await User.findById(me.createdBy).select('role');
     if (creator.role === 'admin') navigationRole = 'admin';
     else if (creator.role === 'clinic') navigationRole = 'clinic';
     else if (creator.role === 'doctor') navigationRole = 'doctor';
   }
   ```

3. **Fetch Navigation Items:**
   ```javascript
   const navigationItems = await ClinicNavigationItem.find({ 
     role: navigationRole, 
     isActive: true 
   }).sort({ order: 1 });
   ```

4. **Get Permissions:**
   ```javascript
   const agentPermission = await AgentPermission.findOne({ 
     agentId: me._id // Works for both agent and doctorStaff
   });
   ```

5. **Filter Based on Permissions:**
   ```javascript
   const filteredNavigationItems = navigationItems
     .map(item => {
       // Check if user has permission for this module
       const modulePerm = permissionMap[item.moduleKey];
       const hasModulePermission = modulePerm && (
         modulePerm.moduleActions.read === true ||
         modulePerm.moduleActions.all === true ||
         // ... other actions
       );
       
       // Filter submodules
       let filteredSubModules = item.subModules.filter(subModule => {
         // Check submodule permissions
       });
       
       // Convert path to agent format
       const agentPath = convertPathToAgent(item.path, navigationRole);
       // /clinic/appointment → /agent/clinic-appointment
       
       return { ...item, path: agentPath, subModules: filteredSubModules };
     })
     .filter(item => item !== null);
   ```

6. **Path Conversion:**
   ```javascript
   const convertPathToAgent = (path = "", navigationRole = "clinic") => {
     if (path.startsWith("clinic/")) {
       const relative = path.slice("clinic/".length);
       return `/agent/clinic-${formatSlugSegment(relative)}`;
     }
     // /clinic/get-Enquiry → /agent/clinic-get-Enquiry
   };
   ```

---

### Step 5: User Clicks Sidebar Module

**Location:** `components/AgentSidebar.tsx`

When doctorStaff clicks "Enquiry":
```tsx
<Link href="/agent/clinic-get-Enquiry">
  {/* Rendered navigation item */}
</Link>
```

**Result:** Navigates to `/agent/clinic-get-Enquiry`

---

### Step 6: Dynamic Route Handler Loads Page

**Location:** `pages/agent/[slug].tsx`

**Process:**

1. **Extract Slug:**
   ```typescript
   const { slug } = router.query; // "clinic-get-Enquiry"
   ```

2. **Get Token (Both Types):**
   ```typescript
   const agentToken = localStorage.getItem('agentToken') || sessionStorage.getItem('agentToken');
   const userToken = localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
   const token = agentToken || userToken; // ✅ Supports doctorStaff
   ```

3. **Determine Route Type:**
   ```typescript
   const routeInfo = getRouteInfo(slug);
   // "clinic-get-Enquiry" → { type: 'clinic', tokenKey: 'clinicToken' }
   ```

4. **Set Token Context:**
   ```typescript
   if (routeInfo.type === 'clinic') {
     clinicToken = token; // Use userToken for doctorStaff
     localStorage.setItem('clinicToken', token); // Temporary
   }
   ```

5. **Load Page Component:**
   ```typescript
   const pageLoader = routeMap['clinic-get-Enquiry'];
   // → () => import('./clinic-get-Enquiry')
   const module = await pageLoader();
   const ExportedComponent = module.default;
   ```

6. **Render with Agent Layout:**
   ```typescript
   return (
     <TokenContext.Provider value={tokenContext}>
       <AgentLayout>
         <ExportedComponent /> {/* Clinic enquiry page */}
       </AgentLayout>
     </TokenContext.Provider>
   );
   ```

---

### Step 7: Page Component Makes API Calls

**Location:** `pages/clinic/get-Enquiry.tsx` (loaded via agent route)

**Token Detection:**
```typescript
const token = routeContext === "agent"
  ? (localStorage.getItem("agentToken") || 
     localStorage.getItem("userToken") || // ✅ Fallback for doctorStaff
     sessionStorage.getItem("agentToken") ||
     sessionStorage.getItem("userToken"))
  : localStorage.getItem("clinicToken");
```

**API Call:**
```typescript
const res = await axios.get("/api/clinics/getEnquiries?scope=clinic", {
  headers: { Authorization: `Bearer ${token}` },
});
```

**Backend Validates:**
```javascript
// pages/api/clinics/getEnquiries.js
const decoded = jwt.verify(token, process.env.JWT_SECRET);
if (decoded.role === 'agent' || decoded.role === 'doctorStaff') {
  // Allow access with clinic scope
}
```

---

## 📁 File-by-File Changes

### 1. `pages/staff.jsx`

**Change:** Login redirect for doctorStaff

**Before:**
```javascript
if (tokenKey === "agentToken") {
  router.push("/agent/dashboard");
} else {
  router.push("/staff/staff-dashboard"); // ❌
}
```

**After:**
```javascript
if (tokenKey === "agentToken") {
  localStorage.setItem("agentToken", token);
  localStorage.removeItem("userToken");
  router.push("/agent/dashboard");
} else {
  localStorage.setItem("userToken", token);
  localStorage.removeItem("agentToken");
  router.push("/agent/dashboard"); // ✅ Same route
}
```

---

### 2. `components/AgentSidebar.tsx`

**Change:** Support both agentToken and userToken

**Before:**
```typescript
const token = typeof window !== "undefined" 
  ? localStorage.getItem("agentToken") 
  : null;
```

**After:**
```typescript
const agentToken = typeof window !== "undefined" 
  ? (localStorage.getItem("agentToken") || sessionStorage.getItem("agentToken"))
  : null;
const userToken = typeof window !== "undefined"
  ? (localStorage.getItem("userToken") || sessionStorage.getItem("userToken"))
  : null;
const token = agentToken || userToken; // ✅ Supports both
```

---

### 3. `pages/api/staff/sidebar-permissions.js`

**Change:** Path conversion for doctorStaff to agent format

**Key Addition:**
```javascript
// For doctorStaff role, use same path conversion as agent sidebar
if (me.role === 'doctorStaff') {
  // Get permissions from AgentPermission model
  const staffPermission = await AgentPermission.findOne({ agentId: me._id });
  
  // Filter navigation items based on permissions
  // Convert paths: /clinic/appointment → /agent/clinic-appointment
  const agentPath = convertPathToAgent(item.path, navigationRole);
  
  return {
    ...item,
    path: agentPath, // ✅ Agent route format
    subModules: convertedSubModules
  };
}
```

**Helper Functions Added:**
```javascript
const formatSlugSegment = (segment = "") =>
  segment.split("/").filter(Boolean).join("-").replace(/--+/g, "-");

const convertPathToAgent = (path = "", navigationRole = "clinic") => {
  if (path.startsWith("clinic/")) {
    const relative = path.slice("clinic/".length);
    return `/agent/clinic-${formatSlugSegment(relative)}`;
  }
  // ... other conversions
};
```

---

### 4. `pages/agent/[slug].tsx`

**Change:** Support userToken in addition to agentToken

**Before:**
```typescript
const agentToken = localStorage.getItem('agentToken');
if (!agentToken) {
  setError('Agent token not found');
  return;
}
```

**After:**
```typescript
const agentToken = localStorage.getItem('agentToken') || sessionStorage.getItem('agentToken');
const userToken = localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
const token = agentToken || userToken; // ✅ Supports doctorStaff

if (!token) {
  setError('Token not found');
  return;
}
```

---

### 5. `components/withAgentAuth.tsx`

**Change:** Authenticate both token types

**Before:**
```typescript
const token = localStorage.getItem("agentToken") || sessionStorage.getItem("agentToken");
```

**After:**
```typescript
const agentToken = localStorage.getItem("agentToken") || sessionStorage.getItem("agentToken");
const userToken = localStorage.getItem("userToken") || sessionStorage.getItem("userToken");
const token = agentToken || userToken; // ✅ Supports doctorStaff
```

---

### 6. `pages/clinic/get-Enquiry.tsx`

**Change:** Token fallback for API calls

**Before:**
```typescript
const token = routeContext === "agent"
  ? localStorage.getItem("agentToken")
  : localStorage.getItem("clinicToken");
```

**After:**
```typescript
const token = routeContext === "agent"
  ? (localStorage.getItem("agentToken") ||
     localStorage.getItem("userToken") || // ✅ Fallback
     sessionStorage.getItem("agentToken") ||
     sessionStorage.getItem("userToken"))
  : localStorage.getItem("clinicToken");
```

---

## 🎬 How It Works End-to-End

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CLINIC GRANTS PERMISSIONS                                │
│    /lead/create-agent → /api/agent/permissions              │
│    Saves to AgentPermission model                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. DOCTORSTAFF LOGS IN                                      │
│    /staff → POST /api/staff/login                           │
│    Returns: { token, tokenKey: "userToken" }                │
│    Redirects to: /agent/dashboard ✅                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. AGENT SIDEBAR LOADS                                      │
│    AgentSidebar.tsx                                         │
│    - Checks for userToken ✅                                 │
│    - Calls /api/agent/sidebar-permissions                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. API FILTERS NAVIGATION                                   │
│    /api/agent/sidebar-permissions                           │
│    - Authenticates doctorStaff role ✅                       │
│    - Gets AgentPermission document                          │
│    - Filters modules/submodules by permissions              │
│    - Converts paths: /clinic/enquiry → /agent/clinic-enquiry│
│    Returns: Filtered navigation items                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. USER CLICKS "ENQUIRY"                                    │
│    Sidebar renders: <Link href="/agent/clinic-get-Enquiry"> │
│    Router navigates to /agent/clinic-get-Enquiry            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. DYNAMIC ROUTE HANDLER                                    │
│    /agent/[slug].tsx                                        │
│    - Extracts slug: "clinic-get-Enquiry"                    │
│    - Gets userToken ✅                                       │
│    - Maps to: ./clinic-get-Enquiry component                │
│    - Sets clinicToken = userToken (temporary)                │
│    - Renders with AgentLayout                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. PAGE COMPONENT LOADS                                     │
│    clinic/get-Enquiry.tsx (via agent route)                 │
│    - Detects routeContext = "agent"                         │
│    - Gets userToken ✅                                       │
│    - Calls /api/clinics/getEnquiries                        │
│    - Backend validates doctorStaff role ✅                   │
│    - Returns enquiry data                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 Technical Details

### Permission Model Structure

```javascript
AgentPermission {
  agentId: ObjectId, // Can be agent or doctorStaff user ID
  permissions: [
    {
      module: "clinic_enquiry",
      actions: {
        all: false,
        create: true,
        read: true,
        update: false,
        delete: false,
        approve: false,
        print: false,
        export: false
      },
      subModules: [
        {
          name: "Create Enquiry",
          actions: { read: true, create: true, ... }
        }
      ]
    }
  ],
  grantedBy: ObjectId,
  isActive: true
}
```

### Path Conversion Examples

| Original Path | Agent Route | Component Loaded |
|--------------|-------------|------------------|
| `/clinic/appointment` | `/agent/clinic-appointment` | `./clinic-appointment` |
| `/clinic/get-Enquiry` | `/agent/clinic-get-Enquiry` | `./clinic-get-Enquiry` |
| `/clinic/all-appointment` | `/agent/clinic-all-appointment` | `./clinic-all-appointment` |
| `/staff/patient-registration` | `/agent/clinic-staff-patient-registration` | `../staff/patient-registration` |

### Token Flow

```
Login → userToken stored
  ↓
AgentSidebar → Reads userToken
  ↓
API calls → Sends userToken in Authorization header
  ↓
Backend → Validates userToken, checks role = 'doctorStaff'
  ↓
Permission check → Uses agentId from token to find AgentPermission
  ↓
Response → Returns filtered data based on permissions
```

---

## ✅ Key Benefits

1. **Consistent Navigation:** Both staff and doctorStaff use `/agent/*` routes
2. **Unified Permissions:** Same `AgentPermission` model for both roles
3. **No Layout Switching:** All pages render with `AgentLayout`
4. **Token Flexibility:** System supports both `agentToken` and `userToken`
5. **Permission Enforcement:** Backend validates permissions on every API call

---

## 🧪 Testing Checklist

- [ ] DoctorStaff can login and land on `/agent/dashboard`
- [ ] Sidebar shows only modules with granted permissions
- [ ] Clicking a module navigates to `/agent/clinic-*` route
- [ ] Page loads correctly with AgentLayout
- [ ] API calls work with userToken
- [ ] Permissions are enforced (can't access modules without permission)
- [ ] No redirects to `/staff/*` routes
- [ ] No layout switching when clicking modules

---

## 📝 Notes

- `doctorStaff` role is stored in `userToken` (same as regular staff)
- `agent` role is stored in `agentToken`
- Both use the same `AgentPermission` model for permissions
- Path conversion ensures all routes stay within `/agent/*` namespace
- Backend APIs validate both roles for agent portal access

---

**Last Updated:** Based on implementation for doctorStaff permissions flow
**Related Files:**
- `pages/staff.jsx`
- `components/AgentSidebar.tsx`
- `pages/api/agent/sidebar-permissions.js`
- `pages/api/staff/sidebar-permissions.js`
- `pages/agent/[slug].tsx`
- `components/withAgentAuth.tsx`

