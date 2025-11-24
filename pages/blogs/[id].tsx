import React from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { GetServerSideProps } from "next";
import { useEffect, useState, useRef } from "react";
import parse from "html-react-parser";
import { useAuth } from "@/context/AuthContext";
import AuthModal from "../../components/AuthModal";
import SocialMediaShare from "../../components/SocialMediaShare";
import { Toaster, toast } from "react-hot-toast";
import dbConnect from "../../lib/database";
import BlogModel from "../../models/Blog";

declare module 'react' {
  interface StyleHTMLAttributes<T> extends React.HTMLAttributes<T> {
    jsx?: boolean;
    global?: boolean;
  }
}

interface BlogDoc {
  _id: string;
  title: string;
  content: string;
  status: "draft" | "published";
  paramlink: string;
  postedBy: {
    _id: string;
    name: string;
  };
  role: "clinic" | "doctor";
  likes: string[];
  comments: unknown[];
  createdAt: string;
  updatedAt: string;
  image?: string;
}

type BlogReply = {
  _id: string;
  username: string;
  text: string;
  createdAt: string;
  user?: string | null;
};

type BlogComment = {
  _id: string;
  username: string;
  text: string;
  createdAt: string;
  user?: string | null;
  replies?: BlogReply[];
};

type Blog = {
  _id: string;
  title: string;
  content: string;
  postedBy: { name: string; _id?: string | null };
  createdAt: string;
  image?: string;
  likesCount: number;
  liked?: boolean;
  comments: BlogComment[];
  paramlink?: string | null;
};

type SeoMeta = {
  title: string;
  description: string;
  image: string;
  url: string;
};

interface BlogDetailProps {
  initialBlog: Blog | null;
  seo: SeoMeta | null;
}

export default function BlogDetail({ initialBlog, seo }: BlogDetailProps) {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const { user, isAuthenticated } = useAuth();

  const [blog, setBlog] = useState<Blog | null>(initialBlog);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register" | undefined>("login");
  const [replyTexts, setReplyTexts] = useState<{ [commentId: string]: string }>(
    {}
  );

  // Track pending actions after login
  const shouldLikeAfterLogin = useRef(false);
  const shouldCommentAfterLogin = useRef(false);
  const pendingComment = useRef("");
  const [showAllComments, setShowAllComments] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [expandedReplies, setExpandedReplies] = useState<{
    [commentId: string]: boolean;
  }>({});
  const [showReplyInput, setShowReplyInput] = useState<{
    [commentId: string]: boolean;
  }>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Utility to get base URL
  const getBaseUrl = () => {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "https://zeva360.com";
  };
  const toggleCommentExpansion = (commentId: string) => {
    setExpandedComments((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  const isLongComment = (text: string) => {
    return text.split("\n").length > 4;
  };

  const truncateComment = (text: string, isExpanded: boolean) => {
    const lines = text.split("\n");
    if (!isExpanded && lines.length > 4) {
      return lines.slice(0, 4).join("\n");
    }
    return text;
  };

  // Compute share URL
  const shareUrl = blog
    ? `${getBaseUrl()}/blogs/${blog.paramlink || blog._id}`
    : "";

  // Client-side fetch only if not provided by SSR (shouldn't typically happen)
  useEffect(() => {
    if (blog || !id) return;
    const token = localStorage.getItem("token");
    fetch(`/api/blog/getBlogById?id=${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setBlog(json.blog);
        else setError(json.error || "Failed to fetch blog");
      })
      .catch(() => {
        setError("Network error");
        toast.error("Network error while fetching blog");
      });
  }, [id, blog]);

  // Retry actions if user logged in after showing modal
  useEffect(() => {
    if (isAuthenticated) {
      if (shouldLikeAfterLogin.current) {
        shouldLikeAfterLogin.current = false;
        performToggleLike();
      }
      if (shouldCommentAfterLogin.current) {
        shouldCommentAfterLogin.current = false;
        setNewComment(pendingComment.current);
        performSubmitComment(pendingComment.current);
        pendingComment.current = "";
      }
    }
  }, [isAuthenticated]);

  // Like handler with auth check
  async function toggleLike() {
    if (!isAuthenticated) {
      setAuthModalMode("login");
      setShowAuthModal(true);
      shouldLikeAfterLogin.current = true;
      toast("Please login to like this post", { icon: "🔐" });
      return;
    }

    await performToggleLike();
  }

  // Actual like functionality
  async function performToggleLike() {
    if (!id) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/blog/likeBlog", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ blogId: id }),
      });
      const json = await res.json();
      if (json.success && blog) {
        setBlog({
          ...blog,
          likesCount: json.likesCount,
          liked: json.liked,
        });
        if (json.liked) {
          toast.success("Added to likes");
        } else {
          toast("Removed like", { icon: "💔" });
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update like");
    }
  }

  // Comment handler with auth check
  async function submitComment() {
    if (!newComment.trim()) return;

    if (!isAuthenticated) {
      setAuthModalMode("login");
      setShowAuthModal(true);
      shouldCommentAfterLogin.current = true;
      pendingComment.current = newComment;
      toast("Please login to comment", { icon: "🔐" });
      return;
    }

    await performSubmitComment(newComment);
  }

  // Actual comment functionality
  async function performSubmitComment(commentText: string) {
    if (!id || !commentText.trim()) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/blog/addComment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ blogId: id, text: commentText }),
      });
      const json = await res.json();
      if (json.success && json.comment && blog) {
        // Add the new comment to existing comments
        const newComment: BlogComment = {
          _id: json.comment._id,
          username: json.comment.username,
          text: json.comment.text,
          createdAt: json.comment.createdAt,
          user: json.comment.user,
          replies: json.comment.replies || [],
        };

        setBlog({
          ...blog,
          comments: [...blog.comments, newComment],
        });
        setNewComment("");
        toast.success("Comment posted");
      } else {
        console.error("Failed to add comment:", json.error);
        toast.error(json.error || "Failed to add comment");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while adding comment");
    }
  }

  async function performDelete(commentId: string) {
    try {
      const token = localStorage.getItem("token");
      await toast.promise(
        fetch("/api/blog/deleteComment", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ blogId: blog?._id, commentId }),
        }).then((res) => res.json()),
        {
          loading: "Deleting...",
          success: (json) => {
            if (!json.success) throw new Error(json.error || "Failed to delete");
            setBlog((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                comments: prev.comments
                  .map((c) => {
                    if (c._id === commentId) return null;
                    return {
                      ...c,
                      replies: c.replies?.filter((r) => r._id !== commentId),
                    };
                  })
                  .filter(Boolean) as typeof prev.comments,
              };
            });
            return "Comment deleted";
          },
          error: (err) => err.message || "Failed to delete",
        }
      );
    } catch (err) {
      console.error(err);
    } finally {
      setConfirmDeleteId(null);
    }
  }

  // Handle reply submission
  async function handleReplySubmit(commentId: string) {
    const replyText = replyTexts[commentId];
    if (!replyText?.trim()) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/blog/addReply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          blogId: blog?._id,
          commentId: commentId,
          text: replyText,
        }),
      });
      const json = await res.json();
      if (json.success) {
        // Fetch latest replies for this comment
        const res2 = await fetch(
          `/api/blog/getCommentReplies?blogId=${blog?._id}&commentId=${commentId}`
        );
        const json2 = await res2.json();
        setBlog((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            comments: prev.comments.map((comment) =>
              comment._id === commentId
                ? { ...comment, replies: json2.replies || [] }
                : comment
            ),
          };
        });
        setReplyTexts((prev) => ({ ...prev, [commentId]: "" }));
        setShowReplyInput((prev) => ({ ...prev, [commentId]: false }));
        setExpandedReplies((prev) => ({ ...prev, [commentId]: true }));
        toast.success("Reply added");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to add reply");
    }
  }

  if (error) return <p>Error: {error}</p>;
  if (!blog) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="relative mb-8">
        {/* Animated circles */}
        <div className="flex space-x-2">
          <div
            className="w-4 h-4 rounded-full animate-bounce"
            style={{
              backgroundColor: '#2D9AA5',
              animationDelay: '0ms',
              animationDuration: '1200ms'
            }}
          ></div>
          <div
            className="w-4 h-4 rounded-full animate-bounce"
            style={{
              backgroundColor: '#2D9AA5',
              animationDelay: '200ms',
              animationDuration: '1200ms'
            }}
          ></div>
          <div
            className="w-4 h-4 rounded-full animate-bounce"
            style={{
              backgroundColor: '#2D9AA5',
              animationDelay: '400ms',
              animationDuration: '1200ms'
            }}
          ></div>
        </div>

        {/* Pulsing ring */}
        <div
          className="absolute -top-2 -left-2 w-8 h-8 rounded-full animate-ping opacity-20"
          style={{ backgroundColor: '#2D9AA5' }}
        ></div>
      </div>

      {/* Loading text */}
      <div className="text-center">
        <h2
          className="text-2xl font-bold mb-2"
          style={{ color: '#2D9AA5' }}
        >
          Loading Blog
        </h2>
        <p className="text-slate-600 animate-pulse">
          Getting your content ready...
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-violet-50">
      <Toaster position="top-right" gutter={8} />
      {seo && (
        <Head>
          <title>{seo.title}</title>
          <meta name="description" content={seo.description} />
          <meta property="og:type" content="article" />
          <meta property="og:title" content={seo.title} />
          <meta property="og:description" content={seo.description} />
          <meta property="og:image" content={seo.image} />
          <meta property="og:url" content={seo.url} />
          <meta property="og:site_name" content="Global Ayurveda" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={seo.title} />
          <meta name="twitter:description" content={seo.description} />
          <meta name="twitter:image" content={seo.image} />
          <link rel="stylesheet" href="https://cdn.quilljs.com/1.3.6/quill.snow.css" />
        </Head>
      )}

      <style jsx global>{`
      .blog-container {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
        line-height: 1.7;
        color: #2c3e50;
      }

      .blog-content img,
.blog-content video,
.blog-content iframe,
.blog-content embed,
.blog-content object,
.blog-content * img,
.blog-content * video,
.blog-content * iframe,
.blog-content * embed,
.blog-content * object {
  display: block !important;
  margin: 2.5rem auto !important;
  width: 100% !important;
  max-width: 700px !important;
  height: 400px !important;
  object-fit: contain !important; /* ✅ show full image, no cropping */
  border-radius: 16px !important;
  box-shadow: 0 20px 60px rgba(139, 92, 246, 0.15), 0 8px 24px rgba(139, 92, 246, 0.08) !important;
  border: 1px solid rgba(167, 139, 250, 0.2) !important;
  transition: all 0.4s ease !important;
  background-color: #f9f9ff !important; /* optional: adds background around image */
}


      

      .blog-content iframe[src*="youtube"],
      .blog-content iframe[src*="youtu.be"],
      .blog-content iframe[src*="drive.google"],
      .blog-content iframe[src*="docs.google"],
      .blog-content iframe[src*="googleapis"],
      .blog-content iframe[src*="embed"],
      .blog-content iframe[title*="YouTube"],
      .blog-content iframe[title*="Google Drive"],
      .blog-content *[src*="youtube"],
      .blog-content *[src*="youtu.be"],
      .blog-content *[src*="drive.google"],
      .blog-content *[src*="docs.google"] {
        display: block !important;
        margin: 2.5rem auto !important;
        width: 100% !important;
        max-width: 700px !important;
        height: 400px !important;
        border-radius: 16px !important;
        border: none !important;
        box-shadow: 0 20px 60px rgba(139, 92, 246, 0.15), 0 8px 24px rgba(139, 92, 246, 0.08) !important;
        transition: all 0.4s ease !important;
      }

      .blog-content *:has(iframe[src*="youtube"]),
      .blog-content *:has(iframe[src*="youtu.be"]),
      .blog-content *:has(iframe[src*="drive.google"]),
      .blog-content *:has(iframe[src*="docs.google"]),
      .blog-content *:has(*[src*="youtube"]),
      .blog-content *:has(*[src*="youtu.be"]),
      .blog-content *:has(*[src*="drive.google"]) {
        text-align: center !important;
        display: block !important;
        width: 100% !important;
      }

      .blog-content .video-wrapper,
      .blog-content .embed-responsive,
      .blog-content .youtube-embed,
      .blog-content .video-embed,
      .blog-content .iframe-wrapper {
        text-align: center !important;
        display: block !important;
        width: 100% !important;
      }

      .blog-content .ql-align-center { text-align: center !important; }
      .blog-content .ql-align-right { text-align: right !important; }
      .blog-content .ql-align-justify { text-align: justify !important; }
      .blog-content .ql-align-left { text-align: left !important; }

      .blog-content p {
        margin-bottom: 1.8rem;
        font-size: 1.125rem;
        color: #374151;
        line-height: 1.8;
      }

      .blog-content h1,
      .blog-content h2,
      .blog-content h3,
      .blog-content h4 {
        color: #1f2937;
        font-weight: 700;
        margin-top: 3rem;
        margin-bottom: 1.5rem;
        line-height: 1.3;
      }

      .blog-content h1 { font-size: 2.5rem; }
      .blog-content h2 { font-size: 2rem; color: #7c3aed; }
      .blog-content h3 { font-size: 1.5rem; }

      .blog-content blockquote {
        border-left: 4px solid #7c3aed;
        background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
        padding: 1.5rem 2rem;
        margin: 2rem 0;
        font-style: italic;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(124, 58, 237, 0.1);
      }

      .blog-content ul,
      .blog-content ol {
        margin: 1.5rem 0;
        padding-left: 2rem;
        list-style-position: outside;
      }

      .blog-content li {
        margin-bottom: 0.5rem;
        color: #374151;
      }

      .blog-content ul { list-style-type: disc; }
      .blog-content ol { list-style-type: decimal; }
      .blog-content ul ul { list-style-type: circle; }
      .blog-content ul ul ul { list-style-type: square; }

      .blog-content .ql-size-small { font-size: 0.875rem; }
      .blog-content .ql-size-large { font-size: 1.5rem; }
      .blog-content .ql-size-huge { font-size: 2.25rem; }

      .blog-content .ql-font-serif { font-family: Georgia, Cambria, "Times New Roman", Times, serif; }
      .blog-content .ql-font-monospace { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
      .blog-content .ql-font-sans { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif; }

      @media (max-width: 768px) {
        .blog-content img,
        .blog-content video,
        .blog-content iframe,
        .blog-content embed,
        .blog-content object,
        .blog-content * img,
        .blog-content * video,
        .blog-content * iframe,
        .blog-content * embed,
        .blog-content * object,
        .blog-content iframe[src*="youtube"],
        .blog-content iframe[src*="youtu.be"],
        .blog-content iframe[src*="drive.google"],
        .blog-content *[src*="youtube"],
        .blog-content *[src*="youtu.be"],
        .blog-content *[src*="drive.google"] {
          max-width: 100% !important;
          height: 300px !important;
          margin: 1.5rem auto !important;
        }
        .blog-content p { font-size: 1rem; }
        .blog-content h1 { font-size: 2rem; }
        .blog-content h2 { font-size: 1.75rem; }
      }

      @media (max-width: 640px) {
        .blog-content img,
        .blog-content video,
        .blog-content iframe,
        .blog-content embed,
        .blog-content object,
        .blog-content * img,
        .blog-content * video,
        .blog-content * iframe,
        .blog-content * embed,
        .blog-content * object,
        .blog-content iframe[src*="youtube"],
        .blog-content iframe[src*="youtu.be"],
        .blog-content iframe[src*="drive.google"],
        .blog-content *[src*="youtube"],
        .blog-content *[src*="youtu.be"],
        .blog-content *[src*="drive.google"] {
          height: 250px !important;
        }
      }

      .blog-container::-webkit-scrollbar { width: 8px; }
      .blog-container::-webkit-scrollbar-track { background: #f8fafc; border-radius: 4px; }
      .blog-container::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #7c3aed 0%, #6d28d9 100%); border-radius: 4px; }
      .blog-container::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, #6d28d9 0%, #5b21b6 100%); }

      @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-4px); }
      }

      .floating { animation: float 3s ease-in-out infinite; }

      @keyframes pulse-ring {
        0% { transform: scale(0.8); }
        40%, 50% { opacity: 0; }
        100% { opacity: 0; transform: scale(1.2); }
      }

      .pulse-ring::before {
        content: "";
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 100%;
        height: 100%;
        border-radius: inherit;
        background: currentColor;
        opacity: 0.2;
        animation: pulse-ring 2s ease-out infinite;
      }
    `}</style>

      <div className="blog-container">
        {/* Hero Section */}
        <div className="relative bg-white">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 via-indigo-50/30 to-violet-50/50"></div>
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
            {blog.image && (
              <div className="relative mb-8 sm:mb-12 lg:mb-16 rounded-2xl sm:rounded-3xl shadow-2xl bg-gradient-to-br from-purple-50 to-indigo-50 p-4 sm:p-6">
                <img
                  src={blog.image}
                  alt={blog.title}
                  className="w-full h-auto max-h-[400px] sm:max-h-[500px] lg:max-h-[600px] object-contain mx-auto"
                />
                <div className="absolute top-6 sm:top-8 right-6 sm:right-8 z-20">
                  <div className="backdrop-blur-md bg-white/20 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-white text-xs sm:text-sm font-medium border border-white/30 floating">
                    <span className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
                      <span>Featured Article</span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Article Header */}
            <div className="max-w-4xl mx-auto text-center mb-8 sm:mb-12 lg:mb-16">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8 text-gray-900 leading-tight tracking-tight px-4">
                {blog.title}
              </h1>

              <div className="flex flex-col sm:flex-row items-center justify-center sm:space-x-6 lg:space-x-8 space-y-4 sm:space-y-0 text-gray-600 mb-8 sm:mb-12 px-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-lg">
                    {blog.postedBy?.name?.charAt(0).toUpperCase() || "A"}
                  </div>
                  <div className="text-left">
                    <span className="font-semibold text-gray-900 text-sm sm:text-base">
                      By {blog.postedBy?.name || "Author"}
                    </span>
                    <p className="text-xs sm:text-sm text-gray-500">Author</p>
                  </div>
                </div>
                <div className="hidden sm:block w-px h-12 bg-gray-300"></div>
                <div className="text-center">
                  <time className="text-base sm:text-lg font-medium text-gray-700 block">
                    {new Date(blog.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                  <p className="text-xs sm:text-sm text-gray-500">Published</p>
                </div>
              </div>

              {/* Interactive Elements */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 lg:gap-4 mb-6 sm:mb-8 px-4">

                {/* Like Button */}
                <button
                  onClick={toggleLike}
                  className={`group flex items-center justify-center space-x-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-sm sm:text-base font-medium transition-all duration-200 
      border shadow-sm hover:shadow-md transform hover:scale-[1.02]
      ${blog.liked
                      ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                      : "bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-600"
                    }`}
                >
                  <svg
                    className={`w-4 h-4 sm:w-5 sm:h-5 transition-all duration-200 ${blog.liked ? "text-red-500" : "text-gray-400"}`}
                    fill={blog.liked ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                    />
                  </svg>
                  <span>{blog.likesCount}</span>
                </button>

                {/* Comment Button */}
                <button
                  onClick={() => {
                    const commentsSection = document.getElementById("comments-section");
                    if (commentsSection) {
                      commentsSection.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                  className="group flex items-center justify-center space-x-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-white text-gray-600 border border-gray-200 rounded-full text-sm sm:text-base font-medium hover:border-indigo-300 hover:text-indigo-600 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-[1.02]"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-indigo-500 transition-colors duration-200">
                    <path
                      d="M21.99 4c0-1.1-.89-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"
                      fill="currentColor"
                    />
                  </svg>
                  <span>{blog.comments.length}</span>
                </button>

                {/* Share Button */}
                <div className="w-full sm:w-auto">
                  {blog && (
                    <SocialMediaShare
                      blogTitle={blog.title}
                      blogUrl={shareUrl}
                      blogDescription={blog.content.replace(/<[^>]+>/g, "").slice(0, 200)}
                      triggerLabel={
                        <div className="flex items-center justify-center space-x-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full text-sm sm:text-base font-medium hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 transform hover:scale-[1.02] shadow-sm hover:shadow-md">
                          {/* <svg
                            className="w-4 h-4 sm:w-5 sm:h-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                            />
                          </svg> */}
                          <span className="hidden sm:inline">Share</span>
                        </div>
                      }
                    />
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Article Content */}
        <div className="bg-white shadow-2xl">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
            <article className="blog-content">{parse(blog.content)}</article>
          </div>
        </div>

        {/* Comments Section */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <section id="comments-section">
            <div className="space-y-6 sm:space-y-8 mb-12 sm:mb-16">
              {blog.comments
                .slice(0, showAllComments ? blog.comments.length : 4)
                .map((c) => {
                  const canDeleteComment =
                    user &&
                    (String(user._id) === String(c.user) ||
                      String(user._id) === String(blog.postedBy?._id));

                  const isExpanded = expandedComments[c._id];
                  const isLong = isLongComment(c.text);
                  const displayText = truncateComment(c.text, isExpanded);

                  return (
                    <div
                      key={c._id}
                      className="bg-gradient-to-br from-purple-50/50 to-white rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 hover:shadow-lg transition-all duration-300 border border-purple-100"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center space-x-3 sm:space-x-4">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-lg flex-shrink-0">
                            {c.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-base sm:text-lg truncate">
                              {c.username}
                            </p>
                            <p className="text-xs sm:text-sm text-gray-500 flex items-center">
                              <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              <span className="truncate">
                                {new Date(c.createdAt).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </p>
                          </div>
                        </div>

                        {canDeleteComment && (
                          <button
                            onClick={() => setConfirmDeleteId(c._id)}
                            className="text-gray-400 hover:text-red-500 transition-all duration-200 p-2 rounded-full hover:bg-red-50 flex-shrink-0"
                          >
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </div>

                      <div className="text-gray-700 leading-relaxed mb-4 sm:mb-6 text-sm sm:text-base lg:text-lg">
                        <pre className="whitespace-pre-wrap font-sans">{displayText}</pre>
                        {isLong && (
                          <button
                            onClick={() => toggleCommentExpansion(c._id)}
                            className="text-purple-600 hover:text-purple-700 font-medium text-xs sm:text-sm mt-2 flex items-center transition-colors duration-200"
                          >
                            {isExpanded ? (
                              <>
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                                Show less
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                                Show more
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-0 sm:ml-8 mb-2">
                        {c.replies && c.replies.length > 0 && (
                          <button
                            className="flex items-center text-gray-500 hover:text-purple-600 text-xs sm:text-sm"
                            onClick={() =>
                              setExpandedReplies((prev) => ({
                                ...prev,
                                [c._id]: !prev[c._id],
                              }))
                            }
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V10a2 2 0 012-2h2" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 3h-6a2 2 0 00-2 2v0a2 2 0 002 2h6a2 2 0 002-2v0a2 2 0 00-2-2z" />
                            </svg>
                            {expandedReplies[c._id]
                              ? `Hide replies (${c.replies.length})`
                              : `Show replies (${c.replies.length})`}
                          </button>
                        )}
                        <button
                          className="ml-2 text-purple-600 hover:underline text-xs sm:text-sm"
                          onClick={() =>
                            setShowReplyInput((prev) => ({
                              ...prev,
                              [c._id]: !prev[c._id],
                            }))
                          }
                        >
                          Reply
                        </button>
                      </div>

                      {user && showReplyInput[c._id] && (
                        <div className="mt-2 ml-0 sm:ml-8">
                          <div className="flex space-x-3 sm:space-x-4">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <input
                              type="text"
                              placeholder="Reply to this comment..."
                              value={replyTexts[c._id] || ""}
                              onChange={(e) =>
                                setReplyTexts((prev) => ({
                                  ...prev,
                                  [c._id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleReplySubmit(c._id);
                                }
                              }}
                              className="mb-4 sm:mb-8 flex-1 border-2 border-purple-200 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm focus:outline-none focus:ring-4 focus:ring-purple-200 focus:border-purple-500 transition-all duration-200"
                            />
                          </div>
                        </div>
                      )}

                      {c.replies && c.replies.length > 0 && expandedReplies[c._id] && (
                        <div className="space-y-3 sm:space-y-4 ml-0 sm:ml-8 border-l-2 sm:border-l-4 border-purple-500 pl-3 sm:pl-6">
                          {c.replies.map((r) => {
                            const isAuthorReply =
                              r.user && String(r.user) === String(blog.postedBy?._id);
                            const canDeleteReply =
                              user &&
                              (String(user._id) === String(r.user) ||
                                String(user._id) === String(blog.postedBy?._id));
                            return (
                              <div
                                key={r._id}
                                className={`p-4 sm:p-6 rounded-lg sm:rounded-xl ${isAuthorReply
                                  ? "bg-gradient-to-br from-purple-100/50 to-purple-50/30 border-2 border-purple-200"
                                  : "bg-white border border-gray-200"
                                  }`}
                              >
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                                    <div
                                      className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0 ${isAuthorReply
                                        ? "bg-gradient-to-br from-purple-600 to-indigo-600"
                                        : "bg-gradient-to-br from-gray-400 to-gray-500"
                                        }`}
                                    >
                                      {r.username.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p
                                        className={`font-bold text-xs sm:text-sm flex items-center flex-wrap ${isAuthorReply ? "text-purple-700" : "text-gray-700"
                                          }`}
                                      >
                                        <span className="truncate">{r.username}</span>
                                        {isAuthorReply && (
                                          <span className="ml-2 text-xs bg-purple-600 text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full flex-shrink-0">
                                            Author
                                          </span>
                                        )}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {new Date(r.createdAt).toLocaleDateString()}
                                      </p>
                                    </div>
                                  </div>
                                  {canDeleteReply && (
                                    <button
                                      onClick={() => setConfirmDeleteId(r._id)}
                                      className="text-gray-400 hover:text-red-500 transition-colors duration-200 p-1 rounded-full hover:bg-red-50 flex-shrink-0"
                                    >
                                      <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                                <pre className="text-gray-700 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans">
                                  {r.text}
                                </pre>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* Show More/Less Comments */}
              {blog.comments.length > 4 && (
                <div className="text-center pt-6 sm:pt-8">
                  <button
                    onClick={() => setShowAllComments(!showAllComments)}
                    className="px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg sm:rounded-xl font-medium hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl text-sm sm:text-base"
                  >
                    {showAllComments
                      ? `Show Less (${blog.comments.length - 4} hidden)`
                      : `Show More Comments (${blog.comments.length - 4} more)`}
                  </button>
                </div>
              )}
            </div>

            {/* Add Comment Form */}
            <div className="border-t-2 border-purple-100 pt-8 sm:pt-12">
              <div className="text-center mb-6 sm:mb-8">
                <h3 className="text-xl sm:text-2xl font-bold mb-2 text-gray-900">
                  Share Your Thoughts
                </h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Share your thoughts on this article with us
                </p>
              </div>
              <div className="space-y-4 sm:space-y-6">
                <div className="relative">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="What are your thoughts on this article? Share your insights, questions, or experiences..."
                    rows={5}
                    className="w-full border-2 border-purple-200 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 focus:outline-none focus:ring-4 focus:ring-purple-200 focus:border-purple-500 transition-all duration-200 resize-none text-sm sm:text-base lg:text-lg placeholder-gray-400"
                  />
                  <div className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4 text-xs sm:text-sm text-gray-400">
                    {newComment.length}/1000
                  </div>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={submitComment}
                    className="relative w-full sm:w-auto px-8 sm:px-12 py-3 sm:py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg hover:from-purple-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-2xl pulse-ring"
                  >
                    <span className="flex items-center justify-center space-x-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                      <span>Post Comment</span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Auth Modal */}
        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => {
              setShowAuthModal(false);
            }}
            initialMode={authModalMode}
          />
        )}

        {/* Back to Top Button */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full shadow-2xl hover:shadow-3xl transform hover:scale-110 transition-all duration-300 flex items-center justify-center z-50"
          style={{
            opacity: typeof window !== "undefined" && window.scrollY > 300 ? 1 : 0,
            visibility: typeof window !== "undefined" && window.scrollY > 300 ? "visible" : "hidden",
          }}
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
        </button>

        {/* Delete Confirmation Modal */}
        {confirmDeleteId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 backdrop-blur-sm bg-white/20"
              onClick={() => setConfirmDeleteId(null)}
            />
            <div className="relative z-[101] w-full max-w-sm sm:max-w-md mx-auto rounded-xl sm:rounded-2xl shadow-2xl border border-purple-200 bg-white">
              <div className="p-4 sm:p-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v4m0 4h.01M4.93 4.93l14.14 14.14M9 3h6a2 2 0 012 2v2H7V5a2 2 0 012-2zm-2 7h10l-1 9a2 2 0 01-2 2H9a2 2 0 01-2-2l-1-9z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">Delete comment?</h3>
                    <p className="mt-1 text-xs sm:text-sm text-gray-600">This action cannot be undone.</p>
                  </div>
                </div>
                <div className="mt-4 sm:mt-6 flex items-center justify-end gap-2 sm:gap-3">
                  <button
                    className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm sm:text-base transition-colors duration-200"
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm sm:text-base transition-colors duration-200"
                    onClick={() => confirmDeleteId && performDelete(confirmDeleteId)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helpers
function stripHtml(html: string): string {
  if (!html) return "";
  const withoutTags = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return withoutTags;
}

function extractFirstImageSrc(html: string): string | null {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (!match) return null;
  const src = match[1];
  if (!src || src.startsWith("data:")) return null;
  return src;
}

export const getServerSideProps: GetServerSideProps<BlogDetailProps> = async ({
  params,
  req,
}) => {
  try {
    const { id } = params as { id: string };
    await dbConnect();

    const blogDoc = await BlogModel.findById(id)
      .populate("postedBy", "name _id")
      .lean<BlogDoc>(); // ✅ properly typed plain object;
    if (!blogDoc) {
      return { notFound: true };
    }

    const host = req.headers.host || "localhost:3000";
    const proto = (req.headers["x-forwarded-proto"] as string) || "http";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${proto}://${host}`;
    const url = `${baseUrl}/blogs/${id}`;

    const description = stripHtml(blogDoc.content || "").slice(0, 200);
    const imageFromContent = extractFirstImageSrc(blogDoc.content || "");
    const image =
      imageFromContent || `${baseUrl}/assets/health_treatments_logo.png`;

    // Create the blog object, ensuring no undefined values

    const initialBlog: Blog = {
      _id: blogDoc._id,
      title: blogDoc.title || "Blog",
      content: blogDoc.content || "",
      postedBy: {
        name: blogDoc.postedBy?.name || "Author",
        _id: blogDoc.postedBy?._id || null,
      },
      createdAt: blogDoc.createdAt
        ? new Date(blogDoc.createdAt).toISOString()
        : new Date().toISOString(),
      image: blogDoc.image || undefined,
      likesCount: Array.isArray(blogDoc.likes) ? blogDoc.likes.length : 0,
      liked: false, // will be set on client
      comments: Array.isArray(blogDoc.comments)
        ? (blogDoc.comments as Partial<BlogComment>[]).map((c): BlogComment => ({
          _id: String(c._id ?? ""),
          username: c.username ?? "Anonymous",
          text: c.text ?? "",
          createdAt: c.createdAt
            ? new Date(c.createdAt).toISOString()
            : new Date().toISOString(),
          user: c.user ?? null,
          replies: Array.isArray(c.replies)
            ? (c.replies as Partial<BlogReply>[]).map((r): BlogReply => ({
              _id: String(r._id ?? ""),
              username: r.username ?? "Anonymous",
              text: r.text ?? "",
              createdAt: r.createdAt
                ? new Date(r.createdAt).toISOString()
                : new Date().toISOString(),
              user: r.user ?? null,
            }))
            : [],
        }))
        : [],
      paramlink: blogDoc.paramlink || null,
    };



    // Only add image property if it exists (not null/undefined)
    const finalImage = blogDoc.image || imageFromContent;
    if (finalImage) {
      initialBlog.image = finalImage;
    }

    const seo: SeoMeta = {
      title: initialBlog.title,
      description,
      image,
      url,
    };

    // return { props: { initialBlog, seo } };
    return {
      props: {
        initialBlog: JSON.parse(JSON.stringify(initialBlog)),
        seo
      }
    };
  } catch (e) {
    console.error("getServerSideProps error:", e);
    return { props: { initialBlog: null, seo: null } };
  }
};
