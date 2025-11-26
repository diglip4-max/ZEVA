import { useState, useEffect } from "react";
import axios from "axios";
import ClinicLayout from '../../components/ClinicLayout';
import withClinicAuth from '../../components/withClinicAuth';
import CreateLeadModal from '../../components/CreateLeadModal';
import LeadViewModal from '../../components/LeadViewModal';
import { PlusCircle } from "lucide-react";

function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [agents, setAgents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    treatment: "",
    offer: "",
    source: "",
    status: "",
    name: "",
    startDate: "",
    endDate: "",
  });
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [viewLead, setViewLead] = useState(null);
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canRead: false,
    canAssign: false,
  });
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("clinicToken") : null;

  // Fetch permissions
  const fetchPermissions = async () => {
    if (!token) return;
    try {
      const res = await axios.get("/api/clinic/permissions", {
          headers: { Authorization: `Bearer ${token}` },
        });
      const data = res.data;
      if (data.success && data.data) {
        // Find module permission - try multiple variations of module key
        const modulePermission = data.data.permissions?.find(
          (p) => {
            const moduleKey = p.module || "";
            return moduleKey === "lead" || 
                   moduleKey === "clinic_lead" || 
                   moduleKey.replace(/^(admin|clinic|doctor)_/, "") === "lead";
          }
        );
        if (modulePermission) {
          const actions = modulePermission.actions || {};
          console.log('[create-lead] Module permission found:', {
            module: modulePermission.module,
            actions: actions,
            subModules: modulePermission.subModules?.map(sm => sm.name)
          });
          
          // Check for "Create Lead" submodule
          const createLeadSubModule = modulePermission.subModules?.find(
            (sm) => sm.name === "Create Lead"
          );
          // Check for "Assign Lead" submodule
          const assignLeadSubModule = modulePermission.subModules?.find(
            (sm) => sm.name === "Assign Lead"
          );

          // Helper function to check if a permission value is true (handles boolean and string)
          const isTrue = (value) => {
            if (value === true) return true;
            if (value === "true") return true;
            if (String(value).toLowerCase() === "true") return true;
            return false;
          };

          // Module-level "all" grants all permissions including submodules
          const moduleAll = isTrue(actions.all);
          const moduleCreate = isTrue(actions.create);
          const moduleUpdate = isTrue(actions.update);
          const moduleDelete = isTrue(actions.delete);
          const moduleRead = isTrue(actions.read);
          
          console.log('[create-lead] Permission checks:', {
            moduleAll,
            moduleRead,
            moduleCreate,
            moduleUpdate,
            moduleDelete
          });

          // Submodule permissions (only checked if module-level doesn't grant)
          const createLeadAll = isTrue(createLeadSubModule?.actions?.all);
          const createLeadCreate = isTrue(createLeadSubModule?.actions?.create);
          const assignLeadAll = isTrue(assignLeadSubModule?.actions?.all);
          const assignLeadUpdate = isTrue(assignLeadSubModule?.actions?.update);
          const assignLeadCreate = isTrue(assignLeadSubModule?.actions?.create);

          setPermissions({
            // Create: Module "all" OR module "create" OR submodule "all" OR submodule "create"
            canCreate: moduleAll || moduleCreate || createLeadAll || createLeadCreate,
            // Update: Module "all" OR module "update" OR submodule "all" OR submodule "update"
            canUpdate: moduleAll || moduleUpdate || assignLeadAll || assignLeadUpdate,
            // Delete: Module "all" OR module "delete"
            canDelete: moduleAll || moduleDelete,
            // Read: Module "all" OR module "read"
            canRead: moduleAll || moduleRead,
            // Assign: Module "all" OR module "update" OR submodule "all" OR submodule "update" OR submodule "create"
            // When module-level "all" is true, it should grant assign permission
            canAssign: moduleAll || moduleUpdate || assignLeadAll || assignLeadUpdate || assignLeadCreate,
          });
        } else {
          // No permissions found for lead module
          console.log('[create-lead] No lead module permission found. Available modules:', 
            data.data.permissions?.map(p => p.module) || []
          );
          // If no permissions are set up at all, allow access (backward compatibility)
          // Otherwise, deny access
          const hasAnyPermissions = data.data.permissions && data.data.permissions.length > 0;
          setPermissions({
            canCreate: !hasAnyPermissions, // Allow if no permissions set up
            canUpdate: !hasAnyPermissions,
            canDelete: !hasAnyPermissions,
            canRead: !hasAnyPermissions, // Allow if no permissions set up
            canAssign: !hasAnyPermissions,
          });
        }
      } else {
        // API failed, default to false
        setPermissions({
          canCreate: false,
          canUpdate: false,
          canDelete: false,
          canRead: false,
          canAssign: false,
        });
      }
      setPermissionsLoaded(true);
      } catch (err) {
      console.error("Error fetching permissions:", err);
      // On error, default to false
      setPermissions({
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        canRead: false,
        canAssign: false,
      });
      setPermissionsLoaded(true);
    }
  };

  const fetchLeads = async () => {
    if (!token) return;
    
    // Wait for permissions to load
    if (!permissionsLoaded) return;
    
    // Check if user has read permission
    if (permissions.canRead === false) {
      setLeads([]);
      return;
    }

    try {
      const res = await axios.get("/api/lead-ms/leadFilter", {
        params: filters,
          headers: { Authorization: `Bearer ${token}` },
        });
      if (res.data.success) {
        setLeads(res.data.leads || []);
      } else {
        // If permission denied, clear leads
        if (res.data.message && res.data.message.includes("permission")) {
          setLeads([]);
        }
      }
    } catch (err) {
      console.error("Error fetching leads:", err);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await axios.get("/api/lead-ms/getA", {
          headers: { Authorization: `Bearer ${token}` },
        });
      if (res.data.success) {
        setAgents(res.data.agents || []);
      }
      } catch (err) {
      console.error("Error fetching agents:", err);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [token]);

  useEffect(() => {
    // Fetch leads and agents after permissions are loaded
    if (permissionsLoaded) {
      fetchLeads();
      fetchAgents();
    }
  }, [permissionsLoaded, permissions.canRead, filters]);

  const assignLead = async () => {
    if (!selectedLead || !selectedAgent) {
      alert("Please select an agent");
      return;
    }
    
    // Check permission
    if (!permissions.canAssign) {
      alert("You do not have permission to assign leads");
      return;
    }

    try {
      await axios.post(
        "/api/lead-ms/reassign-lead",
        {
          leadId: selectedLead,
          agentIds: [selectedAgent],
          followUpDate: followUpDate
            ? new Date(followUpDate).toISOString()
            : null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Lead assigned!");
      setSelectedLead(null);
      setSelectedAgent("");
      setFollowUpDate("");
      fetchLeads();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Error assigning lead");
    }
  };

  const deleteLead = async (leadId) => {
    // Check permission
    if (!permissions.canDelete) {
      alert("You do not have permission to delete leads");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this lead?")) return;
    try {
      await axios.delete("/api/lead-ms/lead-delete", {
        headers: { Authorization: `Bearer ${token}` },
        data: { leadId },
      });
      alert("Lead deleted");
      fetchLeads();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Error deleting lead");
    }
  };

  return (
    <div className="min-h-screen p-5 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-gray-200 p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Leads Management</h1>
              <p className="text-xs text-gray-500">Filter, review, and assign leads to your team</p>
            </div>
            {permissions.canCreate && (
              <button
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-4 py-2 rounded-md shadow hover:shadow-md transition-all duration-200 text-xs font-medium"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Create New Lead</span>
              </button>
            )}
            </div>
          </div>

        {/* Filters */}
        <div className="bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-gray-200 p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            placeholder="Name"
            value={filters.name}
            onChange={(e) => setFilters({ ...filters, name: e.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
          <input
            placeholder="Offer Tag"
            value={filters.offer}
            onChange={(e) => setFilters({ ...filters, offer: e.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
          <select
            value={filters.source}
            onChange={(e) => setFilters({ ...filters, source: e.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">All Sources</option>
            <option>Instagram</option>
            <option>Facebook</option>
            <option>Google</option>
            <option>WhatsApp</option>
            <option>Walk-in</option>
            <option>Other</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">All Status</option>
            <option>New</option>
            <option>Contacted</option>
            <option>Booked</option>
            <option>Visited</option>
            <option>Follow-up</option>
            <option>Not Interested</option>
            <option>Other</option>
            </select>

                    <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
                            <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
          <button
            onClick={fetchLeads}
            className="inline-flex items-center justify-center bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow"
          >
            Apply Filters
          </button>
          </div>

        {/* Leads as Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {leads.length > 0 ? (
            leads.map((lead) => (
              <div key={lead._id} className="bg-white/90 backdrop-blur rounded-xl shadow border border-gray-200 p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
            <div>
                    <p className="text-sm font-semibold text-gray-900">{lead.name || 'Unnamed'}</p>
                    <p className="text-xs text-gray-600">{lead.phone}</p>
            </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${lead.status === 'Booked' || lead.status === 'Visited' ? 'bg-green-100 text-green-700' : lead.status === 'Not Interested' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{lead.status || '—'}</span>
          </div>

                <div className="text-[11px] text-gray-700 space-y-1">
                  <p className="truncate"><span className="text-gray-500">Treatment:</span> {lead.treatments?.map((t) => (t.subTreatment ? `${t.subTreatment} (${t.treatment?.name || 'Unknown'})` : t.treatment?.name)).join(', ') || '—'}</p>
                  <p><span className="text-gray-500">Source:</span> <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700">{lead.source || '—'}</span></p>
                  <p className="truncate"><span className="text-gray-500">Offer:</span> {lead.offerTag || '—'}</p>
                  <p className="truncate"><span className="text-gray-500">Notes:</span> {lead.notes?.map((n) => n.text).join(', ') || 'No Notes'}</p>
                  <p className="truncate"><span className="text-gray-500">Assigned:</span> {lead.assignedTo?.map((a) => a.user?.name).join(', ') || 'Not Assigned'}</p>
                  <p className="truncate"><span className="text-gray-500">Follow-ups:</span> {lead.followUps?.map((f) => new Date(f.date).toLocaleString()).join(', ') || 'None'}</p>
          </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setViewLead(lead)}
                    className="inline-flex items-center justify-center bg-white border border-gray-300 text-gray-800 px-3 py-1.5 rounded-md text-xs font-medium shadow-sm hover:bg-gray-50"
                  >
                    View
                  </button>
                  {permissions.canAssign && (
                    <button
                      onClick={() => setSelectedLead(lead._id)}
                      className="inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md text-xs font-medium shadow"
                    >
                      ReAssign
                    </button>
                  )}
                  {permissions.canDelete && (
                    <button
                      onClick={() => deleteLead(lead._id)}
                      className="inline-flex items-center justify-center bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-xs font-medium shadow"
                    >
                      Delete
                    </button>
            )}
          </div>
            </div>
            ))
          ) : (
            <div className="col-span-full bg-white/90 backdrop-blur rounded-xl border border-gray-200 p-6 text-center text-gray-500">
              {permissions.canRead === false ? "You do not have permission to view leads" : "No leads found"}
              </div>
            )}
          </div>

        {/* Create Lead Modal */}
        <CreateLeadModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            fetchLeads();
            setModalOpen(false);
          }}
          token={token || ""}
        />

        {/* Assign Modal */}
        {selectedLead && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform transition-all">
              <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-teal-50 to-emerald-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Reassign Lead</h2>
                    <p className="text-xs text-gray-600 mt-0.5">Select an agent and set follow-up time</p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Select Agent
                    <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedAgent}
                      onChange={(e) => setSelectedAgent(e.target.value)}
                      className="w-full appearance-none rounded-xl border-2 border-gray-200 bg-white px-4 py-3.5 pr-10 text-sm font-medium text-gray-900 transition-all duration-200 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-100 hover:border-gray-300 cursor-pointer"
                    >
                      <option value="" disabled className="text-gray-400">Choose an agent...</option>
                      {agents.map((a) => (
                        <option key={a._id} value={a._id} className="py-2">
                          {a.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {selectedAgent && (
                    <p className="mt-2 text-xs text-teal-600 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Agent selected: {agents.find(a => a._id === selectedAgent)?.name}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Follow-up Date & Time
                    <span className="text-xs text-gray-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3.5 text-sm font-medium text-gray-900 transition-all duration-200 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-100 hover:border-gray-300"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => {
                      setSelectedLead(null);
                      setSelectedAgent("");
                      setFollowUpDate("");
                    }}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={assignLead}
                    disabled={!selectedAgent}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg shadow-teal-500/30 hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-teal-100 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    ReAssign Lead
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {viewLead && (
          <LeadViewModal lead={viewLead} onClose={() => setViewLead(null)} />
        )}
      </div>
    </div>
  );
}

// Wrap page in ClinicLayout
LeadsPage.getLayout = (page) => <ClinicLayout>{page}</ClinicLayout>;

export const CreateLeadPageBase = LeadsPage;

// Preserve layout on wrapped component
const ProtectedLeadsPage = withClinicAuth(LeadsPage);
ProtectedLeadsPage.getLayout = LeadsPage.getLayout;

export default ProtectedLeadsPage;
