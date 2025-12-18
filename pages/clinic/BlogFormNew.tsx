"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import ClinicLayout from '../../components/ClinicLayout';
import withClinicAuth from '../../components/withClinicAuth';
import type { NextPageWithLayout } from '../_app';
import ModernBlogEditor from '../../components/ModernBlogEditor';
import SocialMediaShare from '../../components/SocialMediaShare';
import axios from 'axios';
import {
  PlusCircle,
  Search,
  Heart,
  MessageCircle,
  Bookmark,
  Edit3,
  Trash2,
  Eye,
  Clock,
  User,
  Hash,
  Sparkles,
  Flame,
  BarChart3,
  ExternalLink,
  X,
  Link as LinkIcon
} from 'lucide-react';
import { useAgentPermissions } from '../../hooks/useAgentPermissions';

type TabType = 'feed' | 'published' | 'drafts' | 'trending' | 'analytics';
type CommentType = {
  _id: string;
  user?: string;
  username: string;
  text: string;
  createdAt: string;
  replies?: Array<{
    _id: string;
    user?: string;
    username: string;
    text: string;
    createdAt: string;
  }>;
};

type PostType = {
  _id: string;
  title: string;
  content: string;
  paramlink: string;
  createdAt: string;
  status?: 'draft' | 'published';
  postedBy?: {
    name?: string;
    username?: string;
    email?: string;
  } | string;
  likes?: number;
  likesCount?: number;
  likesArray?: string[];
  liked?: boolean;
  comments?: number;
  commentsCount?: number;
  commentsArray?: CommentType[];
  views?: number;
};

const TOKEN_PRIORITY = [
  "clinicToken",
  "doctorToken",
  "agentToken",
  "staffToken",
  "userToken",
  "adminToken",
];

const getStoredToken = () => {
  if (typeof window === "undefined") return null;
  for (const key of TOKEN_PRIORITY) {
    const value = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (value) return value;
  }
  return null;
};

function ModernBlogForm() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editBlogId, setEditBlogId] = useState<string | null>(null);
  const [editDraftId, setEditDraftId] = useState<string | null>(null);
  const [publishedPosts, setPublishedPosts] = useState<PostType[]>([]);
  const [draftPosts, setDraftPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedPostForComments, setSelectedPostForComments] = useState<PostType | null>(null);
  const [newComment, setNewComment] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [showEditUrlModal, setShowEditUrlModal] = useState(false);
  const [editUrlPost, setEditUrlPost] = useState<PostType | null>(null);
  const [editUrlTitle, setEditUrlTitle] = useState('');
  const [editUrlParamlink, setEditUrlParamlink] = useState('');
  const [editUrlError, setEditUrlError] = useState('');
  const [showPostDetailModal, setShowPostDetailModal] = useState(false);
  const [selectedPostDetail, setSelectedPostDetail] = useState<PostType | null>(null);
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canReadPublished: false,
    canUpdatePublished: false,
    canDeletePublished: false,
    canReadAnalytics: false,
  });
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [hasAgentToken, setHasAgentToken] = useState(false);
  const [isAgentRoute, setIsAgentRoute] = useState(false);

  const tokenKey = isAgentRoute ? "agentToken" : "clinicToken";

  // Get current user ID from token
  useEffect(() => {
    const getCurrentUserId = async () => {
      try {
        const token = localStorage.getItem(tokenKey);
        if (!token) return;
        
        // Decode JWT to get user ID
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const decoded = JSON.parse(jsonPayload);
        setCurrentUserId(decoded.userId || decoded._id || null);
      } catch (error) {
        console.error('Error getting user ID:', error);
      }
    };
    getCurrentUserId();
  }, [tokenKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncTokens = () => {
      setHasAgentToken(Boolean(localStorage.getItem("agentToken")));
    };
    syncTokens();
    window.addEventListener("storage", syncTokens);
    return () => window.removeEventListener("storage", syncTokens);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const agentPath =
      router?.pathname?.startsWith("/agent/") ||
      window.location.pathname?.startsWith("/agent/");
    setIsAgentRoute(agentPath && hasAgentToken);
  }, [router.pathname, hasAgentToken]);

  const agentPermissionsHook: any = useAgentPermissions(isAgentRoute ? "clinic_write_blog" : null);
  const agentPermissions = agentPermissionsHook?.permissions || {
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false,
    canAll: false,
  };
  const agentPermissionsLoading = agentPermissionsHook?.loading || false;

  useEffect(() => {
    if (!isAgentRoute) return;
    if (agentPermissionsLoading) return;
    
    setPermissions({
      canCreate: Boolean(agentPermissions.canAll || agentPermissions.canCreate),
      canReadPublished: Boolean(agentPermissions.canAll || agentPermissions.canRead),
      canUpdatePublished: Boolean(agentPermissions.canAll || agentPermissions.canUpdate),
      canDeletePublished: Boolean(agentPermissions.canAll || agentPermissions.canDelete),
      canReadAnalytics: Boolean(agentPermissions.canAll || agentPermissions.canRead),
    });
    setPermissionsLoaded(true);
  }, [isAgentRoute, agentPermissions, agentPermissionsLoading]);

  useEffect(() => {
    if (isAgentRoute) return;
    let isMounted = true;
    const token = getStoredToken();
    if (!token) {
      setPermissions({
        canCreate: false,
        canReadPublished: false,
        canUpdatePublished: false,
        canDeletePublished: false,
        canReadAnalytics: false,
      });
      setPermissionsLoaded(true);
      return;
    }

    const fetchClinicPermissions = async () => {
      try {
        setPermissionsLoaded(false);
        const res = await axios.get("/api/clinic/permissions", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = res.data;
        
        if (!isMounted) return;
        if (data.success && data.data) {
          const modulePermission = data.data.permissions?.find((p: any) => {
            if (!p?.module) return false;
            const moduleKey = p.module || "";
            const normalizedModule = moduleKey.replace(/^(admin|clinic|doctor|agent)_/, "");
            return normalizedModule === "write_blog" || moduleKey === "write_blog" || 
                   moduleKey === "clinic_write_blog" || moduleKey === "doctor_write_blog" ||
                   normalizedModule === "blogs" || moduleKey === "blogs" || moduleKey === "clinic_blogs";
          });
          
          if (modulePermission) {
            const actions = modulePermission.actions || {};
            const isTrue = (value: any) => {
              if (value === true) return true;
              if (value === "true") return true;
              if (String(value).toLowerCase() === "true") return true;
              return false;
            };

            const moduleAll = isTrue(actions.all);
            const moduleCreate = isTrue(actions.create);
            const moduleRead = isTrue(actions.read);
            const moduleUpdate = isTrue(actions.update);
            const moduleDelete = isTrue(actions.delete);
            
            if (isMounted) {
              setPermissions({
                canCreate: moduleAll || moduleCreate,
                canReadPublished: moduleAll || moduleRead,
                canUpdatePublished: moduleAll || moduleUpdate,
                canDeletePublished: moduleAll || moduleDelete,
                canReadAnalytics: moduleAll || moduleRead,
              });
            }
          } else {
            const hasAnyPermissions = data.data.permissions && data.data.permissions.length > 0;
            if (isMounted) {
              setPermissions({
                canCreate: !hasAnyPermissions,
                canReadPublished: !hasAnyPermissions,
                canUpdatePublished: !hasAnyPermissions,
                canDeletePublished: !hasAnyPermissions,
                canReadAnalytics: !hasAnyPermissions,
              });
            }
          }
        }
      } catch (err: any) {
        console.error("Error fetching permissions:", err);
      } finally {
        if (isMounted) {
          setPermissionsLoaded(true);
        }
      }
    };

    fetchClinicPermissions();
    return () => { isMounted = false; };
  }, [isAgentRoute]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem(tokenKey);
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  // Sanitize post data to ensure no objects are rendered directly
  const sanitizePost = (post: any): PostType | null => {
    if (!post || typeof post !== 'object') return null;
    
    // Extract and sanitize postedBy
    let postedBy: PostType['postedBy'] = 'Anonymous';
    if (post.postedBy) {
      if (typeof post.postedBy === 'string') {
        postedBy = post.postedBy;
      } else if (typeof post.postedBy === 'object') {
        postedBy = {
          name: String(post.postedBy.name || post.postedBy.username || ''),
          username: String(post.postedBy.username || ''),
          email: String(post.postedBy.email || ''),
        };
      }
    }

    // Handle likes
    const likesArray = Array.isArray(post.likes) ? post.likes.map(String) : [];
    const likesCount = post.likesCount || (Array.isArray(post.likes) ? post.likes.length : 0);
    const liked = currentUserId ? likesArray.includes(currentUserId) : false;

    // Handle comments
    const commentsArray = Array.isArray(post.comments) 
      ? post.comments.map((c: any) => ({
          _id: String(c._id || ''),
          user: c.user ? String(c.user) : undefined,
          username: String(c.username || 'Anonymous'),
          text: String(c.text || ''),
          createdAt: String(c.createdAt || ''),
          replies: Array.isArray(c.replies) 
            ? c.replies.map((r: any) => ({
                _id: String(r._id || ''),
                user: r.user ? String(r.user) : undefined,
                username: String(r.username || 'Anonymous'),
                text: String(r.text || ''),
                createdAt: String(r.createdAt || ''),
              }))
            : [],
        }))
      : [];
    const commentsCount = post.commentsCount || (Array.isArray(post.comments) ? post.comments.length : 0);

    // Ensure all fields are strings/numbers, not objects
    return {
      _id: String(post._id || ''),
      title: String(post.title || ''),
      content: String(post.content || ''),
      paramlink: String(post.paramlink || ''),
      createdAt: String(post.createdAt || new Date().toISOString()),
      status: post.status === 'draft' ? 'draft' : 'published',
      postedBy,
      likes: likesCount,
      likesCount,
      likesArray,
      liked,
      comments: commentsCount,
      commentsCount,
      commentsArray,
      views: typeof post.views === 'number' ? post.views : 0,
    };
  };

  const loadPosts = async () => {
    if (!permissions.canReadPublished) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [publishedRes, draftsRes] = await Promise.all([
        axios.get("/api/blog/published", {
          ...getAuthHeaders(),
          validateStatus: (status) => status === 200 || status === 403,
        }),
        axios.get("/api/blog/draft", {
          ...getAuthHeaders(),
          validateStatus: (status) => status === 200 || status === 403,
        }),
      ]);

      if (publishedRes.status === 200) {
        const blogs = publishedRes.data?.blogs || publishedRes.data || [];
        // The published API should already include likes and comments
        // Sanitize all posts to ensure no objects are rendered
        const sanitized = Array.isArray(blogs)
          ? blogs.map(sanitizePost).filter((p): p is PostType => p !== null)
          : [];
        setPublishedPosts(sanitized);
      }
      if (draftsRes.status === 200) {
        const drafts = draftsRes.data?.drafts || draftsRes.data || [];
        // Sanitize all drafts to ensure no objects are rendered
        const sanitized = Array.isArray(drafts)
          ? drafts.map(sanitizePost).filter((p): p is PostType => p !== null)
          : [];
        setDraftPosts(sanitized);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (permissionsLoaded) {
      loadPosts();
    }
  }, [permissionsLoaded, currentUserId]);

  const handleCreatePost = () => {
    if (!permissions.canCreate) {
      alert("You do not have permission to create blogs");
      return;
    }
    setEditBlogId(null);
    setEditDraftId(null);
    setIsEditorOpen(true);
  };

  const handleEditPost = (postId: string, type: 'published' | 'drafts') => {
    if (type === 'published') {
      setEditBlogId(postId);
      setEditDraftId(null);
    } else {
      setEditDraftId(postId);
      setEditBlogId(null);
    }
    setIsEditorOpen(true);
  };

  const handleDeletePost = async (postId: string, type: 'published' | 'drafts') => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    
    try {
      await axios.delete(
        `/api/blog/${type === 'published' ? 'published' : 'draft'}?id=${postId}`,
        getAuthHeaders()
      );
      loadPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post');
    }
  };

  const handleLike = async (postId: string) => {
    if (!currentUserId) {
      alert('Please login to like posts');
      return;
    }

    try {
      const res = await axios.post(
        '/api/blog/likeBlog',
        { blogId: postId },
        getAuthHeaders()
      );

      if (res.data.success) {
        // Update the post in state
        setPublishedPosts(prev => prev.map(post => 
          post._id === postId 
            ? { 
                ...post, 
                likesCount: res.data.likesCount,
                liked: res.data.liked,
                likes: res.data.likesCount
              }
            : post
        ));
      }
    } catch (error: any) {
      console.error('Error liking post:', error);
      alert(error.response?.data?.error || 'Failed to like post');
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!newComment.trim()) return;
    if (!currentUserId) {
      alert('Please login to comment');
      return;
    }

    setCommenting(true);
    try {
      const res = await axios.post(
        '/api/blog/addComment',
        { blogId: postId, text: newComment.trim() },
        getAuthHeaders()
      );

      if (res.data.success) {
        // Update the post in state
        setPublishedPosts(prev => prev.map(post => 
          post._id === postId 
            ? { 
                ...post, 
                commentsCount: res.data.commentsCount,
                comments: res.data.commentsCount,
                commentsArray: [...(post.commentsArray || []), res.data.comment]
              }
            : post
        ));
        setNewComment('');
        if (selectedPostForComments?._id === postId) {
          setSelectedPostForComments(prev => prev ? {
            ...prev,
            commentsCount: res.data.commentsCount,
            comments: res.data.commentsCount,
            commentsArray: [...(prev.commentsArray || []), res.data.comment]
          } : null);
        }
      }
    } catch (error: any) {
      console.error('Error adding comment:', error);
      alert(error.response?.data?.error || 'Failed to add comment');
    } finally {
      setCommenting(false);
    }
  };

  const openCommentsModal = (post: PostType) => {
    setSelectedPostForComments(post);
    setShowCommentsModal(true);
  };

  const handleEditUrl = (post: PostType) => {
    setEditUrlPost(post);
    setEditUrlTitle(post.title);
    setEditUrlParamlink(post.paramlink);
    setEditUrlError('');
    setShowEditUrlModal(true);
  };

  const handleSaveUrl = async () => {
    if (!editUrlPost || !editUrlTitle || !editUrlParamlink) {
      setEditUrlError('Title and URL slug are required');
      return;
    }

    try {
      await axios.put(
        `/api/blog/published?id=${editUrlPost._id}`,
        { 
          title: editUrlTitle, 
          paramlink: editUrlParamlink, 
          content: editUrlPost.content 
        },
        getAuthHeaders()
      );
      
      // Update the post in state
      setPublishedPosts(prev => prev.map(post => 
        post._id === editUrlPost._id 
          ? { ...post, title: editUrlTitle, paramlink: editUrlParamlink }
          : post
      ));
      
      setShowEditUrlModal(false);
      setEditUrlPost(null);
      alert('Blog URL updated successfully!');
    } catch (error: any) {
      if (error.response?.data?.message?.includes('Paramlink already exists')) {
        setEditUrlError('URL slug already exists. Please choose another.');
      } else {
        setEditUrlError('Failed to update blog URL');
      }
    }
  };

  const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');
  };

  const extractFirstImage = (html: string | undefined): string | null => {
    if (!html || typeof html !== 'string') return null;
    const match = html.match(/<img[^>]+src="([^"]+)"/);
    return match ? match[1] : null;
  };

  const extractText = (html: string | undefined, maxLength: number = 150): string => {
    if (!html || typeof html !== 'string') return '';
    const text = html.replace(/<[^>]*>/g, '').trim();
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const extractTopics = (content: string | undefined): string[] => {
    if (!content || typeof content !== 'string') return [];
    const hashtagRegex = /#(\w+)/g;
    const matches = content.match(hashtagRegex);
    return matches ? matches.map(m => m.substring(1)) : [];
  };

  const getBaseUrl = () => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      return origin.includes("localhost") ? process.env.NEXT_PUBLIC_BASE_URL : "https://zeva360.com";
    }
    return "";
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString || typeof dateString !== 'string') return 'Recently';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Recently';
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (days === 0) return 'Today';
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days} days ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  const PostCard = ({ post, type }: { post: PostType; type: 'published' | 'drafts' }) => {
    // Ensure post is valid
    if (!post || !post._id || !post.title) {
      return <div>Invalid post data</div>;
    }
    
    const imageUrl = extractFirstImage(post.content);
    const excerpt = extractText(post.content);
    const topics = extractTopics(post.content);
    
    // Safely extract author name - ensure it's always a string
    const getAuthorName = (): string => {
      if (!post.postedBy) return 'Anonymous';
      if (typeof post.postedBy === 'string') {
        return post.postedBy || 'Anonymous';
      }
      if (typeof post.postedBy === 'object' && post.postedBy !== null) {
        const name = post.postedBy.name || post.postedBy.username || '';
        return String(name) || 'Anonymous';
      }
      return 'Anonymous';
    };
    
    const authorName = getAuthorName();
    const safeTitle = String(post.title || 'Untitled');
    const safeExcerpt = String(excerpt || '');
    const safeDate = formatDate(post.createdAt);
    
    return (
      <article className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
        {imageUrl && (
          <div className="relative h-64 overflow-hidden">
            <img
              src={imageUrl}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            {type === 'drafts' && (
              <div className="absolute top-4 left-4 px-3 py-1 bg-amber-500 text-white rounded-full text-xs font-semibold">
                Draft
              </div>
            )}
          </div>
        )}
        
        <div className="p-6">
          {/* Topics */}
          {topics.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {topics.slice(0, 3).map((topic) => (
                <span
                  key={topic}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-full text-xs font-medium"
                >
                  <Hash className="w-3 h-3" />
                  {topic}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-3 line-clamp-2 group-hover:text-purple-600 transition-colors">
            {safeTitle}
          </h2>

          {/* Excerpt */}
          <p className="text-gray-600 mb-4 line-clamp-3 leading-relaxed">
            {safeExcerpt}
          </p>

          {/* Author & Meta */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {authorName}
                </p>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {safeDate}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center gap-4 text-sm text-gray-500">
              {type === 'published' && (
                <>
                  <button 
                    onClick={() => handleLike(post._id)}
                    className={`flex items-center gap-1.5 transition-colors ${
                      post.liked 
                        ? 'text-red-500 hover:text-red-600' 
                        : 'hover:text-red-500'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${post.liked ? 'fill-current' : ''}`} />
                    <span>{Number(post.likesCount || post.likes) || 0}</span>
                  </button>
                  <button 
                    onClick={() => openCommentsModal(post)}
                    className="flex items-center gap-1.5 hover:text-blue-500 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>{Number(post.commentsCount || post.comments) || 0}</span>
                  </button>
                  <button className="flex items-center gap-1.5 hover:text-green-500 transition-colors">
                    <Eye className="w-4 h-4" />
                    <span>{Number(post.views) || 0}</span>
                  </button>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {type === 'published' && (
                <>
                  <button
                    onClick={() => {
                      setSelectedPostDetail(post);
                      setShowPostDetailModal(true);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="View Full Post"
                  >
                    <Eye className="w-4 h-4 text-gray-600" />
                  </button>
                  <a
                    href={`${getBaseUrl()}/blogs/${post.paramlink}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                    title="Open in New Tab"
                  >
                    <ExternalLink className="w-4 h-4 text-blue-600" />
                  </a>
                  {permissions.canUpdatePublished && (
                    <button
                      onClick={() => handleEditUrl(post)}
                      className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                      title="Edit URL"
                    >
                      <LinkIcon className="w-4 h-4 text-blue-600" />
                    </button>
                  )}
                  <div className="p-0">
                    <SocialMediaShare
                      blogTitle={safeTitle}
                      blogUrl={`${getBaseUrl()}/blogs/${post.paramlink}`}
                      blogDescription={safeExcerpt}
                      triggerClassName="p-2 hover:bg-purple-100 rounded-lg transition-colors"
                    />
                  </div>
                </>
              )}
              {permissions.canUpdatePublished && (
                <button
                  onClick={() => handleEditPost(post._id, type)}
                  className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit3 className="w-4 h-4 text-purple-600" />
                </button>
              )}
              {permissions.canDeletePublished && (
                <button
                  onClick={() => handleDeletePost(post._id, type)}
                  className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  };

  if (!permissionsLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600"></div>
          <p className="text-purple-700 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  const allPosts = [...publishedPosts, ...draftPosts]
    .filter(post => post && typeof post === 'object' && post._id && post.title) // Ensure valid post objects
    .sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  const filteredPosts = allPosts.filter(post => {
    if (!post || !post.title || !post.content) return false;
    const title = String(post.title).toLowerCase();
    const content = String(post.content).toLowerCase();
    const query = searchQuery.toLowerCase();
    return title.includes(query) || content.includes(query);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50/30 to-blue-50/40">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-purple-200/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Blog Studio
                </h1>
                <p className="text-sm text-gray-500">Create & Share Your Stories</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search posts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-64 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Create Button */}
              {permissions.canCreate && (
                <button
                  onClick={handleCreatePost}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                >
                  <PlusCircle className="w-5 h-5" />
                  New Post
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 mt-4">
            {[
              { id: 'feed' as TabType, label: 'Feed', icon: Sparkles },
              { id: 'published' as TabType, label: 'Published', icon: Bookmark },
              { id: 'drafts' as TabType, label: 'Drafts', icon: Edit3 },
              { id: 'trending' as TabType, label: 'Trending', icon: Flame },
              { id: 'analytics' as TabType, label: 'Analytics', icon: BarChart3 },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600"></div>
          </div>
        ) : (
          <>
            {(activeTab === 'feed' || activeTab === 'published' || activeTab === 'trending') && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPosts
                  .filter(post => activeTab === 'feed' || (activeTab === 'published' && post.status === 'published') || (activeTab === 'trending' && post.status === 'published'))
                  .map((post) => (
                    <PostCard
                      key={post._id}
                      post={post}
                      type={post.status === 'draft' ? 'drafts' : 'published'}
                    />
                  ))}
              </div>
            )}

            {activeTab === 'drafts' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPosts
                  .filter(post => post.status === 'draft')
                  .map((post) => (
                    <PostCard key={post._id} post={post} type="drafts" />
                  ))}
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold mb-6">Analytics</h2>
                <p className="text-gray-600">Analytics features coming soon...</p>
              </div>
            )}

            {filteredPosts.length === 0 && (
              <div className="text-center py-20">
                <div className="w-24 h-24 bg-gradient-to-br from-purple-400 to-pink-400 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">No posts yet</h3>
                <p className="text-gray-600 mb-6">Start creating amazing content!</p>
                {permissions.canCreate && (
                  <button
                    onClick={handleCreatePost}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                  >
                    Create Your First Post
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Editor Modal */}
      {isEditorOpen && (
        <ModernBlogEditor
          tokenKey={tokenKey}
          editBlogId={editBlogId || undefined}
          editDraftId={editDraftId || undefined}
          onClose={() => {
            setIsEditorOpen(false);
            setEditBlogId(null);
            setEditDraftId(null);
            loadPosts();
          }}
          onSave={loadPosts}
        />
      )}

      {/* Comments Modal */}
      {showCommentsModal && selectedPostForComments && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Comments</h2>
              <button
                onClick={() => {
                  setShowCommentsModal(false);
                  setSelectedPostForComments(null);
                  setNewComment('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedPostForComments.commentsArray && selectedPostForComments.commentsArray.length > 0 ? (
                selectedPostForComments.commentsArray.map((comment) => (
                  <div key={comment._id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                          <span className="text-white text-xs font-semibold">
                            {comment.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{comment.username}</p>
                          <p className="text-xs text-gray-500">
                            {formatDate(comment.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-700 mb-2">{comment.text}</p>
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="mt-3 ml-4 space-y-2 border-l-2 border-purple-200 pl-4">
                        {comment.replies.map((reply) => (
                          <div key={reply._id} className="bg-white rounded p-2">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-gray-700">{reply.username}</span>
                              <span className="text-xs text-gray-500">{formatDate(reply.createdAt)}</span>
                            </div>
                            <p className="text-sm text-gray-600">{reply.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No comments yet. Be the first to comment!</p>
                </div>
              )}
            </div>

            {/* Comment Input */}
            <div className="p-6 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddComment(selectedPostForComments._id);
                    }
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={() => handleAddComment(selectedPostForComments._id)}
                  disabled={commenting || !newComment.trim()}
                  className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {commenting ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit URL Modal */}
      {showEditUrlModal && editUrlPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-gray-100">
            {/* Header */}
            <div className="relative p-6 border-b border-gray-100">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-t-2xl"></div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <LinkIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Edit Blog URL</h3>
                    <p className="text-sm text-gray-500 mt-1">Update title and URL slug</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowEditUrlModal(false);
                    setEditUrlPost(null);
                    setEditUrlError('');
                  }}
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
                  type="text"
                  value={editUrlTitle}
                  onChange={(e) => setEditUrlTitle(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-200 focus:border-purple-400 transition-all duration-200 bg-gray-50 hover:bg-white"
                  placeholder="Enter blog title..."
                />
              </div>

              {/* URL Preview */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Blog URL Slug
                </label>
                <div className="border-2 rounded-xl p-4 mb-3 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">{getBaseUrl()}/blogs/</span>
                    <span className="font-mono font-semibold text-purple-700">
                      {editUrlParamlink || '...'}
                    </span>
                  </div>
                </div>
                <input
                  type="text"
                  value={editUrlParamlink}
                  onChange={(e) => setEditUrlParamlink(slugify(e.target.value))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-200 focus:border-purple-400 transition-all duration-200 bg-gray-50 hover:bg-white"
                  placeholder="blog-url-slug"
                />
                {editUrlError && (
                  <div className="flex items-center gap-2 text-red-600 text-sm mt-2 bg-red-50 p-3 rounded-lg border border-red-200">
                    <X className="w-4 h-4" />
                    {editUrlError}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowEditUrlModal(false);
                  setEditUrlPost(null);
                  setEditUrlError('');
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-6 rounded-xl font-semibold transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUrl}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post Detail Modal - View Complete Post */}
      {showPostDetailModal && selectedPostDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl my-8 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                  <Eye className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Post Preview</h2>
                  <p className="text-sm text-gray-500">View complete post content</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`${getBaseUrl()}/blogs/${selectedPostDetail.paramlink}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                  title="Open in New Tab"
                >
                  <ExternalLink className="w-5 h-5 text-blue-600" />
                </a>
                <button
                  onClick={() => {
                    setShowPostDetailModal(false);
                    setSelectedPostDetail(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Post Content */}
            <div className="flex-1 overflow-y-auto p-8">
              {/* Featured Image */}
              {extractFirstImage(selectedPostDetail.content) && (
                <div className="mb-6">
                  <img
                    src={extractFirstImage(selectedPostDetail.content) || ''}
                    alt={selectedPostDetail.title}
                    className="w-full h-96 object-cover rounded-2xl shadow-lg"
                  />
                </div>
              )}

              {/* Title */}
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                {selectedPostDetail.title}
              </h1>

              {/* Author & Meta */}
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {(() => {
                        if (!selectedPostDetail.postedBy) return 'Anonymous';
                        if (typeof selectedPostDetail.postedBy === 'string') return selectedPostDetail.postedBy;
                        return selectedPostDetail.postedBy.name || selectedPostDetail.postedBy.username || 'Anonymous';
                      })()}
                    </p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(selectedPostDetail.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 ml-auto text-sm text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <Heart className={`w-4 h-4 ${selectedPostDetail.liked ? 'fill-current text-red-500' : ''}`} />
                    <span>{Number(selectedPostDetail.likesCount || selectedPostDetail.likes) || 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4" />
                    <span>{Number(selectedPostDetail.commentsCount || selectedPostDetail.comments) || 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Eye className="w-4 h-4" />
                    <span>{Number(selectedPostDetail.views) || 0}</span>
                  </div>
                </div>
              </div>

              {/* Topics */}
              {extractTopics(selectedPostDetail.content).length > 0 && (
                <div className="mb-6 flex flex-wrap gap-2">
                  {extractTopics(selectedPostDetail.content).map((topic) => (
                    <span
                      key={topic}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-full text-sm font-medium"
                    >
                      <Hash className="w-3 h-3" />
                      {topic}
                    </span>
                  ))}
                </div>
              )}

              {/* Full Content */}
              <div
                className="prose prose-lg max-w-none text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: selectedPostDetail.content }}
                style={{
                  wordBreak: 'break-word',
                }}
              />

              {/* Actions Footer */}
              <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleLike(selectedPostDetail._id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                      selectedPostDetail.liked
                        ? 'bg-red-50 text-red-600 border-2 border-red-200'
                        : 'bg-gray-50 text-gray-600 border-2 border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${selectedPostDetail.liked ? 'fill-current' : ''}`} />
                    <span>{Number(selectedPostDetail.likesCount || selectedPostDetail.likes) || 0}</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowPostDetailModal(false);
                      openCommentsModal(selectedPostDetail);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-600 border-2 border-gray-200 rounded-xl font-medium hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>{Number(selectedPostDetail.commentsCount || selectedPostDetail.comments) || 0}</span>
                  </button>
                  <div className="p-0">
                    <SocialMediaShare
                      blogTitle={selectedPostDetail.title}
                      blogUrl={`${getBaseUrl()}/blogs/${selectedPostDetail.paramlink}`}
                      blogDescription={extractText(selectedPostDetail.content, 200)}
                      triggerClassName="px-4 py-2 bg-gray-50 text-gray-600 border-2 border-gray-200 rounded-xl font-medium hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 transition-all"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {permissions.canUpdatePublished && (
                    <button
                      onClick={() => {
                        setShowPostDetailModal(false);
                        handleEditPost(selectedPostDetail._id, 'published');
                      }}
                      className="px-4 py-2 bg-purple-50 text-purple-600 border-2 border-purple-200 rounded-xl font-medium hover:bg-purple-100 transition-all"
                    >
                      <Edit3 className="w-4 h-4 inline mr-2" />
                      Edit
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ModernBlogForm.getLayout = function PageLayout(page: React.ReactNode) {
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

const ProtectedModernBlogForm: NextPageWithLayout = withClinicAuth(ModernBlogForm);
ProtectedModernBlogForm.getLayout = ModernBlogForm.getLayout;

export default ProtectedModernBlogForm;

