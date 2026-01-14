import ClinicLayout from "@/components/ClinicLayout";
import withClinicAuth from "@/components/withClinicAuth";
import React, { ReactElement, useCallback, useEffect, useState } from "react";
import { NextPageWithLayout } from "../_app";
import {
  Search,
  Plus,
  Mail,
  MessageSquare,
  Check,
  X,
  Clock,
  Edit2,
  Trash2,
  Eye,
  FileText,
  Grid,
  List,
  RefreshCcw,
} from "lucide-react";
import axios from "axios";
import { Template } from "@/types/templates";
import Link from "next/link";
import { FaWhatsapp } from "react-icons/fa";
import DeleteTemplateModal from "./_components/DeleteTemplateModal";
import { useRouter } from "next/router";

const TemplatesPage: NextPageWithLayout = () => {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [permissions, _setPermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canRead: false,
    canAssign: false,
  });
  // const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalTemplates, setTotalTemplates] = useState<number>(0);
  const [_loading, setLoading] = useState<boolean>(false);
  const [showDeleteTemplateModal, setShowDeleteTemplateModal] =
    useState<boolean>(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );
  const [deleteTemplateLoading, setDeleteTemplateLoading] =
    useState<boolean>(false);
  // Preview modal state
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  const templatesPerPage = 10;
  const token =
    typeof window !== "undefined" ? localStorage.getItem("clinicToken") : null;

  const fetchTemplates = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await axios.get("/api/all-templates", {
        params: {
          page: currentPage,
          limit: templatesPerPage,
          search: searchQuery,
          statuses: JSON.stringify(
            filterStatus === "all" ? [] : [filterStatus]
          ),
          types: JSON.stringify(filterType === "all" ? [] : [filterType]),
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res?.data?.success) {
        setTemplates(res?.data?.templates || []);
        setTotalPages(res?.data?.pagination?.totalPages || 1);
        setTotalTemplates(res?.data?.pagination?.totalResults || 0);
      } else {
        // If permission denied, clear templates
        if (res.data?.message && res.data?.message.includes("permission")) {
          setTemplates([]);
        }
      }
    } catch (error) {
      console.log("Error fetching templates: ", error);
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    filterStatus,
    filterType,
    searchQuery,
    token,
    templatesPerPage,
  ]);

  const handleSyncTemplates = async () => {
    if (!token) return;
    try {
      setIsSyncing(true);
      const res = await axios.post(
        "/api/all-templates/sync-templates",
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res?.data?.success) {
        fetchTemplates();
      }
    } catch (error) {
      console.log("Error syncing templates: ", error);
    }
  };

  // Get template type icon
  const getTemplateTypeIcon = (type: string) => {
    switch (type) {
      case "whatsapp":
        return <FaWhatsapp className="h-4 w-4 text-green-600" />;
      case "email":
        return <Mail className="h-4 w-4 text-red-500" />;
      case "sms":
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const config: Record<
      string,
      { color: string; bg: string; icon: React.ReactNode }
    > = {
      approved: {
        color: "text-green-700",
        bg: "bg-green-50 border-green-100",
        icon: <Check className="h-3 w-3" />,
      },
      active: {
        color: "text-blue-700",
        bg: "bg-blue-50 border-blue-100",
        icon: <Check className="h-3 w-3" />,
      },
      pending: {
        color: "text-yellow-700",
        bg: "bg-yellow-50 border-yellow-100",
        icon: <Clock className="h-3 w-3" />,
      },
      inactive: {
        color: "text-gray-700",
        bg: "bg-gray-50 border-gray-100",
        icon: <X className="h-3 w-3" />,
      },
      rejected: {
        color: "text-red-700",
        bg: "bg-red-50 border-red-100",
        icon: <X className="h-3 w-3" />,
      },
    };

    const { color, bg, icon } = config[status] || {
      color: "text-gray-700",
      bg: "bg-gray-50",
      icon: <FileText className="h-3 w-3" />,
    };

    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${bg} ${color}`}
      >
        {icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Get category badge
  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      Healthcare: "bg-purple-50 text-purple-700 border-purple-100",
      Onboarding: "bg-blue-50 text-blue-700 border-blue-100",
      Billing: "bg-rose-50 text-rose-700 border-rose-100",
      Feedback: "bg-amber-50 text-amber-700 border-amber-100",
      Pharmacy: "bg-emerald-50 text-emerald-700 border-emerald-100",
      Administrative: "bg-gray-50 text-gray-700 border-gray-100",
    };

    return (
      <span
        className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
          colors[category] || "bg-gray-50 text-gray-700"
        }`}
      >
        {category}
      </span>
    );
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Handle template actions
  const handleTemplateAction = (action: string, templateId: string) => {
    console.log(`${action} template ${templateId}`);
    // Implement actual actions here
    if (action === "edit") {
      router.push(`/all-templates/${templateId}`);
      return;
    }

    if (action === "preview") {
      const tmpl = templates.find((t) => t._id === templateId) || null;
      if (tmpl) {
        setPreviewTemplate(tmpl);
        setShowPreviewModal(true);
      }
      return;
    }
  };

  // Replace variables in content with sample values for preview
  const fillSampleValues = (content: string, template: Template) => {
    if (!content) return "";
    let result = content;
    (template.variables || []).forEach((v, idx) => {
      const sample = template.bodyVariableSampleValues?.[idx] || ``;
      const regex = new RegExp(`{{\\s*${v}\\s*}}`, "g");
      result = result.replace(regex, sample);
    });
    return result;
  };

  const renderPreviewBody = (template: Template) => {
    const filled = fillSampleValues(template.content || "", template);

    if (template.templateType === "email") {
      return (
        <div className="border rounded-lg overflow-hidden shadow-sm bg-white">
          {template.headerFileUrl ? (
            <img
              src={template.headerFileUrl}
              alt="header"
              className="w-full h-40 object-cover"
            />
          ) : (
            <div className="w-full h-12 bg-gray-50 flex items-center justify-center text-sm text-gray-500">
              {template.headerText || ""}
            </div>
          )}
          <div className="p-6">
            <h4 className="text-sm text-gray-500 mb-1">{template.subject}</h4>
            <p className="text-xs text-gray-400 mb-3">{template.preheader}</p>
            <div className="prose max-w-none text-sm text-gray-700 whitespace-pre-wrap">
              {filled}
            </div>
          </div>
          {template.footer && (
            <div className="p-4 bg-gray-50 text-xs text-gray-500">
              {template.footer}
            </div>
          )}
        </div>
      );
    }

    // WhatsApp / SMS style bubble
    return (
      <div className="p-4">
        <div className="max-w-md">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <div className="text-sm text-gray-800 whitespace-pre-wrap">
              {filled}
            </div>
            {template.templateButtons &&
              template.templateButtons.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {template.templateButtons.map((b, i) => (
                    <button
                      key={i}
                      className="px-3 py-1.5 bg-gray-800 text-white text-xs rounded"
                    >
                      {b.text || b.type}
                    </button>
                  ))}
                </div>
              )}
          </div>
        </div>
      </div>
    );
  };

  const handleDeleteTemplate = async (templateId: string | undefined) => {
    if (!token || !templateId) return;
    try {
      setDeleteTemplateLoading(true);
      const res = await axios.delete(
        `/api/all-templates/delete-template/${templateId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res?.data?.success) {
        const filteredTemplates = templates.filter((t) => t._id !== templateId);
        setTemplates(filteredTemplates);
        setShowDeleteTemplateModal(false);
      }
    } catch (error) {
      console.log("Error deleting template: ", error);
    } finally {
      setDeleteTemplateLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [
    currentPage,
    filterStatus,
    filterType,
    searchQuery,
    token,
    templatesPerPage,
  ]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Templates
            </h1>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600">
              Manage your communication templates
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncTemplates}
              className={`inline-flex items-center justify-center cursor-pointer gap-1.5 ${
                !isSyncing ? "bg-white" : "bg-gray-200"
              } border border-gray-200 hover:bg-gray-100 text-gray-600 px-3 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-xs sm:text-sm font-medium`}
            >
              <RefreshCcw className="h-5 w-5" />
              {!isSyncing ? "Sync Templates" : "Syncing..."}
            </button>
            <Link href="/all-templates/new">
              <button className="inline-flex items-center justify-center cursor-pointer gap-1.5 bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-xs sm:text-sm font-medium">
                <Plus className="h-5 w-5" />
                Create Template
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Templates</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {templates.length}
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approved Templates</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {templates.filter((t) => t.status === "approved").length}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <Check className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Approval</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {templates.filter((t) => t.status === "pending").length}
              </p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">WhatsApp Templates</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {templates.filter((t) => t.templateType === "whatsapp").length}
              </p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <MessageSquare className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search templates by name, category, or content..."
              className="w-full pl-10 pr-4 py-2.5 text-gray-500 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 text-gray-600 bg-gray-50 p-1 rounded-lg">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded ${
                viewMode === "grid" ? "bg-white shadow" : "hover:bg-gray-100"
              }`}
            >
              <Grid className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded ${
                viewMode === "list" ? "bg-white shadow" : "hover:bg-gray-100"
              }`}
            >
              <List className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-4">
          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              className="bg-white border border-gray-300 text-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              className="bg-white border border-gray-300 text-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="approved">Approved</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Templates Grid/List */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
          {templates?.map((template) => (
            <div
              key={template._id}
              className="flex flex-col justify-between bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div>
                {/* Template Header */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-gray-100 text-gray-500 border border-gray-200 rounded-lg">
                        {getTemplateTypeIcon(template.templateType)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800 truncate">
                          {template.name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          ID: {template.templateId || "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {getStatusBadge(template.status)}
                    </div>
                  </div>

                  {/* Category and Language */}
                  <div className="flex items-center gap-2 mt-3">
                    {template.category && getCategoryBadge(template.category)}
                    <span className="text-xs text-gray-500 px-2 py-1 bg-gray-50 rounded">
                      {template.language.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Template Content Preview */}
                <div className="p-4">
                  <p className="text-sm text-gray-600 line-clamp-3 mb-3">
                    {template.content}
                  </p>

                  {/* Variables */}
                  {template.variables.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs text-gray-500 mb-1">
                        Variables
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {template.variables.slice(0, 3).map((variable, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                          >
                            {variable}
                          </span>
                        ))}
                        {template.variables.length > 3 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded">
                            +{template.variables.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Buttons */}
                  {template.templateButtons.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs text-gray-500 mb-1">
                        Buttons ({template.templateButtons.length})
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {template.templateButtons
                          .slice(0, 2)
                          .map((btn, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-gray-800 text-white text-xs rounded"
                            >
                              {btn.type.split("_").join(" ")}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Template Footer */}
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-500">
                    Updated {formatDate(template.updatedAt)}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTemplateAction("edit", template._id)}
                      className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() =>
                        handleTemplateAction("preview", template._id)
                      }
                      className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                      title="Preview"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedTemplate(template);
                        setShowDeleteTemplateModal(true);
                      }}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Template
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Updated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {templates?.map((template) => (
                <tr key={template._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 text-gray-500 rounded-lg">
                        {getTemplateTypeIcon(template.templateType)}
                      </div>
                      <div>
                        <div className="text-base font-medium text-gray-800">
                          {template.name}
                        </div>
                        <div className="text-sm text-gray-500 mt-1 line-clamp-1 max-w-md">
                          {template.content}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="capitalize text-sm text-gray-700">
                        {template.templateType}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {getCategoryBadge(template.category || "N/A")}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {getStatusBadge(template.status)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(template.updatedAt)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleTemplateAction("preview", template._id)
                        }
                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() =>
                          handleTemplateAction("edit", template._id)
                        }
                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() =>
                          handleTemplateAction("delete", template._id)
                        }
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {templates?.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">
            No templates found
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            {searchQuery || filterType !== "all" || filterStatus !== "all"
              ? "Try adjusting your search or filters to find what you're looking for."
              : "Get started by creating your first communication template."}
          </p>
          <Link href="/all-templates/new">
            <button className="inline-flex items-center justify-center cursor-pointer gap-1.5 bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-xs sm:text-sm font-medium">
              <Plus className="h-5 w-5" />
              Create Template
            </button>
          </Link>
        </div>
      )}

      {/* Pagination */}
      {permissions.canRead && totalPages > 1 && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing {(currentPage - 1) * templatesPerPage + 1}-
            {currentPage * templatesPerPage} of {totalTemplates} lead
            {totalTemplates === 1 ? "" : "s"}
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
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages}
              className="rounded-lg border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Delete Segment Modal */}
      {/* Preview Modal */}
      {showPreviewModal && previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowPreviewModal(false)}
          />
          <div className="relative z-10 w-full max-w-5xl mx-4">
            <div className="bg-white rounded-xl shadow-xl overflow-hidden max-h-[90vh]">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    {getTemplateTypeIcon(previewTemplate.templateType)}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {previewTemplate.name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {previewTemplate.uniqueName || previewTemplate.templateId}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="text-sm text-gray-600 px-3 py-1 rounded hover:bg-gray-100"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  {renderPreviewBody(previewTemplate)}
                </div>

                <div className="lg:col-span-1 border-l pl-4">
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-1">Status</div>
                    {getStatusBadge(previewTemplate.status)}
                  </div>

                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-1">Category</div>
                    {previewTemplate.category &&
                      getCategoryBadge(previewTemplate.category)}
                  </div>

                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-1">Language</div>
                    <div className="text-sm text-gray-700">
                      {previewTemplate.language.toUpperCase()}
                    </div>
                  </div>

                  {previewTemplate.variables &&
                    previewTemplate.variables.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-gray-500 mb-1">
                          Variables
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {previewTemplate.variables.map((v, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {previewTemplate.templateButtons &&
                    previewTemplate.templateButtons.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-gray-500 mb-1">
                          Buttons
                        </div>
                        <div className="flex flex-col gap-2">
                          {previewTemplate.templateButtons.map((b, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-sm"
                            >
                              <div className="text-gray-700">
                                {b.text || b.type}
                              </div>
                              <div className="text-xs text-gray-400">
                                {b.type}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <DeleteTemplateModal
        isOpen={showDeleteTemplateModal}
        onClose={() => setShowDeleteTemplateModal(false)}
        onConfirm={() => handleDeleteTemplate(selectedTemplate?._id)}
        usageCount={2}
        loading={deleteTemplateLoading}
      />
    </div>
  );
};

// ✅ Correctly typed getLayout
TemplatesPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

// ✅ Wrap page with auth HOC
const ProtectedTemplatesPage = withClinicAuth(
  TemplatesPage
) as NextPageWithLayout;

// ✅ Re-attach layout
ProtectedTemplatesPage.getLayout = TemplatesPage.getLayout;

export default ProtectedTemplatesPage;
