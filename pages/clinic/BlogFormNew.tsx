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
  Link as LinkIcon,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  Award,
  Users,
  Calendar
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

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

  const loadPosts = async (showRefreshIndicator = false) => {
    if (!permissions.canReadPublished) {
      setLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
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

      let publishedPostsData: PostType[] = [];
      if (publishedRes.status === 200) {
        const blogs = publishedRes.data?.blogs || publishedRes.data || [];
        // The published API should already include likes and comments
        // Sanitize all posts to ensure no objects are rendered
        const sanitized = Array.isArray(blogs)
          ? blogs.map(sanitizePost).filter((p): p is PostType => p !== null)
          : [];
        publishedPostsData = sanitized;
        setPublishedPosts(publishedPostsData);
      }
      
      if (draftsRes.status === 200) {
        const drafts = draftsRes.data?.drafts || draftsRes.data || [];
        // Get published post IDs to exclude from drafts
        const publishedIds = new Set(
          publishedPostsData.map((p) => p._id)
        );
        
        // Sanitize all drafts to ensure no objects are rendered
        // Also filter out any published posts that might have slipped through
        const sanitized = Array.isArray(drafts)
          ? drafts
              .map(sanitizePost)
              .filter((p): p is PostType => p !== null)
              .filter((p) => {
                // Only include if it's a draft AND not in published posts
                const isDraftStatus = p.status === 'draft' || (!p.status && p.status !== 'published');
                const notInPublished = !publishedIds.has(p._id);
                // Also check if status is explicitly published
                const notPublishedStatus = p.status !== 'published';
                return isDraftStatus && notInPublished && notPublishedStatus;
              })
          : [];
        setDraftPosts(sanitized);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    await loadPosts(true);
  };

  useEffect(() => {
    if (permissionsLoaded) {
      loadPosts();
    }
  }, [permissionsLoaded, currentUserId]);

  // Load analytics data
  const loadAnalytics = async () => {
    if (!permissions.canReadAnalytics) {
      return;
    }

    try {
      setAnalyticsLoading(true);
      const res = await axios.get("/api/blog/getAuthorCommentsAndLikes", {
        ...getAuthHeaders(),
        validateStatus: (status) => status === 200 || status === 403,
      });

      if (res.status === 200 && res.data.success) {
        setAnalyticsData(res.data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Load analytics when analytics tab is active
  useEffect(() => {
    if (activeTab === 'analytics' && permissionsLoaded && permissions.canReadAnalytics) {
      loadAnalytics();
    }
  }, [activeTab, permissionsLoaded, permissions.canReadAnalytics]);

  // Remove published posts from drafts when publishedPosts changes
  useEffect(() => {
    if (publishedPosts.length > 0 && draftPosts.length > 0) {
      const publishedIds = new Set(publishedPosts.map(p => p._id));
      setDraftPosts(prevDrafts => 
        prevDrafts.filter(draft => !publishedIds.has(draft._id))
      );
    }
  }, [publishedPosts]);

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
      <article className="bg-white rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
        {imageUrl && (
          <div className="relative h-48 sm:h-56 md:h-64 overflow-hidden">
            <img
              src={imageUrl}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            {type === 'drafts' && (
              <div className="absolute top-2 sm:top-3 md:top-4 left-2 sm:left-3 md:left-4 px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 bg-amber-500 text-white rounded-full text-xs font-semibold">
                Draft
              </div>
            )}
          </div>
        )}
        
        <div className="p-4 sm:p-5 md:p-6">
          {/* Topics */}
          {topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2 sm:mb-3">
              {topics.slice(0, 3).map((topic) => (
                <span
                  key={topic}
                  className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-full text-xs font-medium"
                >
                  <Hash className="w-3 h-3" />
                  <span className="truncate max-w-[80px] sm:max-w-none">{topic}</span>
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-2 sm:mb-3 line-clamp-2 group-hover:text-purple-600 transition-colors">
            {safeTitle}
          </h2>

          {/* Excerpt */}
          <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4 line-clamp-3 leading-relaxed">
            {safeExcerpt}
          </p>

          {/* Author & Meta */}
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                  {authorName}
                </p>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{safeDate}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-3 sm:pt-4 border-t border-gray-100 gap-3 sm:gap-0">
            <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500">
              {type === 'published' && (
                <>
                  <button 
                    onClick={() => handleLike(post._id)}
                    className={`flex items-center gap-1 sm:gap-1.5 transition-colors ${
                      post.liked 
                        ? 'text-red-500 hover:text-red-600' 
                        : 'hover:text-red-500'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${post.liked ? 'fill-current' : ''}`} />
                    <span>{Number(post.likesCount || post.likes) || 0}</span>
                  </button>
                  <button 
                    onClick={() => openCommentsModal(post)}
                    className="flex items-center gap-1 sm:gap-1.5 hover:text-blue-500 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>{Number(post.commentsCount || post.comments) || 0}</span>
                  </button>
                  <button className="flex items-center gap-1 sm:gap-1.5 hover:text-green-500 transition-colors">
                    <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>{Number(post.views) || 0}</span>
                  </button>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {type === 'published' && (
                <>
                  <button
                    onClick={() => {
                      setSelectedPostDetail(post);
                      setShowPostDetailModal(true);
                    }}
                    className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="View Full Post"
                  >
                    <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
                  </button>
                  <a
                    href={`${getBaseUrl()}/blogs/${post.paramlink}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 sm:p-2 hover:bg-blue-100 rounded-lg transition-colors"
                    title="Open in New Tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
                  </a>
                  {permissions.canUpdatePublished && (
                    <button
                      onClick={() => handleEditUrl(post)}
                      className="p-1.5 sm:p-2 hover:bg-blue-100 rounded-lg transition-colors"
                      title="Edit URL"
                    >
                      <LinkIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
                    </button>
                  )}
                  <div className="p-0">
                    <SocialMediaShare
                      blogTitle={safeTitle}
                      blogUrl={`${getBaseUrl()}/blogs/${post.paramlink}`}
                      blogDescription={safeExcerpt}
                      triggerClassName="p-1.5 sm:p-2 hover:bg-purple-100 rounded-lg transition-colors"
                    />
                  </div>
                </>
              )}
              {permissions.canUpdatePublished && (
                <button
                  onClick={() => handleEditPost(post._id, type)}
                  className="p-1.5 sm:p-2 hover:bg-purple-100 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600" />
                </button>
              )}
              {permissions.canDeletePublished && (
                <button
                  onClick={() => handleDeletePost(post._id, type)}
                  className="p-1.5 sm:p-2 hover:bg-red-100 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600" />
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

  // Get all published post IDs to exclude from drafts
  const publishedPostIds = new Set(publishedPosts.map(p => p._id));

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
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Blog Studio
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Create & Share Your Stories</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto pr-10 sm:pr-12 md:pr-0">
              {/* Search */}
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search posts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 w-full sm:w-48 md:w-64 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || loading}
                className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg sm:rounded-xl text-gray-600 hover:text-purple-600 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-sm hover:shadow-md"
                title="Refresh posts"
              >
                <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>

              {/* Create Button */}
              {permissions.canCreate && (
                <button
                  onClick={handleCreatePost}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105 whitespace-nowrap"
                >
                  <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">New Post</span>
                  <span className="sm:hidden">New</span>
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1.5 sm:gap-2 mt-3 sm:mt-4 overflow-x-auto scrollbar-hide -mx-3 sm:mx-0 px-3 sm:px-0">
            {[
              { id: 'feed' as TabType, label: 'Feed', icon: Sparkles, description: 'View all blog posts' },
              { id: 'published' as TabType, label: 'Published', icon: Bookmark, description: 'View published posts' },
              { id: 'drafts' as TabType, label: 'Drafts', icon: Edit3, description: 'View draft posts' },
              { id: 'trending' as TabType, label: 'Trending', icon: Flame, description: 'View trending posts' },
              { id: 'analytics' as TabType, label: 'Analytics', icon: BarChart3, description: 'View blog analytics' },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.label}
                  className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm md:text-base font-medium transition-all whitespace-nowrap group relative ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">{tab.label}</span>
                  {/* Custom Tooltip - Shows on hover above icon */}
                  <span className="absolute -top-9 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                    {tab.label}
                    <span className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-900"></span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600"></div>
          </div>
        ) : (
          <>
            {(activeTab === 'feed' || activeTab === 'published' || activeTab === 'trending') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
                {filteredPosts
                  .filter(post => {
                    // Only show drafts that are not published
                    // Check both status and if the post ID exists in published posts
                    const isDraft = post.status === 'draft' || (!post.status && !publishedPostIds.has(post._id));
                    const notPublished = !publishedPostIds.has(post._id);
                    return isDraft && notPublished;
                  })
                  .map((post) => (
                    <PostCard key={post._id} post={post} type="drafts" />
                  ))}
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-4 sm:space-y-6">
                {!permissions.canReadAnalytics ? (
                  <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-6 sm:p-8 md:p-12 text-center">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-purple-400 to-pink-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <BarChart3 className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Access Restricted</h3>
                    <p className="text-sm sm:text-base text-gray-600">You don't have permission to view analytics.</p>
                  </div>
                ) : analyticsLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-4">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600"></div>
                      <p className="text-purple-700 text-sm font-medium">Loading analytics...</p>
                    </div>
                  </div>
                ) : analyticsData ? (
                  <>
                    {/* Overview Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
                      {/* Total Posts */}
                      <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 text-white">
                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                          <div className="p-2 sm:p-2.5 bg-white/20 rounded-lg">
                            <Bookmark className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 opacity-80" />
                        </div>
                        <p className="text-xs sm:text-sm opacity-90 mb-1">Total Posts</p>
                        <p className="text-2xl sm:text-3xl md:text-4xl font-bold">
                          {analyticsData.blogs?.length || publishedPosts.length || 0}
                        </p>
                        <p className="text-xs sm:text-sm opacity-75 mt-1 sm:mt-2">
                          {draftPosts.length} drafts
                        </p>
                      </div>

                      {/* Total Views */}
                      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 text-white">
                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                          <div className="p-2 sm:p-2.5 bg-white/20 rounded-lg">
                            <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 opacity-80" />
                        </div>
                        <p className="text-xs sm:text-sm opacity-90 mb-1">Total Views</p>
                        <p className="text-2xl sm:text-3xl md:text-4xl font-bold">
                          {publishedPosts.reduce((sum: number, post: PostType) => sum + (post.views || 0), 0).toLocaleString()}
                        </p>
                        <p className="text-xs sm:text-sm opacity-75 mt-1 sm:mt-2">
                          All time
                        </p>
                      </div>

                      {/* Total Likes */}
                      <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 text-white">
                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                          <div className="p-2 sm:p-2.5 bg-white/20 rounded-lg">
                            <Heart className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 opacity-80" />
                        </div>
                        <p className="text-xs sm:text-sm opacity-90 mb-1">Total Likes</p>
                        <p className="text-2xl sm:text-3xl md:text-4xl font-bold">
                          {analyticsData.blogs?.reduce((sum: number, blog: any) => sum + (blog.likesCount || 0), 0) || 
                           publishedPosts.reduce((sum: number, post: PostType) => sum + (post.likesCount || post.likes || 0), 0).toLocaleString()}
                        </p>
                        <p className="text-xs sm:text-sm opacity-75 mt-1 sm:mt-2">
                          Across all posts
                        </p>
                      </div>

                      {/* Total Comments */}
                      <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 text-white">
                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                          <div className="p-2 sm:p-2.5 bg-white/20 rounded-lg">
                            <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 opacity-80" />
                        </div>
                        <p className="text-xs sm:text-sm opacity-90 mb-1">Total Comments</p>
                        <p className="text-2xl sm:text-3xl md:text-4xl font-bold">
                          {analyticsData.blogs?.reduce((sum: number, blog: any) => sum + (blog.commentsCount || 0), 0) || 
                           publishedPosts.reduce((sum: number, post: PostType) => sum + (post.commentsCount || post.comments || 0), 0).toLocaleString()}
                        </p>
                        <p className="text-xs sm:text-sm opacity-75 mt-1 sm:mt-2">
                          User engagement
                        </p>
                      </div>
                    </div>

                    {/* Charts Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                      {/* Engagement Distribution Chart */}
                      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 md:p-8">
                        <div className="flex items-center justify-between mb-4 sm:mb-6">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="p-2 sm:p-2.5 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg">
                              <Target className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                            </div>
                            <h3 className="text-lg sm:text-xl font-bold text-gray-900">Engagement Distribution</h3>
                          </div>
                        </div>
                        {(() => {
                          const totalLikes = analyticsData.blogs?.reduce((sum: number, blog: any) => sum + (blog.likesCount || 0), 0) || 
                                            publishedPosts.reduce((sum: number, post: PostType) => sum + (post.likesCount || post.likes || 0), 0);
                          const totalComments = analyticsData.blogs?.reduce((sum: number, blog: any) => sum + (blog.commentsCount || 0), 0) || 
                                               publishedPosts.reduce((sum: number, post: PostType) => sum + (post.commentsCount || post.comments || 0), 0);
                          const totalViews = publishedPosts.reduce((sum: number, post: PostType) => sum + (post.views || 0), 0);
                          const total = totalLikes + totalComments + totalViews;
                          const likesPercent = total > 0 ? (totalLikes / total) * 100 : 0;
                          const commentsPercent = total > 0 ? (totalComments / total) * 100 : 0;
                          const viewsPercent = total > 0 ? (totalViews / total) * 100 : 0;
                          
                          return (
                            <div className="space-y-4">
                              {/* Donut Chart */}
                              <div className="relative w-full h-48 sm:h-56 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
                                  <circle
                                    cx="100"
                                    cy="100"
                                    r="80"
                                    fill="none"
                                    stroke="#e5e7eb"
                                    strokeWidth="20"
                                  />
                                  <circle
                                    cx="100"
                                    cy="100"
                                    r="80"
                                    fill="none"
                                    stroke="#ec4899"
                                    strokeWidth="20"
                                    strokeDasharray={`${likesPercent * 5.026} 502.6`}
                                    strokeDashoffset="0"
                                    className="transition-all duration-1000"
                                  />
                                  <circle
                                    cx="100"
                                    cy="100"
                                    r="80"
                                    fill="none"
                                    stroke="#3b82f6"
                                    strokeWidth="20"
                                    strokeDasharray={`${commentsPercent * 5.026} 502.6`}
                                    strokeDashoffset={`-${likesPercent * 5.026}`}
                                    className="transition-all duration-1000"
                                  />
                                  <circle
                                    cx="100"
                                    cy="100"
                                    r="80"
                                    fill="none"
                                    stroke="#8b5cf6"
                                    strokeWidth="20"
                                    strokeDasharray={`${viewsPercent * 5.026} 502.6`}
                                    strokeDashoffset={`-${(likesPercent + commentsPercent) * 5.026}`}
                                    className="transition-all duration-1000"
                                  />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="text-center">
                                    <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                                      {total.toLocaleString()}
                                    </p>
                                    <p className="text-xs sm:text-sm text-gray-500">Total</p>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Legend */}
                              <div className="space-y-2 sm:space-y-3">
                                <div className="flex items-center justify-between p-2 sm:p-3 bg-pink-50 rounded-lg">
                                  <div className="flex items-center gap-2 sm:gap-3">
                                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-pink-500"></div>
                                    <span className="text-sm sm:text-base font-medium text-gray-700">Likes</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-sm sm:text-base font-bold text-gray-900">{totalLikes.toLocaleString()}</span>
                                    <span className="text-xs text-gray-500 ml-2">{likesPercent.toFixed(1)}%</span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between p-2 sm:p-3 bg-blue-50 rounded-lg">
                                  <div className="flex items-center gap-2 sm:gap-3">
                                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-blue-500"></div>
                                    <span className="text-sm sm:text-base font-medium text-gray-700">Comments</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-sm sm:text-base font-bold text-gray-900">{totalComments.toLocaleString()}</span>
                                    <span className="text-xs text-gray-500 ml-2">{commentsPercent.toFixed(1)}%</span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between p-2 sm:p-3 bg-purple-50 rounded-lg">
                                  <div className="flex items-center gap-2 sm:gap-3">
                                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-purple-500"></div>
                                    <span className="text-sm sm:text-base font-medium text-gray-700">Views</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-sm sm:text-base font-bold text-gray-900">{totalViews.toLocaleString()}</span>
                                    <span className="text-xs text-gray-500 ml-2">{viewsPercent.toFixed(1)}%</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Performance Metrics with Progress Bars */}
                      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 md:p-8">
                        <div className="flex items-center justify-between mb-4 sm:mb-6">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="p-2 sm:p-2.5 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg">
                              <Award className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                            </div>
                            <h3 className="text-lg sm:text-xl font-bold text-gray-900">Performance Metrics</h3>
                          </div>
                        </div>
                        {(() => {
                          const totalViews = publishedPosts.reduce((sum: number, post: PostType) => sum + (post.views || 0), 0);
                          const totalLikes = analyticsData.blogs?.reduce((sum: number, blog: any) => sum + (blog.likesCount || 0), 0) || 
                                            publishedPosts.reduce((sum: number, post: PostType) => sum + (post.likesCount || post.likes || 0), 0);
                          const totalComments = analyticsData.blogs?.reduce((sum: number, blog: any) => sum + (blog.commentsCount || 0), 0) || 
                                               publishedPosts.reduce((sum: number, post: PostType) => sum + (post.commentsCount || post.comments || 0), 0);
                          const totalPosts = analyticsData.blogs?.length || publishedPosts.length || 1;
                          const avgViews = totalPosts > 0 ? (totalViews / totalPosts) : 0;
                          const avgLikes = totalPosts > 0 ? (totalLikes / totalPosts) : 0;
                          const avgComments = totalPosts > 0 ? (totalComments / totalPosts) : 0;
                          
                          // Normalize for progress bars (assuming max values)
                          const maxViews = Math.max(avgViews, 100);
                          const maxLikes = Math.max(avgLikes, 50);
                          const maxComments = Math.max(avgComments, 20);
                          
                          return (
                            <div className="space-y-4 sm:space-y-5">
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm sm:text-base font-medium text-gray-700">Avg. Views per Post</span>
                                  <span className="text-sm sm:text-base font-bold text-gray-900">{Math.round(avgViews).toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3 sm:h-4 overflow-hidden">
                                  <div
                                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-1000 ease-out"
                                    style={{ width: `${Math.min((avgViews / maxViews) * 100, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                              
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm sm:text-base font-medium text-gray-700">Avg. Likes per Post</span>
                                  <span className="text-sm sm:text-base font-bold text-gray-900">{avgLikes.toFixed(1)}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3 sm:h-4 overflow-hidden">
                                  <div
                                    className="bg-gradient-to-r from-pink-500 to-pink-600 h-full rounded-full transition-all duration-1000 ease-out"
                                    style={{ width: `${Math.min((avgLikes / maxLikes) * 100, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                              
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm sm:text-base font-medium text-gray-700">Avg. Comments per Post</span>
                                  <span className="text-sm sm:text-base font-bold text-gray-900">{avgComments.toFixed(1)}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3 sm:h-4 overflow-hidden">
                                  <div
                                    className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full rounded-full transition-all duration-1000 ease-out"
                                    style={{ width: `${Math.min((avgComments / maxComments) * 100, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                              
                              <div className="pt-3 sm:pt-4 border-t border-gray-200">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm sm:text-base font-medium text-gray-700">Engagement Rate</span>
                                  <span className="text-lg sm:text-xl font-bold text-purple-600">
                                    {totalPosts > 0 ? (((totalLikes + totalComments) / (totalPosts * 10)) * 100).toFixed(1) : '0'}%
                                  </span>
                                </div>
                                <div className="mt-2 w-full bg-gray-200 rounded-full h-3 sm:h-4 overflow-hidden">
                                  <div
                                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-1000 ease-out"
                                    style={{ width: `${Math.min(totalPosts > 0 ? ((totalLikes + totalComments) / (totalPosts * 10)) * 100 : 0, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Top Posts Bar Chart */}
                    <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 md:p-8">
                      <div className="flex items-center justify-between mb-4 sm:mb-6">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="p-2 sm:p-2.5 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-lg">
                            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                          </div>
                          <h3 className="text-lg sm:text-xl font-bold text-gray-900">Top Posts Performance</h3>
                        </div>
                      </div>
                      {(() => {
                        const postsWithMetrics = publishedPosts.map((post: PostType) => {
                          const blogData = analyticsData.blogs?.find((b: any) => b._id === post._id);
                          const views = post.views || 0;
                          const likes = blogData?.likesCount || post.likesCount || post.likes || 0;
                          const comments = blogData?.commentsCount || post.commentsCount || post.comments || 0;
                          const engagement = views + likes + comments;
                          return { ...post, views, likes, comments, engagement };
                        }).sort((a, b) => b.engagement - a.engagement).slice(0, 5);

                        if (postsWithMetrics.length === 0) {
                          return (
                            <div className="text-center py-8 sm:py-12">
                              <BarChart3 className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
                              <p className="text-sm sm:text-base text-gray-600">No published posts yet to analyze</p>
                            </div>
                          );
                        }

                        const maxEngagement = Math.max(...postsWithMetrics.map((p: any) => p.engagement), 1);

                        return (
                          <div className="space-y-4 sm:space-y-5">
                            {postsWithMetrics.map((post: any, index: number) => (
                              <div key={post._id} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                    <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-xs sm:text-sm">
                                      {index + 1}
                                    </div>
                                    <h4 className="text-xs sm:text-sm md:text-base font-semibold text-gray-900 truncate">
                                      {post.title}
                                    </h4>
                                  </div>
                                  <span className="text-xs sm:text-sm font-bold text-gray-900 ml-2">
                                    {post.engagement.toLocaleString()}
                                  </span>
                                </div>
                                <div className="relative w-full bg-gray-200 rounded-full h-4 sm:h-5 overflow-hidden">
                                  <div
                                    className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 h-full rounded-full transition-all duration-1000 ease-out"
                                    style={{ width: `${(post.engagement / maxEngagement) * 100}%` }}
                                  ></div>
                                </div>
                                <div className="flex items-center gap-3 sm:gap-4 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Eye className="w-3 h-3 text-blue-600" />
                                    {post.views.toLocaleString()}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Heart className="w-3 h-3 text-red-600" />
                                    {post.likes.toLocaleString()}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MessageCircle className="w-3 h-3 text-indigo-600" />
                                    {post.comments.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Top Performing Posts - Enhanced */}
                    <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 md:p-8">
                      <div className="flex items-center justify-between mb-4 sm:mb-6">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="p-2 sm:p-2.5 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-lg">
                            <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                          </div>
                          <h3 className="text-lg sm:text-xl font-bold text-gray-900">Top Performing Posts</h3>
                        </div>
                        <button
                          onClick={loadAnalytics}
                          disabled={analyticsLoading}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Refresh analytics"
                        >
                          <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-600 ${analyticsLoading ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                      <div className="space-y-3 sm:space-y-4">
                        {(() => {
                          const postsWithMetrics = publishedPosts.map((post: PostType) => {
                            const blogData = analyticsData.blogs?.find((b: any) => b._id === post._id);
                            const views = post.views || 0;
                            const likes = blogData?.likesCount || post.likesCount || post.likes || 0;
                            const comments = blogData?.commentsCount || post.commentsCount || post.comments || 0;
                            const engagement = views + likes + comments;
                            return { ...post, views, likes, comments, engagement };
                          }).sort((a, b) => b.engagement - a.engagement).slice(0, 5);

                          if (postsWithMetrics.length === 0) {
                            return (
                              <div className="text-center py-8 sm:py-12">
                                <BarChart3 className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
                                <p className="text-sm sm:text-base text-gray-600">No published posts yet to analyze</p>
                              </div>
                            );
                          }

                          const maxEngagement = Math.max(...postsWithMetrics.map((p: any) => p.engagement), 1);

                          return postsWithMetrics.map((post: any, index: number) => {
                            const medalColors = [
                              'from-yellow-400 to-yellow-600',
                              'from-gray-300 to-gray-500',
                              'from-orange-400 to-orange-600',
                              'from-purple-400 to-purple-600',
                              'from-pink-400 to-pink-600'
                            ];
                            
                            return (
                              <div
                                key={post._id}
                                className="group p-3 sm:p-4 bg-gradient-to-r from-white to-gray-50 rounded-lg sm:rounded-xl hover:shadow-lg transition-all border border-gray-200 hover:border-purple-300"
                              >
                                <div className="flex items-start gap-3 sm:gap-4">
                                  <div className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br ${medalColors[index]} rounded-xl flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-lg`}>
                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 mb-2 sm:mb-3 line-clamp-2 group-hover:text-purple-600 transition-colors">
                                      {post.title}
                                    </h4>
                                    
                                    {/* Mini Bar Chart */}
                                    <div className="mb-2 sm:mb-3">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs text-gray-500">Engagement</span>
                                        <span className="text-xs font-bold text-purple-600">{post.engagement.toLocaleString()}</span>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                        <div
                                          className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 h-full rounded-full transition-all duration-1000 ease-out"
                                          style={{ width: `${(post.engagement / maxEngagement) * 100}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                    
                                    {/* Metrics Grid */}
                                    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-2">
                                      <div className="flex items-center gap-1.5 p-2 bg-blue-50 rounded-lg">
                                        <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
                                        <div className="min-w-0">
                                          <p className="text-xs text-gray-500">Views</p>
                                          <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">{post.views.toLocaleString()}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 p-2 bg-pink-50 rounded-lg">
                                        <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600 flex-shrink-0" />
                                        <div className="min-w-0">
                                          <p className="text-xs text-gray-500">Likes</p>
                                          <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">{post.likes.toLocaleString()}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 p-2 bg-indigo-50 rounded-lg">
                                        <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 flex-shrink-0" />
                                        <div className="min-w-0">
                                          <p className="text-xs text-gray-500">Comments</p>
                                          <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">{post.comments.toLocaleString()}</p>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                      <Clock className="w-3 h-3" />
                                      <span>{formatDate(post.createdAt)}</span>
                                    </div>
                                  </div>
                                  <a
                                    href={`${getBaseUrl()}/blogs/${post.paramlink}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-shrink-0 p-2 hover:bg-purple-100 rounded-lg transition-colors group/link"
                                    title="View post"
                                  >
                                    <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 group-hover/link:text-purple-600" />
                                  </a>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* Recent Activity - Enhanced */}
                    <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 md:p-8">
                      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                        <div className="p-2 sm:p-2.5 bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg">
                          <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900">Recent Activity Timeline</h3>
                      </div>
                      <div className="space-y-3 sm:space-y-4">
                        {(() => {
                          const recentPosts = publishedPosts
                            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                            .slice(0, 5);

                          if (recentPosts.length === 0) {
                            return (
                              <div className="text-center py-8 sm:py-12">
                                <Calendar className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
                                <p className="text-sm sm:text-base text-gray-600">No recent activity</p>
                              </div>
                            );
                          }

                          return recentPosts.map((post: PostType, index: number) => {
                            const blogData = analyticsData.blogs?.find((b: any) => b._id === post._id);
                            const engagement = (blogData?.likesCount || post.likesCount || post.likes || 0) + 
                                             (blogData?.commentsCount || post.commentsCount || post.comments || 0);
                            
                            return (
                              <div
                                key={post._id}
                                className="relative flex items-start gap-3 sm:gap-4 pl-6 sm:pl-8"
                              >
                                {/* Timeline Line */}
                                {index < recentPosts.length - 1 && (
                                  <div className="absolute left-3 sm:left-4 top-8 sm:top-10 w-0.5 h-full bg-gradient-to-b from-purple-200 to-pink-200"></div>
                                )}
                                
                                {/* Timeline Dot */}
                                <div className="absolute left-2 sm:left-3 top-2 sm:top-3 w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full border-2 border-white shadow-lg z-10"></div>
                                
                                {/* Content Card */}
                                <div className="flex-1 p-3 sm:p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg sm:rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all">
                                  <div className="flex items-start justify-between gap-2 sm:gap-3">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm sm:text-base font-semibold text-gray-900 truncate mb-1 sm:mb-2">
                                        {post.title}
                                      </p>
                                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-500 mb-2">
                                        <span className="flex items-center gap-1">
                                          <Clock className="w-3 h-3" />
                                          {formatDate(post.createdAt)}
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Eye className="w-3 h-3 text-blue-600" />
                                          {post.views || 0}
                                        </span>
                                      </div>
                                      
                                      {/* Mini Engagement Bars */}
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-gray-200 rounded-full h-1.5 sm:h-2 overflow-hidden">
                                          <div
                                            className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full"
                                            style={{ width: `${Math.min((engagement / 100) * 100, 100)}%` }}
                                          ></div>
                                        </div>
                                        <span className="text-xs font-semibold text-purple-600 whitespace-nowrap">
                                          {engagement} pts
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <div className="flex flex-col items-end gap-1">
                                      <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-100 rounded-lg">
                                        <Activity className="w-3 h-3 text-purple-600" />
                                        <span className="text-xs font-bold text-purple-600">{engagement}</span>
                                      </div>
                                      <p className="text-xs text-gray-500">engagement</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-6 sm:p-8 md:p-12 text-center">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-purple-400 to-pink-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <BarChart3 className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No Analytics Data</h3>
                    <p className="text-sm sm:text-base text-gray-600 mb-4">Start publishing posts to see analytics.</p>
                    {permissions.canCreate && (
                      <button
                        onClick={handleCreatePost}
                        className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold shadow-lg hover:shadow-xl transition-all"
                      >
                        Create Your First Post
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {filteredPosts.length === 0 && (
              <div className="text-center py-12 sm:py-16 md:py-20">
                <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-gradient-to-br from-purple-400 to-pink-400 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-white" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No posts yet</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 px-4">Start creating amazing content!</p>
                {permissions.canCreate && (
                  <button
                    onClick={handleCreatePost}
                    className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold shadow-lg hover:shadow-xl transition-all"
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
          onSave={() => {
            // Reload posts to get fresh data from API
            loadPosts();
          }}
        />
      )}

      {/* Comments Modal */}
      {showCommentsModal && selectedPostForComments && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] sm:max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 md:p-6 border-b border-gray-200">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Comments</h2>
              <button
                onClick={() => {
                  setShowCommentsModal(false);
                  setSelectedPostForComments(null);
                  setNewComment('');
                }}
                className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
              {selectedPostForComments.commentsArray && selectedPostForComments.commentsArray.length > 0 ? (
                selectedPostForComments.commentsArray.map((comment) => (
                  <div key={comment._id} className="bg-gray-50 rounded-lg p-3 sm:p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-semibold">
                            {comment.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">{comment.username}</p>
                          <p className="text-xs text-gray-500">
                            {formatDate(comment.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm sm:text-base text-gray-700 mb-2 break-words">{comment.text}</p>
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="mt-3 ml-2 sm:ml-4 space-y-2 border-l-2 border-purple-200 pl-3 sm:pl-4">
                        {comment.replies.map((reply) => (
                          <div key={reply._id} className="bg-white rounded p-2">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-semibold text-gray-700">{reply.username}</span>
                              <span className="text-xs text-gray-500">{formatDate(reply.createdAt)}</span>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-600 break-words">{reply.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 sm:py-12">
                  <MessageCircle className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
                  <p className="text-sm sm:text-base text-gray-600">No comments yet. Be the first to comment!</p>
                </div>
              )}
            </div>

            {/* Comment Input */}
            <div className="p-4 sm:p-5 md:p-6 border-t border-gray-200">
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
                  className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={() => handleAddComment(selectedPostForComments._id)}
                  disabled={commenting || !newComment.trim()}
                  className="px-4 sm:px-6 py-2 text-sm sm:text-base bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-lg w-full border border-gray-100 max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="relative p-4 sm:p-5 md:p-6 border-b border-gray-100 flex-shrink-0">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-t-xl sm:rounded-t-2xl"></div>
              <div className="flex items-center justify-between gap-2 sm:gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                    <LinkIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Edit Blog URL</h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1 hidden sm:block">Update title and URL slug</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowEditUrlModal(false);
                    setEditUrlPost(null);
                    setEditUrlError('');
                  }}
                  className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 hover:bg-red-100 rounded-lg sm:rounded-xl flex items-center justify-center transition-all duration-200 group flex-shrink-0"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 group-hover:text-red-600" />
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
              {/* Blog Title */}
              <div className="space-y-2">
                <label className="block text-xs sm:text-sm font-semibold text-gray-700">
                  Blog Title
                </label>
                <input
                  type="text"
                  value={editUrlTitle}
                  onChange={(e) => setEditUrlTitle(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-lg sm:rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-200 focus:border-purple-400 transition-all duration-200 bg-gray-50 hover:bg-white"
                  placeholder="Enter blog title..."
                />
              </div>

              {/* URL Preview */}
              <div className="space-y-2">
                <label className="block text-xs sm:text-sm font-semibold text-gray-700">
                  Blog URL Slug
                </label>
                <div className="border-2 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-3 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 overflow-x-auto">
                  <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm min-w-0">
                    <span className="text-gray-600 whitespace-nowrap flex-shrink-0">{getBaseUrl()}/blogs/</span>
                    <span className="font-mono font-semibold text-purple-700 truncate">
                      {editUrlParamlink || '...'}
                    </span>
                  </div>
                </div>
                <input
                  type="text"
                  value={editUrlParamlink}
                  onChange={(e) => setEditUrlParamlink(slugify(e.target.value))}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-lg sm:rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-200 focus:border-purple-400 transition-all duration-200 bg-gray-50 hover:bg-white"
                  placeholder="blog-url-slug"
                />
                {editUrlError && (
                  <div className="flex items-center gap-2 text-red-600 text-xs sm:text-sm mt-2 bg-red-50 p-2 sm:p-3 rounded-lg border border-red-200">
                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="break-words">{editUrlError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-4 sm:p-5 md:p-6 border-t border-gray-100 flex gap-2 sm:gap-3 flex-shrink-0">
              <button
                onClick={() => {
                  setShowEditUrlModal(false);
                  setEditUrlPost(null);
                  setEditUrlError('');
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUrl}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post Detail Modal - View Complete Post */}
      {showPostDetailModal && selectedPostDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl my-4 sm:my-6 md:my-8 flex flex-col max-h-[95vh] sm:max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 md:p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50 sticky top-0 z-10 flex-shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg sm:rounded-xl flex-shrink-0">
                  <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Post Preview</h2>
                  <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">View complete post content</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <a
                  href={`${getBaseUrl()}/blogs/${selectedPostDetail.paramlink}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 sm:p-2 hover:bg-blue-100 rounded-lg transition-colors"
                  title="Open in New Tab"
                >
                  <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </a>
                <button
                  onClick={() => {
                    setShowPostDetailModal(false);
                    setSelectedPostDetail(null);
                  }}
                  className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Post Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
              {/* Featured Image */}
              {extractFirstImage(selectedPostDetail.content) && (
                <div className="mb-4 sm:mb-6">
                  <img
                    src={extractFirstImage(selectedPostDetail.content) || ''}
                    alt={selectedPostDetail.title}
                    className="w-full h-48 sm:h-64 md:h-80 lg:h-96 object-cover rounded-xl sm:rounded-2xl shadow-lg"
                  />
                </div>
              )}

              {/* Title */}
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 break-words">
                {selectedPostDetail.title}
              </h1>

              {/* Author & Meta */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 pb-4 sm:pb-6 border-b border-gray-200">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                      {(() => {
                        if (!selectedPostDetail.postedBy) return 'Anonymous';
                        if (typeof selectedPostDetail.postedBy === 'string') return selectedPostDetail.postedBy;
                        return selectedPostDetail.postedBy.name || selectedPostDetail.postedBy.username || 'Anonymous';
                      })()}
                    </p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span>{formatDate(selectedPostDetail.createdAt)}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500">
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${selectedPostDetail.liked ? 'fill-current text-red-500' : ''}`} />
                    <span>{Number(selectedPostDetail.likesCount || selectedPostDetail.likes) || 0}</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>{Number(selectedPostDetail.commentsCount || selectedPostDetail.comments) || 0}</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>{Number(selectedPostDetail.views) || 0}</span>
                  </div>
                </div>
              </div>

              {/* Topics */}
              {extractTopics(selectedPostDetail.content).length > 0 && (
                <div className="mb-4 sm:mb-6 flex flex-wrap gap-1.5 sm:gap-2">
                  {extractTopics(selectedPostDetail.content).map((topic) => (
                    <span
                      key={topic}
                      className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-full text-xs sm:text-sm font-medium"
                    >
                      <Hash className="w-3 h-3" />
                      {topic}
                    </span>
                  ))}
                </div>
              )}

              {/* Full Content */}
              <div
                className="prose prose-sm sm:prose-base md:prose-lg max-w-none text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: selectedPostDetail.content }}
                style={{
                  wordBreak: 'break-word',
                }}
              />

              {/* Actions Footer */}
              <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <button
                    onClick={() => handleLike(selectedPostDetail._id)}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all ${
                      selectedPostDetail.liked
                        ? 'bg-red-50 text-red-600 border-2 border-red-200'
                        : 'bg-gray-50 text-gray-600 border-2 border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                    }`}
                  >
                    <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${selectedPostDetail.liked ? 'fill-current' : ''}`} />
                    <span>{Number(selectedPostDetail.likesCount || selectedPostDetail.likes) || 0}</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowPostDetailModal(false);
                      openCommentsModal(selectedPostDetail);
                    }}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-50 text-gray-600 border-2 border-gray-200 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all"
                  >
                    <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>{Number(selectedPostDetail.commentsCount || selectedPostDetail.comments) || 0}</span>
                  </button>
                  <div className="p-0">
                    <SocialMediaShare
                      blogTitle={selectedPostDetail.title}
                      blogUrl={`${getBaseUrl()}/blogs/${selectedPostDetail.paramlink}`}
                      blogDescription={extractText(selectedPostDetail.content, 200)}
                      triggerClassName="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-50 text-gray-600 border-2 border-gray-200 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 transition-all"
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
                      className="px-3 sm:px-4 py-1.5 sm:py-2 bg-purple-50 text-purple-600 border-2 border-purple-200 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium hover:bg-purple-100 transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1.5 sm:mr-2" />
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

