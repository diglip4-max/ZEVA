import React, { JSX, ReactElement, useState } from "react";
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  Pause,
  RotateCw,
  SkipForward,
  Ban,
  Calendar,
  Filter,
  Search,
  Download,
  RefreshCw,
  Eye,
  FileText,
  Copy,
  Archive,
} from "lucide-react";
import { NextPageWithLayout } from "@/pages/_app";
import ClinicLayout from "@/components/ClinicLayout";
import withClinicAuth from "@/components/withClinicAuth";

// Type definitions based on the Mongoose schema
type WorkflowStatus =
  | "pending"
  | "in-progress"
  | "completed"
  | "failed"
  | "waiting"
  | "skipped"
  | "canceled"
  | "retrying";

interface WorkflowHistoryItem {
  _id: string;
  workflowId: {
    _id: string;
    name: string;
  };
  triggerId: {
    _id: string;
    name: string;
  };
  actionId: {
    _id: string;
    name: string;
  };
  conditionId: {
    _id: string;
    name: string;
  };
  conditionResult: boolean | null;
  status: WorkflowStatus;
  executedAt: string | null;
  error: string | null;
  details: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
}

const WorkflowHistoryPage: NextPageWithLayout = () => {
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Sample workflow history data based on the schema
  const workflowHistoryData: WorkflowHistoryItem[] = [
    {
      _id: "1",
      workflowId: { _id: "wf1", name: "Lead Generation Pipeline" },
      triggerId: { _id: "tr1", name: "New Lead Created" },
      actionId: { _id: "ac1", name: "Send Welcome Email" },
      conditionId: { _id: "co1", name: "Lead Score > 50" },
      conditionResult: true,
      status: "completed",
      executedAt: "2024-01-15T10:30:00Z",
      error: null,
      details: {
        emailSent: true,
        recipient: "john@example.com",
        template: "welcome-email-v2",
        leadScore: 85,
      },
      createdAt: "2024-01-15T10:30:00Z",
      updatedAt: "2024-01-15T10:30:05Z",
    },
    {
      _id: "2",
      workflowId: { _id: "wf2", name: "Customer Onboarding" },
      triggerId: { _id: "tr2", name: "User Signed Up" },
      actionId: { _id: "ac2", name: "Create Slack Channel" },
      conditionId: { _id: "co2", name: "User Type: Enterprise" },
      conditionResult: false,
      status: "skipped",
      executedAt: "2024-01-15T09:15:00Z",
      error: null,
      details: {
        reason: "Condition not met",
        userType: "free",
        channelName: null,
      },
      createdAt: "2024-01-15T09:15:00Z",
      updatedAt: "2024-01-15T09:15:02Z",
    },
    {
      _id: "3",
      workflowId: { _id: "wf3", name: "Data Sync Process" },
      triggerId: { _id: "tr3", name: "Scheduled: Daily Sync" },
      actionId: { _id: "ac3", name: "Sync Salesforce Data" },
      conditionId: { _id: "co3", name: "API Available" },
      conditionResult: true,
      status: "failed",
      executedAt: "2024-01-15T08:00:00Z",
      error: "Salesforce API timeout after 30 seconds",
      details: {
        recordsProcessed: 0,
        errorCode: "TIMEOUT_001",
        retryCount: 2,
      },
      createdAt: "2024-01-15T08:00:00Z",
      updatedAt: "2024-01-15T08:00:35Z",
    },
    {
      _id: "4",
      workflowId: { _id: "wf1", name: "Lead Generation Pipeline" },
      triggerId: { _id: "tr4", name: "Lead Updated" },
      actionId: { _id: "ac4", name: "Update CRM" },
      conditionId: { _id: "co4", name: "Valid Email" },
      conditionResult: true,
      status: "in-progress",
      executedAt: "2024-01-15T11:45:00Z",
      error: null,
      details: {
        progress: 45,
        currentStep: "Validating data",
      },
      createdAt: "2024-01-15T11:45:00Z",
      updatedAt: "2024-01-15T11:45:30Z",
    },
    {
      _id: "5",
      workflowId: { _id: "wf4", name: "Invoice Processing" },
      triggerId: { _id: "tr5", name: "New Invoice" },
      actionId: { _id: "ac5", name: "Process Payment" },
      conditionId: { _id: "co5", name: "Amount < $5000" },
      conditionResult: true,
      status: "waiting",
      executedAt: "2024-01-15T12:00:00Z",
      error: null,
      details: {
        amount: 3500,
        paymentMethod: "ACH",
        approvalRequired: false,
      },
      createdAt: "2024-01-15T12:00:00Z",
      updatedAt: "2024-01-15T12:00:00Z",
    },
    {
      _id: "6",
      workflowId: { _id: "wf5", name: "User Notification" },
      triggerId: { _id: "tr6", name: "System Alert" },
      actionId: { _id: "ac6", name: "Send Push Notification" },
      conditionId: { _id: "co6", name: "User Opted In" },
      conditionResult: true,
      status: "retrying",
      executedAt: "2024-01-15T13:20:00Z",
      error: "Push service temporarily unavailable",
      details: {
        retryAttempt: 3,
        nextRetryIn: "5 minutes",
        deviceToken: "xxx123",
      },
      createdAt: "2024-01-15T13:20:00Z",
      updatedAt: "2024-01-15T13:25:00Z",
    },
    {
      _id: "7",
      workflowId: { _id: "wf6", name: "Data Export" },
      triggerId: { _id: "tr7", name: "Export Requested" },
      actionId: { _id: "ac7", name: "Generate CSV" },
      conditionId: { _id: "co7", name: "Data Available" },
      conditionResult: true,
      status: "canceled",
      executedAt: "2024-01-15T14:00:00Z",
      error: "User canceled the operation",
      details: {
        canceledBy: "john.doe@company.com",
        reason: "Wrong date range",
      },
      createdAt: "2024-01-15T14:00:00Z",
      updatedAt: "2024-01-15T14:05:00Z",
    },
    {
      _id: "8",
      workflowId: { _id: "wf2", name: "Customer Onboarding" },
      triggerId: { _id: "tr2", name: "User Signed Up" },
      actionId: { _id: "ac8", name: "Assign Account Manager" },
      conditionId: { _id: "co8", name: "High Value Customer" },
      conditionResult: true,
      status: "pending",
      executedAt: null,
      error: null,
      details: {
        estimatedStartTime: "2024-01-16T09:00:00Z",
      },
      createdAt: "2024-01-15T15:00:00Z",
      updatedAt: "2024-01-15T15:00:00Z",
    },
  ];

  const getStatusIcon = (status: WorkflowStatus): JSX.Element => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "in-progress":
        return <Play className="w-5 h-5 text-blue-500" />;
      case "waiting":
        return <Pause className="w-5 h-5 text-yellow-500" />;
      case "skipped":
        return <SkipForward className="w-5 h-5 text-gray-500" />;
      case "canceled":
        return <Ban className="w-5 h-5 text-red-400" />;
      case "retrying":
        return <RotateCw className="w-5 h-5 text-orange-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: WorkflowStatus): string => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "failed":
        return "bg-red-100 text-red-800 border-red-200";
      case "in-progress":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "waiting":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "skipped":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "canceled":
        return "bg-red-50 text-red-700 border-red-100";
      case "retrying":
        return "bg-orange-100 text-orange-800 border-orange-200";
      default:
        return "bg-purple-100 text-purple-800 border-purple-200";
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "Not executed";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  const stats: Stats = {
    total: workflowHistoryData.length,
    completed: workflowHistoryData.filter((w) => w.status === "completed")
      .length,
    failed: workflowHistoryData.filter((w) => w.status === "failed").length,
    inProgress: workflowHistoryData.filter((w) => w.status === "in-progress")
      .length,
  };

  const filteredData: WorkflowHistoryItem[] = workflowHistoryData.filter(
    (item) => {
      const matchesSearch =
        item.workflowId.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.triggerId.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.actionId.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter =
        selectedFilter === "all" || item.status === selectedFilter;
      return matchesSearch && matchesFilter;
    },
  );

  const toggleSelectItem = (id: string): void => {
    setSelectedItems((prev) =>
      prev.includes(id)
        ? prev.filter((itemId) => itemId !== id)
        : [...prev, id],
    );
  };

  const toggleSelectAll = (): void => {
    if (selectedItems.length === filteredData.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredData.map((item) => item._id));
    }
  };

  const handleFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ): void => {
    setSelectedFilter(e.target.value);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(e.target.value);
  };

  const handleRefresh = (): void => {
    // Add refresh logic here
    console.log("Refresh clicked");
  };

  const handleExport = (): void => {
    // Add export logic here
    console.log("Export clicked");
  };

  const handleView = (id: string): void => {
    // Add view logic here
    console.log("View item:", id);
  };

  const handleCopy = (id: string): void => {
    // Add copy logic here
    console.log("Copy item:", id);
  };

  const handleArchive = (id: string): void => {
    // Add archive logic here
    console.log("Archive item:", id);
  };

  const getConditionResultColor = (result: boolean | null): string => {
    if (result === true) return "bg-green-100 text-green-800";
    if (result === false) return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-800";
  };

  const getConditionResultText = (result: boolean | null): string => {
    if (result === true) return "Passed";
    if (result === false) return "Failed";
    return "N/A";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Workflow History
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Track and monitor all workflow executions
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleExport}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
              <button
                onClick={handleRefresh}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-lg"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Executions
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {stats.total}
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {stats.completed}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {stats.failed}
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {stats.inProgress}
                </p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <Play className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={selectedFilter}
                onChange={handleFilterChange}
                className="text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="in-progress">In Progress</option>
                <option value="pending">Pending</option>
                <option value="waiting">Waiting</option>
                <option value="skipped">Skipped</option>
                <option value="canceled">Canceled</option>
                <option value="retrying">Retrying</option>
              </select>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search workflows..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="pl-9 pr-4 py-2 w-full border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Workflow History Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={
                        selectedItems.length === filteredData.length &&
                        filteredData.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Workflow
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trigger / Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Condition
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Executed At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((item) => (
                  <tr
                    key={item._id}
                    className={`hover:bg-gray-50 transition-colors duration-150 ${
                      selectedItems.includes(item._id) ? "bg-blue-50" : ""
                    }`}
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item._id)}
                        onChange={() => toggleSelectItem(item._id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {getStatusIcon(item.status)}
                        <span
                          className={`ml-2 px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(item.status)}`}
                        >
                          {item.status.charAt(0).toUpperCase() +
                            item.status.slice(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {item.workflowId.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {item.triggerId.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.actionId.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full ${getConditionResultColor(item.conditionResult)}`}
                        >
                          {getConditionResultText(item.conditionResult)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                        {formatDate(item.executedAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {item.error ? (
                        <div
                          className="text-xs text-red-600 max-w-xs truncate"
                          title={item.error}
                        >
                          <AlertCircle className="w-4 h-4 inline mr-1" />
                          {item.error}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">
                          {Object.keys(item.details).length > 0
                            ? "View details"
                            : "No details"}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleView(item._id)}
                          className="p-1 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                          title="View"
                        >
                          <Eye className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleCopy(item._id)}
                          className="p-1 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                          title="Copy"
                        >
                          <Copy className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleArchive(item._id)}
                          className="p-1 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                          title="Archive"
                        >
                          <Archive className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">1</span> to{" "}
                <span className="font-medium">{filteredData.length}</span> of{" "}
                <span className="font-medium">
                  {workflowHistoryData.length}
                </span>{" "}
                results
              </div>
              <div className="flex space-x-2">
                <button className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                  Previous
                </button>
                <button className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {filteredData.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No results found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your search or filter to find what you're looking
              for.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Layout configuration
WorkflowHistoryPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ClinicLayout hideSidebar={true} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

// Export protected page with auth
const ProtectedWorkflowHistoryPage = withClinicAuth(
  WorkflowHistoryPage,
) as NextPageWithLayout;
ProtectedWorkflowHistoryPage.getLayout = WorkflowHistoryPage.getLayout;

export default ProtectedWorkflowHistoryPage;
