import { useState, useEffect } from "react";
import axios from "axios";
import ClinicLayout from '../../components/ClinicLayout';
import withClinicAuth from '../../components/withClinicAuth';
import CreateLeadModal from '../../components/CreateLeadModal';
import LeadViewModal from '../../components/LeadViewModal';
import { PlusCircle } from "lucide-react";
import ImportLeadsModal from "@/components/ImportLeadsModal";

function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [agents, setAgents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
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

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1)
  const [totalLeads, setTotalLeads] = useState(0)
  const leadsPerPage = 9;

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
        // Find "create_lead" module permission (not submodule)
        const modulePermission = data.data.permissions?.find(
          (p) => {
            const moduleKey = p.module || "";
            // Check for "create_lead" module (with or without prefix)
            const normalizedModule = moduleKey.replace(/^(admin|clinic|doctor|agent)_/, "");
            return normalizedModule === "create_lead" || moduleKey === "create_lead" ||
              moduleKey === "clinic_create_lead" || moduleKey === "doctor_create_lead";
          }
        );

        if (modulePermission) {
          const actions = modulePermission.actions || {};
          console.log('[create-lead] Module permission found:', {
            module: modulePermission.module,
            actions: actions,
          });

          // Helper function to check if a permission value is true (handles boolean and string)
          const isTrue = (value) => {
            if (value === true) return true;
            if (value === "true") return true;
            if (String(value).toLowerCase() === "true") return true;
            return false;
          };

          // Module-level permissions - check each action independently
          // If user only has "create", they can ONLY create, not read/update/delete
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

          // CRUD permissions based on module-level actions
          // If "all" is true, grant everything
          // Otherwise, check each action independently
          setPermissions({
            // Create: Module "all" OR module "create"
            canCreate: moduleAll || moduleCreate,
            // Update: Module "all" OR module "update" (independent of create)
            canUpdate: moduleAll || moduleUpdate,
            // Delete: Module "all" OR module "delete" (independent of create)
            canDelete: moduleAll || moduleDelete,
            // Read: Module "all" OR module "read" (independent of create)
            canRead: moduleAll || moduleRead,
            // Assign: Module "all" OR module "update" (assigning is an update operation)
            canAssign: moduleAll || moduleUpdate,
          });
        } else {
          // No permissions found for create_lead module
          console.log('[create-lead] No create_lead module permission found. Available modules:',
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
        params: { ...filters, page: currentPage, limit: leadsPerPage },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setLeads(res.data.leads || []);
        setTotalPages(res?.data?.pagination?.totalPages || 1)
        setTotalLeads(res?.data?.pagination?.totalLeads || 0)
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
  }, [permissionsLoaded, permissions.canRead, filters, currentPage]);

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
    <div className="min-h-screen p-3 sm:p-4 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Compact Header */}
        <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Leads Management</h1>
              <p className="text-[10px] sm:text-xs text-gray-500">Filter, review, and assign leads to your team</p>
            </div>
            <div className="flex items-center gap-2.5">
              {permissions.canCreate && (
                <button
                  onClick={() => setModalOpen(true)}
                  className="inline-flex items-center justify-center cursor-pointer gap-1.5 border border-gray-800 text-gray-800 bg-transparent hover:bg-gray-800 hover:text-white px-3 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-xs sm:text-sm font-medium"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Create New Lead</span>
                </button>
              )}

              {permissions.canCreate && (
                <button
                  onClick={() => setImportModalOpen(true)}
                  className="inline-flex items-center justify-center cursor-pointer gap-1.5 bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-xs sm:text-sm font-medium"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Import New Lead</span>
                </button>
              )}
            </div>

          </div>
        </div>

        {/* Compact Filters - Only show if user has read permission */}
        {permissions.canRead && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 mb-3 grid grid-cols-1 md:grid-cols-4 gap-2 sm:gap-3">
            <input
              placeholder="Name"
              value={filters.name}
              onChange={(e) => setFilters({ ...filters, name: e.target.value })}
              className="w-full rounded-lg border border-gray-200 bg-white p-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800"
            />
            <input
              placeholder="Offer Tag"
              value={filters.offer}
              onChange={(e) => setFilters({ ...filters, offer: e.target.value })}
              className="w-full rounded-lg border border-gray-200 bg-white p-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800"
            />
            <select
              value={filters.source}
              onChange={(e) => setFilters({ ...filters, source: e.target.value })}
              className="w-full rounded-lg border border-gray-200 bg-white p-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800"
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
              className="w-full rounded-lg border border-gray-200 bg-white p-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800"
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
              className="w-full rounded-lg border border-gray-200 bg-white p-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800"
            />
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full rounded-lg border border-gray-200 bg-white p-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800"
            />
            <button
              onClick={fetchLeads}
              className="inline-flex items-center justify-center bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-medium shadow-sm hover:shadow-md transition-all"
            >
              Apply Filters
            </button>
          </div>
        )}

        {/* Compact Leads Cards - Only show if user has read permission */}
        {permissions.canRead ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {leads.length > 0 ? (
              leads.map((lead) => (
                <div key={lead._id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900 truncate">{lead.name || 'Unnamed'}</p>
                      <p className="text-xs text-gray-600 truncate">{lead.phone}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${lead.status === 'Booked' || lead.status === 'Visited' ? 'bg-green-100 text-green-700' : lead.status === 'Not Interested' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{lead.status || '—'}</span>
                  </div>

                  <div className="text-[10px] sm:text-xs text-gray-700 space-y-1">
                    <p className="truncate"><span className="text-gray-500">Treatment:</span> {lead.treatments?.map((t) => (t.subTreatment ? `${t.subTreatment} (${t.treatment?.name || 'Unknown'})` : t.treatment?.name)).join(', ') || '—'}</p>
                    <p><span className="text-gray-500">Source:</span> <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 text-[10px]">{lead.source || '—'}</span></p>
                    <p className="truncate"><span className="text-gray-500">Offer:</span> {lead.offerTag || '—'}</p>
                    <p className="truncate"><span className="text-gray-500">Notes:</span> {lead.notes?.map((n) => n.text).join(', ') || 'No Notes'}</p>
                    <p className="truncate"><span className="text-gray-500">Assigned:</span> {lead.assignedTo?.map((a) => a.user?.name).join(', ') || 'Not Assigned'}</p>
                    <p className="truncate"><span className="text-gray-500">Follow-ups:</span> {lead.followUps?.map((f) => new Date(f.date).toLocaleString()).join(', ') || 'None'}</p>
                  </div>

                  <div className="flex justify-end gap-1.5 pt-1 border-t border-gray-100">
                    <button
                      onClick={() => setViewLead(lead)}
                      className="inline-flex items-center justify-center cursor-pointer bg-white border border-gray-200 text-gray-800 px-2.5 py-1.5 rounded-md text-[10px] sm:text-xs font-medium shadow-sm hover:bg-gray-50 transition-all"
                    >
                      View
                    </button>
                    {permissions.canAssign && (
                      <button
                        onClick={() => setSelectedLead(lead._id)}
                        className="inline-flex items-center justify-center cursor-pointer bg-gray-800 hover:bg-gray-900 text-white px-2.5 py-1.5 rounded-md text-[10px] sm:text-xs font-medium shadow-sm hover:shadow-md transition-all"
                      >
                        ReAssign
                      </button>
                    )}
                    {permissions.canDelete && (
                      <button
                        onClick={() => deleteLead(lead._id)}
                        className="inline-flex items-center justify-center cursor-pointer bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-md text-[10px] sm:text-xs font-medium shadow-sm hover:shadow-md transition-all"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full bg-white rounded-lg border border-gray-200 p-6 text-center">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600">No leads found</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-8 sm:p-12 text-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Read Permission Required</h3>
            <p className="text-sm text-gray-600 mb-3">
              You only have permission to create leads. You cannot view, update, or delete leads.
            </p>
            <p className="text-xs text-gray-500">
              Contact your administrator to request read permissions for the Create Lead module.
            </p>
          </div>
        )}

        {/* Pagination */}

        {permissions.canRead &&
          totalPages > 1 && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing {(currentPage - 1) * leadsPerPage + 1}-{currentPage * leadsPerPage} of {totalLeads} lead{totalLeads === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}

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

        <ImportLeadsModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImported={() => {
            fetchLeads();
            setImportModalOpen(false);
          }}
          token={token || ""}
        />

        {/* Compact Assign Modal */}
        {selectedLead && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md transform transition-all">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-gray-900">Reassign Lead</h2>
                    <p className="text-[10px] sm:text-xs text-gray-600 mt-0.5">Select an agent and set follow-up time</p>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Select Agent
                    <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedAgent}
                      onChange={(e) => setSelectedAgent(e.target.value)}
                      className="w-full appearance-none rounded-lg border-2 border-gray-200 bg-white px-3 py-2.5 pr-8 text-xs sm:text-sm font-medium text-gray-900 transition-all duration-200 focus:border-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-800/20 hover:border-gray-300 cursor-pointer"
                    >
                      <option value="" disabled className="text-gray-400">Choose an agent...</option>
                      {agents.map((a) => (
                        <option key={a._id} value={a._id} className="py-2">
                          {a.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {selectedAgent && (
                    <p className="mt-1.5 text-[10px] sm:text-xs text-gray-700 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Agent selected: {agents.find(a => a._id === selectedAgent)?.name}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Follow-up Date & Time
                    <span className="text-[10px] text-gray-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2.5 text-xs sm:text-sm font-medium text-gray-900 transition-all duration-200 focus:border-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-800/20 hover:border-gray-300"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => {
                      setSelectedLead(null);
                      setSelectedAgent("");
                      setFollowUpDate("");
                    }}
                    className="px-4 py-2 rounded-lg text-xs sm:text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={assignLead}
                    disabled={!selectedAgent}
                    className="px-4 py-2 rounded-lg text-xs sm:text-sm font-medium bg-gray-800 text-white shadow-sm hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-800/20 flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

// Wrap page in ClinicLayout for persistent layout
// When getLayout is used, Next.js keeps the layout mounted and only swaps page content
// This prevents sidebar and header from re-rendering on navigation
LeadsPage.getLayout = function PageLayout(page) {
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

export const CreateLeadPageBase = LeadsPage;

// Preserve layout on wrapped component
const ProtectedLeadsPage = withClinicAuth(LeadsPage);
ProtectedLeadsPage.getLayout = LeadsPage.getLayout;

export default ProtectedLeadsPage;
