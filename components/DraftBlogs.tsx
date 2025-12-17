import React, { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";
import { 
  Search, 
  Edit2, 
  Trash2, 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Edit3, 
  Save, 
  AlertCircle,
  Filter,
  Calendar,
  Clock,
  Grid3x3,
  List,
  SortAsc,
  SortDesc,
  MoreVertical,
  Settings
} from "lucide-react";

type Blog = {
  _id: string;
  title: string;
  content: string;
  paramlink: string;
  createdAt: string;
  updatedAt?: string;
  status?: "draft" | "published" | "scheduled" | "archived";
  scheduledDate?: string;
};

interface DraftBlogsProps {
  tokenKey: "clinicToken" | "doctorToken" | "agentToken";
  permissions?: {
    canRead?: boolean;
    canUpdate?: boolean;
    canDelete?: boolean;
  };
  searchQuery?: string;
  viewMode?: 'grid' | 'list';
  onEditBlog?: (blogId: string, type: 'published' | 'drafts') => void;
}

const ITEMS_PER_PAGE = 10;
const PRIMARY_COLOR = "#2D9AA5";

const DraftBlogs: React.FC<DraftBlogsProps> = ({ 
  onEditBlog, 
  tokenKey,
  permissions = {
    canRead: true,
    canUpdate: true,
    canDelete: true,
  },
  searchQuery = "",
  viewMode = 'grid'
}) => {
  const [drafts, setDrafts] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editParamlink, setEditParamlink] = useState<string>("");
  const [editError, setEditError] = useState<string>("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [localSearchTerm, setLocalSearchTerm] = useState<string>(searchQuery);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{id: string, title: string} | null>(null);
  
  // Filter and sort states
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSearchSettings, setShowSearchSettings] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>('all');
  const [customDateStart, setCustomDateStart] = useState<string>('');
  const [customDateEnd, setCustomDateEnd] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title-asc' | 'title-desc'>('newest');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'scheduled' | 'archived'>('all');

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem(tokenKey);
    return { headers: { Authorization: `Bearer ${token}` } };
  }, [tokenKey]);

  // Sync external searchQuery with local state
  useEffect(() => {
    setLocalSearchTerm(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    async function loadDrafts() {
      if (!permissions.canRead) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const draftRes = await axios.get("/api/blog/draft", {
          ...getAuthHeaders(),
          validateStatus: (status) => status === 200 || status === 403,
        });

        if (draftRes.status === 403) {
          setDrafts([]);
          return;
        }

        const draftsData = draftRes.data?.drafts || draftRes.data || [];
        setDrafts(Array.isArray(draftsData) ? draftsData : []);
      } catch (e: unknown) {
        if (axios.isAxiosError(e)) {
          setError(e.message || "Failed to load drafts");
        } else {
          setError("Failed to load drafts");
        }
      } finally {
        setLoading(false);
      }
    }
    loadDrafts();
  }, [tokenKey, getAuthHeaders, permissions.canRead]);

  // Combined search term (external + local)
  const effectiveSearchTerm = useMemo(() => {
    return localSearchTerm || searchQuery || "";
  }, [localSearchTerm, searchQuery]);

  // Filter and sort blogs
  const filteredAndSortedBlogs = useMemo(() => {
    let filtered = [...drafts];

    // Apply search filter
    if (effectiveSearchTerm) {
      filtered = filtered.filter(blog =>
        blog.title.toLowerCase().includes(effectiveSearchTerm.toLowerCase()) ||
        blog.paramlink.toLowerCase().includes(effectiveSearchTerm.toLowerCase()) ||
        (blog.content && blog.content.replace(/<[^>]+>/g, "").toLowerCase().includes(effectiveSearchTerm.toLowerCase()))
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(blog => blog.status === statusFilter);
    }

    // Apply date filter
    const now = new Date();
    switch (dateFilter) {
      case "today":
        filtered = filtered.filter((blog) => {
          const blogDate = new Date(blog.createdAt);
          return blogDate.toDateString() === now.toDateString();
        });
        break;
      case "week":
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(
          (blog) => new Date(blog.createdAt) >= weekAgo
        );
        break;
      case "month":
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(
          (blog) => new Date(blog.createdAt) >= monthAgo
        );
        break;
      case "year":
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(
          (blog) => new Date(blog.createdAt) >= yearAgo
        );
        break;
      case "custom":
        if (customDateStart && customDateEnd) {
          const start = new Date(customDateStart);
          const end = new Date(customDateEnd);
          end.setHours(23, 59, 59, 999);
          filtered = filtered.filter(
            (blog) => {
              const blogDate = new Date(blog.createdAt);
              return blogDate >= start && blogDate <= end;
            }
          );
        }
        break;
    }

    // Apply sorting
    switch (sortBy) {
      case "newest":
        filtered.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case "oldest":
        filtered.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        break;
      case "title-asc":
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "title-desc":
        filtered.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }

    return filtered;
  }, [drafts, effectiveSearchTerm, dateFilter, customDateStart, customDateEnd, sortBy, statusFilter]);

  // Pagination
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedBlogs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedBlogs, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedBlogs.length / ITEMS_PER_PAGE);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [effectiveSearchTerm, dateFilter, customDateStart, customDateEnd, sortBy, statusFilter]);

  const slugify = (text: string) =>
    text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-");

  const handleEdit = (blog: Blog) => {
    setEditId(blog._id);
    setEditTitle(blog.title);
    setEditParamlink(blog.paramlink || "");
    setEditError("");
    setShowEditModal(true);
  };

  const handleSave = async (blog: Blog) => {
    if (!editTitle || !editParamlink) {
      setEditError("Title and paramlink are required");
      return;
    }
    setEditError("");
    try {
      await axios.put(
        `/api/blog/draft?id=${blog._id}`,
        { title: editTitle, paramlink: editParamlink, content: blog.content },
        getAuthHeaders()
      );
      setDrafts((prev) =>
        prev.map((b) =>
          b._id === blog._id ? { ...b, title: editTitle, paramlink: editParamlink } : b
        )
      );
      handleCancel();
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.message?.includes("Paramlink already exists")) {
        setEditError("Paramlink already exists. Please choose another.");
      } else {
        setEditError("Failed to update draft");
      }
    }
  };

  const handleCancel = () => {
    setEditId(null);
    setEditTitle("");
    setEditParamlink("");
    setEditError("");
    setShowEditModal(false);
  };

  const handleDelete = (blogId: string) => {
    const blog = drafts.find(b => b._id === blogId);
    const blogTitle = blog?.title || 'this draft';
    setDeleteTarget({ id: blogId, title: blogTitle });
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    
    try {
      await axios.delete(`/api/blog/draft?id=${deleteTarget.id}`, getAuthHeaders());
      setDrafts(prev => prev.filter(x => x._id !== deleteTarget.id));
      setShowDeleteModal(false);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete the draft. Please try again.');
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteTarget(null);
  };

  const handleEditBlog = (blog: Blog) => {
    if (onEditBlog) {
      onEditBlog(blog._id, 'drafts');
    } else {
      // Fallback to old behavior if callback not provided
      const path = `/${tokenKey === "clinicToken" ? "clinic" : "doctor"}/BlogForm`;
      window.location.href = `${path}?draftId=${blog._id}`;
    }
  };

  const currentEditingBlog = useMemo(() => {
    return drafts.find((b) => b._id === editId);
  }, [drafts, editId]);

  // Don't render content if no read permission
  if (!permissions.canRead) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 max-w-md mx-auto">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
            <p className="text-gray-600 mb-4">
              You do not have permission to view drafts.
            </p>
            <p className="text-sm text-gray-500">
              Please contact your administrator to request access to the Blogs module.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading drafts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-red-600 bg-red-50 p-6 rounded-lg">
          <p className="font-semibold">Error loading drafts</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const BlogCard = ({ blog }: { blog: Blog }) => {
    if (viewMode === 'list') {
      return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 text-lg mb-2 line-clamp-2">{blog.title}</h3>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-2">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Created: {new Date(blog.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                {blog.updatedAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Updated: {new Date(blog.updatedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                )}
                {blog.status && (
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    blog.status === 'scheduled' ? 'bg-purple-100 text-purple-700' :
                    blog.status === 'archived' ? 'bg-slate-100 text-slate-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {blog.status}
                  </span>
                )}
              </div>
              {blog.paramlink && (
                <p className="text-xs text-gray-400 font-mono truncate">{blog.paramlink}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {permissions.canUpdate && (
                <>
                  <button
                    onClick={() => handleEdit(blog)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg"
                    style={{ backgroundColor: PRIMARY_COLOR }}
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit Details
                  </button>
                  <button
                    onClick={() => handleEditBlog(blog)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Edit Blog
                  </button>
                </>
              )}

              {permissions.canDelete && (
                <button
                  onClick={() => handleDelete(blog._id)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Grid view
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-200">
        <div className="flex flex-col h-full">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-lg mb-3 line-clamp-2">{blog.title}</h3>
            <div className="space-y-2 text-sm text-gray-500 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{new Date(blog.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}</span>
              </div>
              {blog.updatedAt && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Updated: {new Date(blog.updatedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}</span>
                </div>
              )}
              {blog.status && (
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                  blog.status === 'scheduled' ? 'bg-purple-100 text-purple-700' :
                  blog.status === 'archived' ? 'bg-slate-100 text-slate-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {blog.status}
                </span>
              )}
            </div>
            {blog.paramlink && (
              <p className="text-xs text-gray-400 font-mono truncate mb-4">{blog.paramlink}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
            {permissions.canUpdate && (
              <>
                <button
                  onClick={() => handleEditBlog(blog)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleEdit(blog)}
                  className="px-4 py-2 text-sm font-medium text-white rounded-lg"
                  style={{ backgroundColor: PRIMARY_COLOR }}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </>
            )}

            {permissions.canDelete && (
              <button
                onClick={() => handleDelete(blog._id)}
                className="px-4 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className="max-w-7xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Drafts</p>
                <p className="text-2xl font-bold text-gray-900">{drafts.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Filter className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Filtered</p>
                <p className="text-2xl font-bold text-gray-900">{filteredAndSortedBlogs.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Showing</p>
                <p className="text-2xl font-bold text-gray-900">{paginatedData.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search drafts by title, content, or URL..."
              value={effectiveSearchTerm}
              onChange={(e) => setLocalSearchTerm(e.target.value)}
              className="text-black w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilterModal(!showFilterModal)}
              className={`px-4 py-3 border rounded-xl transition-colors flex items-center gap-2 ${
                (dateFilter !== 'all' || statusFilter !== 'all' || sortBy !== 'newest')
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-5 h-5" />
              <span className="hidden sm:inline">Filters</span>
            </button>
            <button
              onClick={() => setShowSearchSettings(!showSearchSettings)}
              className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Settings className="w-5 h-5" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </div>

        {/* Filter Modal */}
        {showFilterModal && (
          <div className="mb-6 bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Filter & Sort</h3>
              <button
                onClick={() => setShowFilterModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Date Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                  <option value="year">Last Year</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="title-asc">Title (A-Z)</option>
                  <option value="title-desc">Title (Z-A)</option>
                </select>
              </div>
            </div>

            {/* Custom Date Range */}
            {dateFilter === 'custom' && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={customDateStart}
                    onChange={(e) => setCustomDateStart(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={customDateEnd}
                    onChange={(e) => setCustomDateEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Clear Filters */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setDateFilter('all');
                  setStatusFilter('all');
                  setSortBy('newest');
                  setCustomDateStart('');
                  setCustomDateEnd('');
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}

        {/* Search Settings */}
        {showSearchSettings && (
          <div className="mb-6 bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Search Settings</h3>
              <button
                onClick={() => setShowSearchSettings(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search in: Title, Content, URL
                </label>
                <p className="text-sm text-gray-500">
                  Your search will look through blog titles, content (HTML stripped), and URL slugs.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Case Sensitive: Off
                </label>
                <p className="text-sm text-gray-500">
                  Searches are case-insensitive for better results.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {paginatedData.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {effectiveSearchTerm || dateFilter !== 'all' || statusFilter !== 'all'
                ? 'No drafts match your search criteria.'
                : 'No drafts yet.'}
            </p>
            {(effectiveSearchTerm || dateFilter !== 'all' || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setLocalSearchTerm('');
                  setDateFilter('all');
                  setStatusFilter('all');
                }}
                className="mt-4 text-sm text-blue-600 hover:text-blue-700"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className={viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              : 'space-y-4'
            }>
              {paginatedData.map((blog) => (
                <BlogCard key={blog._id} blog={blog} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="px-4 py-2 text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && currentEditingBlog && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-gray-100">
            <div className="relative p-6 border-b border-gray-100">
              <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: PRIMARY_COLOR }}></div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: PRIMARY_COLOR }}>
                    <Edit3 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Edit Draft</h3>
                    <p className="text-sm text-gray-500">Update your draft details</p>
                  </div>
                </div>
                <button
                  onClick={handleCancel}
                  className="w-10 h-10 bg-gray-100 hover:bg-red-100 rounded-xl flex items-center justify-center transition-all duration-200 group"
                >
                  <X className="w-5 h-5 text-gray-600 group-hover:text-red-600" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Draft Title
                </label>
                <input
                  className="text-black w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:border-transparent transition-all duration-200 bg-gray-50/50 hover:bg-white focus:ring-teal-500 focus:border-teal-500"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Enter your draft title..."
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Draft URL Slug
                </label>
                <input
                  className="text-black w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:border-transparent transition-all duration-200 bg-gray-50/50 hover:bg-white focus:ring-teal-500 focus:border-teal-500"
                  value={editParamlink}
                  onChange={(e) => setEditParamlink(slugify(e.target.value))}
                  placeholder="draft-url-slug"
                />
                {editError && (
                  <div className="flex items-center gap-2 text-red-600 text-sm mt-2 bg-red-50 p-3 rounded-lg border border-red-200">
                    <AlertCircle className="w-4 h-4" />
                    {editError}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => handleSave(currentEditingBlog)}
                className="flex-1 text-white py-4 px-6 rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                style={{ backgroundColor: PRIMARY_COLOR }}
              >
                <Save className="w-5 h-5" />
                Save Changes
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 bg-gray-400 hover:bg-gray-500 text-white py-4 px-6 rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-gray-100">
            <div className="relative p-6 border-b border-gray-100">
              <div className="absolute top-0 left-0 right-0 h-1 bg-red-500"></div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <AlertCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Delete Draft</h3>
                    <p className="text-sm text-gray-500">This action cannot be undone</p>
                  </div>
                </div>
                <button
                  onClick={cancelDelete}
                  className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-all duration-200"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-gray-900 font-semibold mb-2">
                  Are you sure you want to delete this draft?
                </p>
                <p className="text-gray-600 mb-4">
                  &quot;<span className="font-medium">{deleteTarget.title}</span>&quot;
                </p>
                <p className="text-sm text-gray-500">
                  This action cannot be undone and the draft will be permanently removed.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={cancelDelete}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-6 rounded-xl font-semibold transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl"
              >
                Delete Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DraftBlogs;

