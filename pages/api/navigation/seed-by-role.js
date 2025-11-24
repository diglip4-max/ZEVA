// pages/api/navigation/seed-by-role.js
import dbConnect from "../../../lib/database";
import ClinicNavigationItem from "../../../models/ClinicNavigationItem";
import { getUserFromReq, requireRole } from "../lead-ms/auth";
import { clinicNavigationItems } from "../../../data/clinicNavigationItems";

// Admin sidebar items (from AdminSidebar.tsx)
const adminNavigationItems = [
  {
    label: 'Dashboard',
    path: '/admin/dashboard-admin',
    icon: '🏠',
    description: 'Overview & analytics',
    moduleKey: 'dashboard',
    order: 1,
  },
  {
    label: 'SMS Management',
    icon: '💬',
    description: 'Manage SMS wallets and top-ups',
    moduleKey: 'sms_management',
    order: 11,
    children: [
      {
        label: 'Manage Wallets',
        path: '/admin/manage-sms-wallets',
        icon: '💼',
        order: 1,
      },
      {
        label: 'Top-up Requests',
        path: '/admin/manage-sms-topups',
        icon: '💳',
        order: 2,
      },
    ],
  },
  {
    label: 'Approval Clinic',
    path: '/admin/AdminClinicApproval ',
    icon: '✅',
    description: 'Manage Clinics',
    moduleKey: 'approval_clinic',
    order: 2,
  },
  {
    label: 'Approval Doctors',
    path: '/admin/approve-doctors',
    icon: '🏥',
    description: 'Manage Doctors',
    moduleKey: 'approval_doctors',
    order: 3,
  },
  {
    label: 'Add Treatment',
    path: '/admin/add-treatment',
    icon: '📝',
    description: 'Add new Treatment',
    moduleKey: 'add_treatment',
    order: 4,
  },
  {
    label: 'All Blogs',
    path: '/admin/all-blogs',
    icon: '👥',
    description: 'Manage users & roles',
    moduleKey: 'all_blogs',
    order: 5,
  },
  {
    label: 'User Analytics',
    path: '/admin/analytics',
    icon: '📊',
    description: 'View detailed reports',
    moduleKey: 'user_analytics',
    order: 6,
  },
  {
    label: 'Request Call Back',
    path: '/admin/get-in-touch',
    icon: '📞',
    description: 'View and export user call back requests',
    moduleKey: 'request_callback',
    order: 7,
  },
  {
    label: 'Manage Job',
    path: '/admin/job-manage',
    icon: '⚙️',
    description: 'Approve or decline job',
    moduleKey: 'manage_job',
    order: 8,
  },
  {
    label: "Staff Management",
    icon: "👥",
    description: "Manage Staff",
    moduleKey: "staff_management",
    order: 9,
    children: [
      {
        label: "Create Staff",
        path: "/admin/create-staff",
        icon: "🧑‍💼",
        order: 1,
      },
      {
        label: "Create Services",
        path: "/admin/admin-add-service",
        icon: "🛠️",
        order: 2,
      },
      {
        label: "Create Vendor",
        path: "/admin/admin-create-vendor",
        icon: "🏢",
        order: 3,
      },
      {
        label: 'View EOD Report',
        path: '/admin/getAllEodNotes',
        icon: '📄',
        order: 4,
      },
      {
        label: 'Patient Report',
        path: '/admin/patient-report',
        icon: '📋',
        order: 5,
      },
      {
        label: 'Track Expenses',
        path: '/admin/track-expenses',
        icon: '💰',
        order: 6,
      },
      {
        label: 'Contracts',
        path: '/admin/Contractor',
        icon: '⚙️',
        order: 7,
      },
    ],
  },
  {
    label: "Create Agent",
    path: "/admin/create-agent",
    icon: "👤",
    description: "Create agent account",
    moduleKey: "create_agent",
    order: 10,
  },
];

// Agent sidebar items (shared with clinic but with agent paths)
const agentNavigationItems = [
  {
    label: "Dashboard",
    path: "/agent/agent-dashboard",
    icon: "🏠",
    description: "Overview & metrics",
    moduleKey: "dashboard",
    order: 1,
  },
  {
    label: "Assigned Leads",
    path: "/agent/assigned-leads",
    icon: "📋",
    description: "Leads assigned to you",
    moduleKey: "assignedLead",
    order: 2,
  },
  {
    label: "Lead",
    icon: "🧑‍💼",
    description: "Lead Management",
    moduleKey: "lead",
    order: 3,
    children: [
      {
        label: "Dashboard",
        path: "/agent/lead/dashboard",
        icon: "🏠",
        order: 1,
      },
      {
        label: "Create Lead",
        path: "/agent/lead/create-lead",
        icon: "👤",
        order: 2,
      },
      {
        label: "Assign Lead",
        path: "/agent/lead/assign-lead",
        icon: "👨‍⚕️",
        order: 3,
      },
      {
        label: "Create Offer",
        path: "/agent/lead/create-offer",
        icon: "🤑",
        order: 4,
      },
      {
        label: "Create Agent",
        path: "/agent/lead/create-agent",
        icon: "👤",
        order: 5,
      },
      {
        label: "Permission",
        path: "/agent/lead/permission",
        icon: "🔒",
        order: 6,
      },
    ],
  },
  {
    label: "Marketing",
    icon: "📊",
    description: "Manage Marketing",
    moduleKey: "marketing",
    order: 4,
    children: [
      {
        label: "SMS Marketing",
        path: "/agent/marketing/sms-marketing",
        icon: "📩",
        order: 1,
      },
      {
        label: "WhatsApp Marketing",
        path: "/agent/marketing/whatsapp-marketing",
        icon: "💬",
        order: 2,
      },
      {
        label: "Gmail Marketing",
        path: "/agent/marketing/gmail-marketing",
        icon: "✉️",
        order: 3,
      },
    ],
  },
  {
    label: "Staff Management",
    icon: "👥",
    description: "Manage Staff",
    moduleKey: "staff_management",
    order: 5,
    children: [
      { label: "Dashboard", path: "/agent/staff-dashboard", icon: "🏠", order: 1 },
      { label: "Add Service", path: "/agent/add-service", icon: "➕", order: 2 },
      { label: "Patient Registration", path: "/agent/patient-registration", icon: "🧍‍♂️", order: 3 },
      { label: "Patient Information", path: "/agent/patient-information", icon: "📋", order: 4 },
      { label: "Add EOD Task", path: "/agent/eodNotes", icon: "✅", order: 5 },
      { label: "Add Expense", path: "/agent/AddPettyCashForm", icon: "💸", order: 6 },
      { label: "Add Vendor", path: "/agent/add-vendor", icon: "🧑‍💼", order: 7 },
      { label: "Membership", path: "/agent/membership", icon: "🧑‍💼", order: 8 },
      { label: "All Contracts", path: "/agent/contract", icon: "🧑‍💼", order: 9 },
    ],
  },
];

// Doctor sidebar items (from DoctorSidebar.tsx)
const doctorNavigationItems = [
  {
    label: "Dashboard",
    path: "/doctor/doctor-dashboard",
    icon: "🏠",
    description: "Overview & metrics",
    moduleKey: "dashboard",
    order: 1,
  },
  {
    label: "Assigned Leads",
    path: "/doctor/assigned-leads",
    icon: "📋",
    description: "Leads assigned to you",
    moduleKey: "assignedLead",
    order: 2,
  },
  {
    label: "Manage Profile",
    path: "/doctor/manageDoctor",
    icon: "👤",
    description: "Manage Profile",
    moduleKey: "manage_profile",
    order: 3,
  },
  {
    label: "All users Review",
    path: "/doctor/getReview",
    icon: "📅",
    description: "See All Users Reviews",
    moduleKey: "all_users_review",
    order: 4,
  },
  {
    label: "Blogs",
    icon: "📄",
    description: "Blog Management",
    moduleKey: "blogs",
    order: 5,
    children: [
      { label: "Write Article", path: "/doctor/BlogForm", icon: "📝", order: 1 },
      { label: "Published Blogs", path: "/doctor/published-blogs", icon: "📄", order: 2 },
      { label: "Blog Analytics", path: "/doctor/getAuthorCommentsAndLikes", icon: "📊", order: 3 },
    ],
  },
  {
    label: "Staff Management",
    icon: "👥",
    description: "Manage Staff",
    moduleKey: "staff_management",
    order: 6,
    children: [
      { label: "Dashboard", path: "/clinic/staff-dashboard", icon: "🏠", order: 1 },
      { label: "Add Service", path: "/clinic/add-service", icon: "➕", order: 2 },
      { label: "Patient Registration", path: "/clinic/patient-registration", icon: "🧍‍♂️", order: 3 },
      { label: "Patient Information", path: "/clinic/patient-information", icon: "📋", order: 4 },
      { label: "Add EOD Task", path: "/clinic/eodNotes", icon: "✅", order: 5 },
      { label: "Add Expense", path: "/clinic/AddPettyCashForm", icon: "💸", order: 6 },
      { label: "Add Vendor", path: "/clinic/add-vendor", icon: "🧑‍💼", order: 7 },
      { label: "Membership", path: "/clinic/membership", icon: "🧑‍💼", order: 8 },
      { label: "All Contracts", path: "/clinic/contract", icon: "🧑‍💼", order: 9 },
    ],
  },
  {
    label: "Jobs",
    icon: "💼",
    description: "Job Management",
    moduleKey: "jobs",
    order: 7,
    children: [
      { label: "Post Job", path: "/doctor/create-job", icon: "📢", order: 1 },
      { label: "See Jobs", path: "/doctor/my-jobs", icon: "💼", order: 2 },
      { label: "Job Applicants", path: "/doctor/job-applicants", icon: "👥", order: 3 },
    ],
  },
  {
    label: "Prescription Requests",
    path: "/doctor/prescription-requests",
    icon: "📋",
    description: "View all prescription requests",
    moduleKey: "prescription_requests",
    order: 8,
  },
  {
    label: "Create Agent",
    path: "/doctor/create-agent",
    icon: "👤",
    description: "Create agent account",
    moduleKey: "create_agent",
    order: 9,
  },
  {
    label: "Lead",
    icon: "🧑‍💼",
    description: "Lead Management",
    moduleKey: "lead",
    order: 10,
    children: [
      {
        label: "Dashboard",
        path: "/doctor/lead/dashboard",
        icon: "🏠",
        order: 1,
      },
      {
        label: "Create Lead",
        path: "/doctor/lead/create-lead",
        icon: "👤",
        order: 2,
      },
      {
        label: "Assign Lead",
        path: "/doctor/lead/assign-lead",
        icon: "👨‍⚕️",
        order: 3,
      },
      {
        label: "Create Offer",
        path: "/doctor/lead/create-offer",
        icon: "🤑",
        order: 4,
      },
      {
        label: "Create Agent",
        path: "/doctor/lead/create-agent",
        icon: "👤",
        order: 5,
      },
      {
        label: "Permission",
        path: "/doctor/lead/permission",
        icon: "🔒",
        order: 6,
      },
    ],
  },
  {
    label: "Marketing",
    icon: "📊",
    description: "Manage Marketing",
    moduleKey: "marketing",
    order: 11,
    children: [
      {
        label: "SMS Marketing",
        path: "/doctor/marketing/sms-marketing",
        icon: "📩",
        order: 1,
      },
      {
        label: "WhatsApp Marketing",
        path: "/doctor/marketing/whatsapp-marketing",
        icon: "💬",
        order: 2,
      },
      {
        label: "Gmail Marketing",
        path: "/doctor/marketing/gmail-marketing",
        icon: "✉️",
        order: 3,
      },
    ],
  },
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  await dbConnect();
  const me = await getUserFromReq(req);

  if (!me) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Missing or invalid token' });
  }

  // Allow admin, clinic, and doctor roles
  if (!requireRole(me, ['admin', 'clinic', 'doctor'])) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  try {
    const { role } = req.body;

    // Validate role
    if (!role || !['admin', 'clinic', 'doctor'].includes(role)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid role. Must be admin, clinic, or doctor' 
      });
    }

    // Verify user has permission to seed for this role
    // Admin can seed any role, clinic can only seed clinic, doctor can only seed doctor
    if (me.role === 'clinic' && role !== 'clinic') {
      return res.status(403).json({ 
        success: false, 
        message: 'Clinic users can only seed clinic navigation items' 
      });
    }
    if (me.role === 'doctor' && role !== 'doctor') {
      return res.status(403).json({ 
        success: false, 
        message: 'Doctor users can only seed doctor navigation items' 
      });
    }

    // Get navigation items based on role
    let navigationItems;
    if (role === 'admin') {
      navigationItems = adminNavigationItems;
    } else if (role === 'clinic') {
      navigationItems = clinicNavigationItems;
    } else if (role === 'doctor') {
      navigationItems = doctorNavigationItems;
    }

    // Transform navigation items to match ClinicNavigationItem schema
    const itemsToInsert = navigationItems.map((item, index) => {
      const moduleKey = item.moduleKey || 
        item.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

      return {
        label: item.label,
        path: item.path || "",
        icon: item.icon,
        description: item.description || "",
        badge: typeof item.badge === "number" ? item.badge : null,
        order: typeof item.order === "number" ? item.order : index + 1,
        moduleKey: `${role}_${moduleKey}`, // Prefix with role to ensure uniqueness
        role: role,
        parentId: item.parentId || null,
        subModules: Array.isArray(item.children)
          ? item.children.map((child, childIdx) => ({
              name: child.label,
              path: child.path || "",
              icon: child.icon,
              order: typeof child.order === "number" ? child.order : childIdx + 1,
            }))
          : [],
        isActive: true,
      };
    });

    const insertedItems = [];
    const updatedItems = [];

    for (const item of itemsToInsert) {
      const filter = { role: item.role, moduleKey: item.moduleKey };
      const existing = await ClinicNavigationItem.findOne(filter);

      if (!existing) {
        const created = await ClinicNavigationItem.create(item);
        insertedItems.push(created);
        continue;
      }

      const payload = {
        label: item.label,
        path: item.path,
        icon: item.icon,
        description: item.description,
        badge: item.badge,
        order: item.order,
        parentId: item.parentId,
        subModules: item.subModules,
        isActive: item.isActive,
      };

      const hasChanges =
        existing.label !== payload.label ||
        existing.path !== payload.path ||
        existing.icon !== payload.icon ||
        existing.description !== payload.description ||
        (existing.badge ?? null) !== payload.badge ||
        existing.order !== payload.order ||
        (existing.parentId ? existing.parentId.toString() : null) !== (payload.parentId ? payload.parentId.toString() : null) ||
        existing.isActive !== payload.isActive ||
        JSON.stringify(existing.subModules) !== JSON.stringify(payload.subModules);

      if (hasChanges) {
        Object.assign(existing, payload);
        await existing.save();
        updatedItems.push(existing);
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: `${role} navigation items seeded successfully`,
      inserted: insertedItems.length,
      updated: updatedItems.length,
      totalTemplates: itemsToInsert.length
    });
  } catch (error) {
    console.error('Error seeding navigation items:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  }
}

