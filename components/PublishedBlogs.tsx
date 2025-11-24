import React, { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";
import { Search, Edit2, ExternalLink, Trash2, FileText, BookOpen, ChevronLeft, ChevronRight, X, Edit3, Link, Save, AlertCircle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import SocialMediaShare from "./SocialMediaShare";

type Blog = {
  _id: string;
  title: string;
  content: string;
  paramlink: string;
  createdAt: string;
  status?: "draft" | "published";
};

interface PublishedBlogsProps {
  tokenKey: "clinicToken" | "doctorToken";
  permissions?: {
    canRead?: boolean;
    canUpdate?: boolean;
    canDelete?: boolean;
  };
}

const ITEMS_PER_PAGE = 10;
const PRIMARY_COLOR = "#2D9AA5";

const PublishedBlogs: React.FC<PublishedBlogsProps> = ({ 
  tokenKey,
  permissions = {
    canRead: true,
    canUpdate: true,
    canDelete: true,
  }
}) => {
  const [drafts, setDrafts] = useState<Blog[]>([]);
  const [published, setPublished] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editParamlink, setEditParamlink] = useState<string>("");
  const [editError, setEditError] = useState<string>("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [publishedPage, setPublishedPage] = useState(1);
  const [draftsPage, setDraftsPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'published' | 'drafts'>('published');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{id: string, type: 'published' | 'drafts', title: string} | null>(null);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem(tokenKey);
    return { headers: { Authorization: `Bearer ${token}` } };
  }, [tokenKey]);

  const getBaseUrl = () => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      return origin.includes("localhost") ? process.env.NEXT_PUBLIC_BASE_URL: "https://zeva360.com";
    }
    return "";
  };

  useEffect(() => {
    async function loadAll() {
      // Don't fetch if no read permission
      if (!permissions.canRead) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [draftRes, pubRes] = await Promise.all([
          axios.get("/api/blog/draft", {
            ...getAuthHeaders(),
            validateStatus: (status) => status === 200 || status === 403,
          }),
          axios.get("/api/blog/published", {
            ...getAuthHeaders(),
            validateStatus: (status) => status === 200 || status === 403,
          }),
        ]);

        if (draftRes.status === 403 || pubRes.status === 403) {
          setDrafts([]);
          setPublished([]);
          return;
        }

        setDrafts(draftRes.data?.drafts || draftRes.data || []);
        setPublished(pubRes.data?.blogs || pubRes.data || []);
      } catch (e: unknown) {
        if (axios.isAxiosError(e)) {
          setError(e.message || "Failed to load blogs");
        } else {
          setError("Failed to load blogs");
        }
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, [tokenKey, getAuthHeaders, permissions.canRead]);

  const filteredBlogs = useMemo(() => {
    const filterBlogs = (blogs: Blog[]) =>
      blogs.filter(blog =>
        blog.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        blog.paramlink.toLowerCase().includes(searchTerm.toLowerCase())
      );

    return {
      published: filterBlogs(published),
      drafts: filterBlogs(drafts)
    };
  }, [published, drafts, searchTerm]);

  const paginatedData = useMemo(() => {
    const paginate = (items: Blog[], page: number) => {
      const start = (page - 1) * ITEMS_PER_PAGE;
      return items.slice(start, start + ITEMS_PER_PAGE);
    };

    return {
      published: paginate(filteredBlogs.published, publishedPage),
      drafts: paginate(filteredBlogs.drafts, draftsPage)
    };
  }, [filteredBlogs, publishedPage, draftsPage]);

  const chartData = [
    { name: 'Published', value: published.length, color: PRIMARY_COLOR },
    { name: 'Drafts', value: drafts.length, color: '#6B7280' }
  ];

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
    setEditParamlink(blog.paramlink);
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
        `/api/blog/published?id=${blog._id}`,
        { title: editTitle, paramlink: editParamlink, content: blog.content },
        getAuthHeaders()
      );
      setPublished((prev) =>
        prev.map((b) =>
          b._id === blog._id ? { ...b, title: editTitle, paramlink: editParamlink } : b
        )
      );
      handleCancel();
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.message?.includes("Paramlink already exists")) {
        setEditError("Paramlink already exists. Please choose another.");
      } else {
        setEditError("Failed to update blog");
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

  const handleDelete = (blogId: string, type: 'published' | 'drafts') => {
    // Find the blog to get its title for the confirmation message
    const blog = type === 'published' 
      ? published.find(b => b._id === blogId)
      : drafts.find(b => b._id === blogId);
    
    const blogTitle = blog?.title || 'this blog';
    
    // Set delete target and show modal
    setDeleteTarget({ id: blogId, type, title: blogTitle });
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    
    try {
      await axios.delete(`/api/blog/${deleteTarget.type === 'published' ? 'published' : 'draft'}?id=${deleteTarget.id}`, getAuthHeaders());
      if (deleteTarget.type === 'published') {
        setPublished(prev => prev.filter(x => x._id !== deleteTarget.id));
      } else {
        setDrafts(prev => prev.filter(x => x._id !== deleteTarget.id));
      }
      setShowDeleteModal(false);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Delete failed:', error);
      // You could add a toast notification here instead of alert
      alert('Failed to delete the blog. Please try again.');
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteTarget(null);
  };

  const Pagination = ({ currentPage, totalItems, onPageChange }: {
    currentPage: number;
    totalItems: number;
    onPageChange: (page: number) => void;
  }) => {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-center gap-2 mt-6">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="px-4 py-2 text-sm text-gray-600">
          Page {currentPage} of {totalPages}
        </span>

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const BlogCard = ({ blog, type }: { blog: Blog; type: 'published' | 'drafts' }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-200">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-lg mb-2 line-clamp-2">{blog.title}</h3>
          <p className="text-sm text-gray-500 mb-2">
            Created: {new Date(blog.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
          {type === 'published' && (
            <a
              href={`${getBaseUrl()}/blogs/${blog.paramlink}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-1 rounded-full hover:bg-gray-100 transition"
            >
              <ExternalLink className="w-3 h-3" />
              <span className="truncate">{getBaseUrl()}/blogs/{blog.paramlink}</span>
            </a>

          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {type === 'published' && permissions.canUpdate && (
            <button
              onClick={() => handleEdit(blog)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg"
              style={{ backgroundColor: PRIMARY_COLOR }}
            >
              <Edit2 className="w-4 h-4" />
              URL
            </button>
          )}

          {permissions.canUpdate && (
            <button
              onClick={() => {
                const path = `/${tokenKey === "clinicToken" ? "clinic" : "doctor"}/BlogForm`;
                const param = type === 'published' ? `blogId=${blog._id}` : `draftId=${blog._id}`;
                window.location.href = `${path}?${param}`;
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Edit Blog
            </button>
          )}

          {permissions.canDelete && (
            <button
              onClick={() => handleDelete(blog._id, type)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              
            </button>
          )}

          {type === 'published' && (
            <SocialMediaShare
              blogTitle={blog.title}
              blogUrl={`${getBaseUrl()}/blogs/${blog.paramlink}`}
              blogDescription={blog.content?.replace(/<[^>]+>/g, "").slice(0, 200)}
              triggerLabel="Share"
            />
          )}
        </div>
      </div>
    </div>
  );

  // Get the current blog being edited
  const currentEditingBlog = useMemo(() => {
    return published.find((b) => b._id === editId);
  }, [published, editId]);

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
              You do not have permission to view blogs.
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
          <p className="text-gray-600">Loading blogs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-red-600 bg-red-50 p-6 rounded-lg">
          <p className="font-semibold">Error loading blogs</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="max-w-7xl mx-auto">
        {/* Removed duplicate header - already in parent BlogForm page */}

        {/* Stats and Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Blog Statistics</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg" style={{ backgroundColor: `${PRIMARY_COLOR}20` }}>
                  <BookOpen className="w-6 h-6" style={{ color: PRIMARY_COLOR }} />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Published Blogs</p>
                  <p className="text-3xl font-bold text-gray-900">{published.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gray-100 rounded-lg">
                  <FileText className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Draft Blogs</p>
                  <p className="text-3xl font-bold text-gray-900">{drafts.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search blogs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-black w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('published')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'published'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Published Blogs ({filteredBlogs.published.length})
              </button>
              <button
                onClick={() => setActiveTab('drafts')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'drafts'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Drafts ({filteredBlogs.drafts.length})
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {activeTab === 'published' && (
            <>
              {paginatedData.published.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
                  <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">
                    {searchTerm ? 'No published blogs match your search.' : 'No published blogs yet.'}
                  </p>
                </div>
              ) : (
                <>
                  {paginatedData.published.map((blog) => (
                    <BlogCard key={blog._id} blog={blog} type="published" />
                  ))}
                  <Pagination
                    currentPage={publishedPage}
                    totalItems={filteredBlogs.published.length}
                    onPageChange={setPublishedPage}
                  />
                </>
              )}
            </>
          )}

          {activeTab === 'drafts' && (
            <>
              {paginatedData.drafts.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">
                    {searchTerm ? 'No draft blogs match your search.' : 'No draft blogs yet.'}
                  </p>
                </div>
              ) : (
                <>
                  {paginatedData.drafts.map((blog) => (
                    <BlogCard key={blog._id} blog={blog} type="drafts" />
                  ))}
                  <Pagination
                    currentPage={draftsPage}
                    totalItems={filteredBlogs.drafts.length}
                    onPageChange={setDraftsPage}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && currentEditingBlog && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-gray-100 transform transition-all duration-300 hover:scale-[1.01]">

            {/* Header with theme color accent */}
            <div className="relative p-6 border-b border-gray-100">
              <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: '#2D9AA5' }}></div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: '#2D9AA5' }}>
                    <Edit3 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Edit Blog</h3>
                    <p className="text-sm text-gray-500">Update your blog details</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="w-10 h-10 bg-gray-100 hover:bg-red-100 rounded-xl flex items-center justify-center transition-all duration-200 group"
                >
                  <X className="w-5 h-5 text-gray-600 group-hover:text-red-600" />
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-6">
              {/* Blog Title */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Blog Title
                </label>
                <input
                  className="text-black w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:border-transparent transition-all duration-200 bg-gray-50/50 hover:bg-white focus:ring-teal-500 focus:border-teal-500"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Enter your blog title..."
                />
              </div>

              {/* URL Preview */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Blog URL
                </label>
                <div
                  className="border-2 rounded-xl p-4 mb-3"
                  style={{ backgroundColor: "#e6f4f5", borderColor: "#2D9AA5" }}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <Link className="w-4 h-4" style={{ color: "#2D9AA5" }} />
                    <a
                      href={`${getBaseUrl()}/blogs/${editParamlink || ""}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1"
                    >
                      <span className="text-black">{getBaseUrl()}/blogs/</span>
                      <span
                        className="font-mono font-semibold"
                        style={{ color: "#2D9AA5" }}
                      >
                        {editParamlink || "..."}
                      </span>
                      <ExternalLink className="w-3 h-3 text-black" />
                    </a>
                  </div>
                </div>

                <input
                  className="text-black w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:border-transparent transition-all duration-200 bg-gray-50/50 hover:bg-white focus:ring-teal-500 focus:border-teal-500"
                  value={editParamlink}
                  onChange={(e) => setEditParamlink(slugify(e.target.value))}
                  placeholder="blog-url-slug"
                />
                {editError && (
                  <div className="flex items-center gap-2 text-red-600 text-sm mt-2 bg-red-50 p-3 rounded-lg border border-red-200">
                    <AlertCircle className="w-4 h-4" />
                    {editError}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => handleSave(currentEditingBlog)}
                className="flex-1 text-white py-4 px-6 rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                style={{ backgroundColor: '#2D9AA5' }}
                onMouseEnter={(e) => {
                  const target = e.target as HTMLButtonElement;
                  target.style.backgroundColor = '#267a83';
                }}
                onMouseLeave={(e) => {
                  const target = e.target as HTMLButtonElement;
                  target.style.backgroundColor = '#2D9AA5';
                }}
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
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-gray-100 transform transition-all duration-300 hover:scale-[1.01]">
            
            {/* Header with danger color accent */}
            <div className="relative p-6 border-b border-gray-100">
              <div className="absolute top-0 left-0 right-0 h-1 bg-red-500"></div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <AlertCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Delete Blog</h3>
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

            {/* Content */}
            <div className="p-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-gray-900 font-semibold mb-2">
                  Are you sure you want to delete this {deleteTarget.type === 'published' ? 'published blog' : 'draft'}?
                </p>
                <p className="text-gray-600 mb-4">
                  &quot;<span className="font-medium">{deleteTarget.title}</span>&quot;
                </p>
                <p className="text-sm text-gray-500">
                  This action cannot be undone and the blog will be permanently removed.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
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
                Delete Blog
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublishedBlogs;