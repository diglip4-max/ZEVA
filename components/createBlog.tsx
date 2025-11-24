import React, {
  useState,
  useEffect,
  useMemo,
} from "react";
// import dynamic from "next/dynamic";
import axios from "axios";
import { useRouter } from "next/router";
import {
  FileText,
  Video,
  Save,
  Send,
  Trash2,
  X,
  Link,
  Bold,
  Italic,
  Underline,
  Link as LinkIcon,
  RotateCcw,
} from "lucide-react";
// Minimal local types to avoid importing quill types
type QuillRange = { index: number; length: number } | null;
type StringMap = Record<string, unknown>;
interface MinimalQuillEditor {
  getSelection: (focus?: boolean) => QuillRange;
  focus: () => void;
  setSelection: (index: number, length: number, source?: string) => void;
  getFormat: (index?: number, length?: number) => StringMap;
  on: (event: string, handler: (range: QuillRange) => void) => void;
  off: (event: string, handler: (range: QuillRange) => void) => void;
  history: { undo: () => void; redo: () => void };
  insertEmbed: (index: number, type: string, value: unknown) => void;
  insertText: (index: number, text: string) => void;
  blur: () => void;
  getBounds: (index: number, length?: number) => { top: number; left: number };
  formatText: (
    index: number,
    length: number,
    formats: Record<string, unknown>
  ) => void;
  format: (name: string, value: unknown) => void;
  removeFormat: (index: number, length: number, source?: string) => void;
}
import dynamic from "next/dynamic";
import "react-quill/dist/quill.snow.css";
import type { ComponentType } from "react";
type InlineFormat = "bold" | "italic" | "underline" | "link";
type DesiredValue = boolean | string | undefined;

// Domain types for API responses
interface Draft {
  _id?: string;
  title?: string;
  content?: string;
  paramlink?: string;
}
type DraftResponse = { draft?: Draft } | Draft;

interface BlogDoc {
  _id?: string;
  title?: string;
  content?: string;
  paramlink?: string;
}
type BlogResponse = { blog?: BlogDoc } | BlogDoc;

// Dynamic import for ReactQuill
const ReactQuill = dynamic<ComponentType<unknown>>(
  () =>
    import("react-quill").then((mod) => {
      // Tell TypeScript this is a React component
      return mod.default as ComponentType<unknown>;
    }),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 bg-gray-100 animate-pulse rounded flex items-center justify-center">
        <p className="text-gray-500">Loading editor...</p>
      </div>
    ),
  }
);

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "warning";
}

interface ConfirmAction {
  type: string;
  id: string;
  title: string;
}

interface BlogEditorProps {
  tokenKey: "clinicToken" | "doctorToken";
  skipLandingPage?: boolean;
  onClose?: () => void;
}

const BlogEditor: React.FC<BlogEditorProps> = ({ tokenKey, skipLandingPage = false, onClose }) => {
  const [title, setTitle] = useState<string>("");
  const [isParamlinkEditable, setIsParamlinkEditable] = useState(false);
  const [content, setContent] = useState<string>("");
  const [selectedDraft, setSelectedDraft] = useState<string | null>(null);
  const [selectedPublished, setSelectedPublished] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showLinkModal, setShowLinkModal] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(
    null
  );
  const [linkUrl, setLinkUrl] = useState<string>("");
  // Text link modal state
  const [showTextLinkModal, setShowTextLinkModal] = useState<boolean>(false);
  const [textLinkUrl, setTextLinkUrl] = useState<string>("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null
  );
  const [showImageContextMenu, setShowImageContextMenu] =
    useState<boolean>(false);
  const [contextMenuImage, setContextMenuImage] =
    useState<HTMLImageElement | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });

  // Video context menu state
  const [showVideoContextMenu, setShowVideoContextMenu] =
    useState<boolean>(false);
  const [contextMenuVideo, setContextMenuVideo] = useState<HTMLElement | null>(
    null
  );
  // Sharing moved to reusable component
  const [paramlink, setParamlink] = useState<string>("");
  const [paramlinkError, setParamlinkError] = useState<string>("");

  // New video-related state
  const [showVideoModal, setShowVideoModal] = useState<boolean>(false);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoType, setVideoType] = useState<"youtube" | "drive">("youtube");
  // Open/close main editor modal
  const [showEditor, setShowEditor] = useState<boolean>(skipLandingPage);
  // Close confirmation modal for editor
  const [showCloseConfirm, setShowCloseConfirm] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem(tokenKey);
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };
  };

  // Debug effect for context menu
  useEffect(() => {
    console.log("Context menu state changed:", showImageContextMenu);
  }, [showImageContextMenu]);

  // Global click handler to close context menus
  useEffect(() => {
    const handleGlobalClick = () => {
      if (showImageContextMenu) {
        setShowImageContextMenu(false);
        setContextMenuImage(null);
      }
      if (showVideoContextMenu) {
        setShowVideoContextMenu(false);
        setContextMenuVideo(null);
      }
    };

    document.addEventListener("click", handleGlobalClick);
    return () => document.removeEventListener("click", handleGlobalClick);
  }, [showImageContextMenu, showVideoContextMenu]);

  // Support loading by query param when navigated from Published Blogs page
  const router = useRouter();
  useEffect(() => {
    const { draftId, blogId } = router.query as {
      draftId?: string;
      blogId?: string;
    };
    if (draftId) {
      loadDraft(draftId);
      setShowEditor(true);
    } else if (blogId) {
      loadPublishedBlog(blogId);
      setShowEditor(true);
    }
  }, [router.query]);

  // Ask to save as draft when trying to close editor with content
  const requestCloseEditor = () => {
    if (!title && !content) {
      setShowEditor(false);
      return;
    }
    setShowCloseConfirm(true);
  };

  const saveAndCloseEditor = async () => {
    const ok = await saveDraft();
    if (ok) {
      setShowCloseConfirm(false);
      setShowEditor(false);
      if (onClose) {
        onClose();
      }
    }
  };

  const discardAndCloseEditor = () => {
    setShowCloseConfirm(false);
    setShowEditor(false);
    if (onClose) {
      onClose();
    }
  };

  const resetEditorFields = () => {
    setTitle("");
    setContent("");
    setParamlink("");
    setSelectedDraft(null);
    setSelectedPublished(null);
    setParamlinkError("");
    setLastSaved(null);
    showToast("Editor has been reset", "success");
  };

  // Load ReactQuill CSS after component mounts
  useEffect(() => {
    if (typeof window !== "undefined") {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdn.quilljs.com/1.3.6/quill.snow.css";
      document.head.appendChild(link);
    }
  }, []);

  // Improve Quill toolbar accessibility with titles
  useEffect(() => {
    try {
      const toolbar = document.querySelector(
        ".quill-container .ql-toolbar"
      ) as HTMLElement | null;
      if (!toolbar) return;
      const setTitle = (selector: string, title: string) => {
        const el = toolbar.querySelector(selector) as HTMLElement | null;
        if (el && !el.getAttribute("title")) el.setAttribute("title", title);
      };
      setTitle("button.ql-bold", "Bold (Ctrl+B)");
      setTitle("button.ql-italic", "Italic (Ctrl+I)");
      setTitle("button.ql-underline", "Underline (Ctrl+U)");
      setTitle(".ql-color .ql-picker-label", "Text color");
      setTitle(".ql-background .ql-picker-label", "Highlight color");
      setTitle(".ql-align .ql-picker-label", "Text alignment");
      setTitle("button.ql-indent[value='-1']", "Decrease indent");
      setTitle("button.ql-indent[value='+1']", "Increase indent");
      setTitle("button.ql-list[value='ordered']", "Numbered list");
      setTitle("button.ql-list[value='bullet']", "Bulleted list");
      setTitle("button.ql-list[value='check']", "Task list");
      setTitle("button.ql-blockquote", "Block quote");
      setTitle("button.ql-code-block", "Code block");
      setTitle("button.ql-link", "Insert link");
      setTitle("button.ql-image", "Insert image");
      setTitle("button.ql-video", "Insert video");
      setTitle("button.ql-undo", "Undo");
      setTitle("button.ql-redo", "Redo");
      setTitle("button.ql-clean", "Clear formatting");
    } catch { }
  }, [showEditor, content]);

  // Auto-save draft every 30 seconds if there's content and not editing published blog
  useEffect(() => {
    if (!title && !content) return;
    if (selectedPublished) return;

    const autoSaveTimer = setTimeout(() => {
      if (title || content) {
        saveDraft();
      }
    }, 30000);

    return () => clearTimeout(autoSaveTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, selectedPublished]);

  // Add image and video click handlers after content changes
  useEffect(() => {
    const normalizeImages = () => {
      const editorContainer = document.querySelector(".ql-editor");
      if (!editorContainer) return;
      const images = editorContainer.querySelectorAll("img");
      images.forEach((img) => {
        const image = img as HTMLImageElement;
        image.style.width = "100%";
        image.style.height = "var(--ql-image-height, 300px)";
        image.style.objectFit = "contain";
        image.removeAttribute("width");
        image.removeAttribute("height");
      });
    };

    const attachMediaListeners = () => {
      const editorContainer = document.querySelector(".ql-editor");
      if (editorContainer) {
        // Handle images
        const images = editorContainer.querySelectorAll("img");
        console.log("Found images:", images.length);

        images.forEach((img) => {
          img.removeEventListener(
            "dblclick",
            handleImageDoubleClick as EventListener
          );
          img.removeEventListener(
            "contextmenu",
            handleImageRightClick as EventListener
          );

          img.addEventListener(
            "dblclick",
            handleImageDoubleClick as EventListener
          );
          img.addEventListener(
            "contextmenu",
            handleImageRightClick as EventListener
          );

          (img as HTMLImageElement).style.cursor = "pointer";
          (img as HTMLImageElement).title =
            "Double-click to add/edit link, Right-click for more options";
        });

        // Handle videos
        const videoContainers =
          editorContainer.querySelectorAll(".video-container");
        console.log("Found videos:", videoContainers.length);

        videoContainers.forEach((container) => {
          container.removeEventListener(
            "contextmenu",
            handleVideoRightClick as EventListener
          );

          container.addEventListener(
            "contextmenu",
            handleVideoRightClick as EventListener
          );

          (container as HTMLElement).style.cursor = "pointer";
          (container as HTMLElement).title = "Right-click to remove video";
        });

        // Normalize images every time we attach listeners
        normalizeImages();
      }
    };

    const timer = setTimeout(attachMediaListeners, 1000);

    const editorContainer = document.querySelector(".ql-editor");
    if (editorContainer) {
      editorContainer.addEventListener("focus", attachMediaListeners);
      editorContainer.addEventListener("input", attachMediaListeners);
    }

    return () => {
      clearTimeout(timer);
      if (editorContainer) {
        editorContainer.removeEventListener("focus", attachMediaListeners);
        editorContainer.removeEventListener("input", attachMediaListeners);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  // Slugify function
  const slugify = (text: string) =>
    text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-");

  // Auto-generate paramlink from title if not manually edited
  useEffect(() => {
    if (!selectedDraft && !selectedPublished) {
      setParamlink(slugify(title));
    }
  }, [title, selectedDraft, selectedPublished]);

  // New video utility functions
  const extractYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const extractGoogleDriveId = (url: string): string | null => {
    const patterns = [
      /\/file\/d\/([a-zA-Z0-9-_]+)/,
      /id=([a-zA-Z0-9-_]+)/,
      /drive\.google\.com.*\/([a-zA-Z0-9-_]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const createVideoEmbed = (url: string, type: "youtube" | "drive"): string => {
    if (type === "youtube") {
      const videoId = extractYouTubeId(url);
      if (!videoId) return "";

      return `<div class="video-container" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 16px 0;">
        <iframe 
          style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
          src="https://www.youtube.com/embed/${videoId}" 
          frameborder="0" 
          allowfullscreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
        </iframe>
      </div>`;
    } else {
      const fileId = extractGoogleDriveId(url);
      if (!fileId) return "";

      return `<div class="video-container" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 16px 0;">
        <iframe 
          style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
          src="https://drive.google.com/file/d/${fileId}/preview" 
          frameborder="0" 
          allowfullscreen>
        </iframe>
      </div>`;
    }
  };

  const validateVideoUrl = (
    url: string,
    type: "youtube" | "drive"
  ): boolean => {
    if (type === "youtube") {
      return extractYouTubeId(url) !== null;
    } else {
      return extractGoogleDriveId(url) !== null;
    }
  };

  const handleVideoInsert = () => {
    const trimmedUrl = videoUrl.trim();

    if (!trimmedUrl) {
      showToast("Please enter a video URL", "warning");
      return;
    }

    if (!validateVideoUrl(trimmedUrl, videoType)) {
      const message =
        videoType === "youtube"
          ? "Please enter a valid YouTube URL (e.g., https://youtube.com/watch?v=... or https://youtu.be/...)"
          : "Please enter a valid Google Drive video URL (e.g., https://drive.google.com/file/d/.../view)";
      showToast(message, "error");
      return;
    }

    const videoEmbed = createVideoEmbed(trimmedUrl, videoType);
    if (!videoEmbed) {
      showToast("Failed to create video embed", "error");
      return;
    }

    // Insert the video embed into the content with automatic line break
    const newContent = content + videoEmbed + "\n";
    setContent(newContent);

    // Close modal and reset
    setShowVideoModal(false);
    setVideoUrl("");
    setVideoType("youtube");

    showToast(
      `${videoType === "youtube" ? "YouTube" : "Google Drive"
      } video added successfully!`,
      "success"
    );
  };

  const ensureLinksUnderlined = (htmlContent: string) => {
    if (typeof window === "undefined") return htmlContent;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;

    const links = tempDiv.querySelectorAll("a");
    links.forEach((link) => {
      if (!link.style.textDecoration || link.style.textDecoration === "none") {
        link.style.textDecoration = "underline";
        link.style.textDecorationColor = "#2563eb";
        link.style.textDecorationThickness = "2px";
      }
    });

    return tempDiv.innerHTML;
  };

  const showToast = (
    message: string,
    type: "success" | "error" | "warning"
  ) => {
    const id = Date.now().toString();
    const newToast: Toast = { id, message, type };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // const openConfirmModal = (type: string, id: string, title: string) => {
  //   setConfirmAction({ type, id, title });
  //   setShowConfirmModal(true);
  // };

  const handleConfirmAction = () => {
    if (!confirmAction) return;

    if (confirmAction.type === "deleteDraft") {
      deleteDraft(confirmAction.id);
    } else if (confirmAction.type === "deletePublished") {
      deletePublishedBlog(confirmAction.id);
    }

    setShowConfirmModal(false);
    setConfirmAction(null);
  };

  const handleImageDoubleClick = (e: Event) => {
    e.preventDefault();
    const img = e.target as HTMLImageElement;
    openImageLinkEditor(img);
  };

  const openImageLinkEditor = (imageEl: HTMLImageElement) => {
    const currentLink =
      imageEl.parentElement?.tagName === "A"
        ? (imageEl.parentElement as HTMLAnchorElement).href
        : "";
    setSelectedImage(imageEl);
    setLinkUrl(currentLink);
    setShowLinkModal(true);
  };

  const handleImageRightClick = (e: Event) => {
    e.preventDefault();
    console.log("Right-click detected on image");
    const img = e.target as HTMLImageElement;
    const rect = img.getBoundingClientRect();

    const menuWidth = 150;
    const menuHeight = 80;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let x = rect.left;
    let y = rect.bottom + window.scrollY;

    if (x + menuWidth > windowWidth) {
      x = rect.right - menuWidth;
    }

    if (y + menuHeight > windowHeight + window.scrollY) {
      y = rect.top + window.scrollY - menuHeight;
    }

    console.log("Image rect:", rect);
    console.log("Context menu position:", { x, y });

    setContextMenuImage(img);
    setContextMenuPosition({ x, y });
    setShowImageContextMenu(true);
  };

  const handleVideoRightClick = (e: Event) => {
    e.preventDefault();
    console.log("Right-click detected on video");
    const videoContainer = e.currentTarget as HTMLElement;
    const rect = videoContainer.getBoundingClientRect();

    const menuWidth = 150;
    const menuHeight = 50;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let x = rect.left;
    let y = rect.bottom + window.scrollY;

    if (x + menuWidth > windowWidth) {
      x = rect.right - menuWidth;
    }

    if (y + menuHeight > windowHeight + window.scrollY) {
      y = rect.top + window.scrollY - menuHeight;
    }

    console.log("Video rect:", rect);
    console.log("Video context menu position:", { x, y });

    setContextMenuVideo(videoContainer);
    setContextMenuPosition({ x, y });
    setShowVideoContextMenu(true);
  };

  const removeVideo = () => {
    console.log("removeVideo called");
    if (contextMenuVideo) {
      console.log("Removing video:", contextMenuVideo);

      try {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = content;

        const videoContainers = tempDiv.querySelectorAll(".video-container");
        let videoRemoved = false;

        videoContainers.forEach((container) => {
          const iframe = container.querySelector("iframe");
          const contextIframe = contextMenuVideo.querySelector("iframe");

          if (
            iframe &&
            contextIframe &&
            iframe.src === contextIframe.src &&
            !videoRemoved
          ) {
            container.remove();
            videoRemoved = true;
          }
        });

        if (videoRemoved) {
          setContent(tempDiv.innerHTML);
          showToast("Video removed successfully!", "success");
        } else {
          showToast("Video not found in content", "error");
        }
      } catch (error) {
        console.error("Error removing video:", error);
        showToast("Failed to remove video", "error");
      }
    } else {
      console.log("No contextMenuVideo found");
      showToast("No video selected for removal", "error");
    }

    setShowVideoContextMenu(false);
    setContextMenuVideo(null);
  };
  const removeImage = () => {
    console.log("removeImage called");
    if (contextMenuImage) {
      console.log("Removing image:", contextMenuImage);

      try {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = content;

        const images = tempDiv.querySelectorAll("img");
        let imageRemoved = false;

        images.forEach((img) => {
          if (img.src === contextMenuImage.src && !imageRemoved) {
            img.remove();
            imageRemoved = true;
          }
        });

        if (imageRemoved) {
          setContent(tempDiv.innerHTML);
          showToast("Image removed successfully!", "success");
        } else {
          showToast("Image not found in content", "error");
        }
      } catch (error) {
        console.error("Error removing image:", error);
        showToast("Failed to remove image", "error");
      }
    } else {
      console.log("No contextMenuImage found");
      showToast("No image selected for removal", "error");
    }

    setShowImageContextMenu(false);
    setContextMenuImage(null);
  };

  const checkImageSizes = (htmlContent: string): boolean => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;

    const images = tempDiv.querySelectorAll("img");
    let hasLargeImage = false;

    images.forEach((img) => {
      const src = img.getAttribute("src");
      if (src && src.startsWith("data:image")) {
        const base64Data = src.split(",")[1];
        if (base64Data) {
          const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
          const sizeInMB = sizeInBytes / (1024 * 1024);

          if (sizeInMB > 1) {
            hasLargeImage = true;
            showToast(
              `Image size (${sizeInMB.toFixed(
                2
              )}MB) exceeds the 1MB limit. Please resize the image before publishing.`,
              "error"
            );
          }
        }
      }
    });

    return hasLargeImage;
  };

  const handleLinkSubmit = () => {
    if (!selectedImage) return;

    const trimmedUrl = linkUrl.trim();

    if (trimmedUrl) {
      if (!trimmedUrl.match(/^https?:\/\//)) {
        showToast(
          "Please enter a valid URL with https:// or http:// protocol",
          "error"
        );
        return;
      }

      try {
        new URL(trimmedUrl);
      } catch {
        showToast(
          "Please enter a valid URL format (e.g., https://example.com)",
          "error"
        );
        return;
      }

      const linkElement = document.createElement("a");
      linkElement.href = trimmedUrl;
      linkElement.target = "_blank";
      linkElement.rel = "noopener noreferrer";

      selectedImage.parentNode?.replaceChild(linkElement, selectedImage);
      linkElement.appendChild(selectedImage);
    } else {
      if (selectedImage.parentElement?.tagName === "A") {
        selectedImage.parentElement.parentNode?.replaceChild(
          selectedImage,
          selectedImage.parentElement
        );
      }
    }

    const editorContainer = document.querySelector(".ql-editor");
    if (editorContainer) {
      setContent(editorContainer.innerHTML);
    }

    setShowLinkModal(false);
    setSelectedImage(null);
    setLinkUrl("");
    showToast("Image link updated successfully!", "success");
  };

  const loadDraft = async (draftId: string) => {
    try {
      const response = await axios.get<DraftResponse>(
        `/api/blog/draft?id=${draftId}`,
        getAuthHeaders()
      );
      const draft = (response.data as DraftResponse as { draft?: Draft }).draft || (response.data as Draft);
      if (!draft) {
        showToast("Draft not found", "error");
        return;
      }
      setTitle(draft.title || "");
      setContent(draft.content || "");
      setParamlink(draft.paramlink || "");
      setSelectedDraft(draftId);
      setSelectedPublished(null);
      showToast("Draft loaded successfully!", "success");
    } catch (err) {
      console.error("Failed to load draft:", err);
      showToast("Failed to load draft", "error");
    }
  };

  const loadPublishedBlog = async (blogId: string) => {
    try {
      const response = await axios.get<BlogResponse>(
        `/api/blog/published?id=${blogId}`,
        getAuthHeaders()
      );
      const blog = (response.data as BlogResponse as { blog?: BlogDoc }).blog || (response.data as BlogDoc);
      if (!blog) {
        showToast("Published blog not found", "error");
        return;
      }
      setTitle(blog.title || "");
      setContent(blog.content || "");
      setParamlink(blog.paramlink || "");
      setSelectedPublished(blogId);
      setSelectedDraft(null);
      showToast("Published blog loaded successfully!", "success");
    } catch (err) {
      console.error("Failed to load published blog:", err);
      showToast("Failed to load published blog", "error");
    }
  };

  const saveDraft = async (): Promise<boolean> => {
    // Require some content to save
    if (!title && !content) {
      showToast("Please enter at least a title or content", "warning");
      return false;
    }

    // Ensure paramlink exists by auto-generating when missing
    let effectiveParamlink = paramlink?.trim();
    if (!effectiveParamlink) {
      const base = (title || "untitled").toString();
      effectiveParamlink = slugify(base).slice(0, 60) || `untitled-${Date.now()}`;
      setParamlink(effectiveParamlink);
    }
    setParamlinkError("");

    const token = localStorage.getItem(tokenKey);
    if (!token) {
      showToast("Authentication required. Please login again.", "error");
      return false;
    }

    setIsLoading(true);
    try {
      if (selectedDraft) {
        await axios.put(
          `/api/blog/draft?id=${selectedDraft}`,
          {
            title: title || "Untitled Draft",
            content: ensureLinksUnderlined(content || ""),
            paramlink: effectiveParamlink,
          },
          getAuthHeaders()
        );
        setLastSaved(new Date());
        showToast("Draft updated successfully!", "success");
      } else {
        const response = await axios.post<DraftResponse>(
          "/api/blog/draft",
          {
            title: title || "Untitled Draft",
            content: ensureLinksUnderlined(content || ""),
            paramlink: effectiveParamlink,
          },
          getAuthHeaders()
        );
        const newDraft = (response.data as DraftResponse as { draft?: Draft }).draft || (response.data as Draft);
        if (newDraft && newDraft._id) {
          setSelectedDraft(newDraft._id);
        }
        setLastSaved(new Date());
        showToast("Draft created successfully!", "success");
      }
      return true;
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes("Paramlink already exists")) {
          setParamlinkError("Paramlink already exists. Please choose another.");
        }
        showToast(err.message, "error");
      } else {
        showToast("Failed to save draft", "error");
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const publishBlog = async () => {
    if (!title || !content) {
      showToast("Title and content required", "warning");
      return;
    }
    if (!paramlink) {
      setParamlinkError("Paramlink is required");
      return;
    }
    setParamlinkError("");

    if (checkImageSizes(content)) {
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(
        "/api/blog/published",
        {
          title,
          content: ensureLinksUnderlined(content),
          paramlink,
        },
        getAuthHeaders()
      );

      // After publishing, navigate to Published Blogs page to manage/share

      showToast("Blog published successfully!", "success");
      setTitle("");
      setContent("");
      setParamlink("");
      setSelectedDraft(null);
      setSelectedPublished(null);
      // Close editor if in modal mode
      if (skipLandingPage && onClose) {
        onClose();
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      if (error.response?.data?.message?.includes("Paramlink already exists")) {
        setParamlinkError("Paramlink already exists. Please choose another.");
      } else {
        showToast("Failed to publish blog", "error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updatePublishedBlog = async () => {
    if (!selectedPublished) {
      showToast("No blog selected for update", "warning");
      return;
    }
    if (!title || !content) {
      showToast("Title and content required", "warning");
      return;
    }
    if (!paramlink) {
      setParamlinkError("Paramlink is required");
      return;
    }
    setParamlinkError("");

    const token = localStorage.getItem(tokenKey);
    if (!token) {
      showToast("Authentication required. Please login again.", "error");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.put(
        `/api/blog/published?id=${selectedPublished}`,
        {
          title,
          content: ensureLinksUnderlined(content),
          paramlink,
        },
        getAuthHeaders()
      );

      if (response.data) {
        showToast("Blog updated successfully!", "success");
        setTitle("");
        setContent("");
        setParamlink("");
        setSelectedPublished(null);
      } else {
        showToast("Failed to update blog - no response data", "error");
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      if (error.response?.data?.message?.includes("Paramlink already exists")) {
        setParamlinkError("Paramlink already exists. Please choose another.");
      } 
    } finally {
      setIsLoading(false);
    }
  };

  const deleteDraft = async (draftId: string) => {
    try {
      await axios.delete(`/api/blog/draft?id=${draftId}`, getAuthHeaders());
      showToast("Draft deleted successfully!", "success");
      if (selectedDraft === draftId) {
        setTitle("");
        setContent("");
        setParamlink("");
        setSelectedDraft(null);
      }
    } catch (err: unknown) {
      console.error("Failed to delete draft:", err);
      showToast("Failed to delete draft", "error");
    }
  };

  const deletePublishedBlog = async (blogId: string) => {
    try {
      await axios.delete(`/api/blog/published?id=${blogId}`, getAuthHeaders());
      showToast("Blog deleted successfully!", "success");
      if (selectedPublished === blogId) {
        setTitle("");
        setContent("");
        setParamlink("");
        setSelectedPublished(null);
      }
    } catch (err: unknown) {
      console.error("Failed to delete published blog:", err);
      showToast("Failed to delete published blog", "error");
    }
  };
  // const [value, setValue] = useState("");

  // Inline toolbar state
  const [showInlineToolbar, setShowInlineToolbar] = useState<boolean>(false);
  const [inlineToolbarPos, setInlineToolbarPos] = useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });
  const quillRef = React.useRef<{ getEditor: () => MinimalQuillEditor } | null>(null);
  const lastRangeRef = React.useRef<QuillRange>(null);

  // Attach native selection-change to keep latest range from Quill itself
  useEffect(() => {
    const quill = quillRef.current?.getEditor?.();
    if (!quill) return;

    const handler = (range: QuillRange) => {
      if (range) lastRangeRef.current = range;
    };

    quill.on("selection-change", handler);

    return () => {
      try {
        quill.off("selection-change", handler);
      } catch {
        // ignore
      }
    };
  }, []);

  const formatWithQuill = (format: InlineFormat, desiredValue?: DesiredValue) => {
    const quill = quillRef.current?.getEditor?.();
    if (!quill) return;

    const run = (fn: () => void) => setTimeout(fn, 0);

    const restoreAnd = (fn: () => void) => {
      const r: QuillRange = lastRangeRef.current || quill.getSelection();
      if (!r || r.length === 0) return; // require selection
      quill.focus();
      quill.setSelection(r.index, r.length || 0, "user");
      run(fn);
    };

    // Link handling
    if (format === "link") {
      const r2: QuillRange = quill.getSelection(true);
      if (!r2 || r2.length === 0) return;
      lastRangeRef.current = r2;
      const currentFormats: StringMap = quill.getFormat(r2.index, r2.length);
      setTextLinkUrl((currentFormats?.link as string) || "");
      setShowTextLinkModal(true);
      return;
    }

    // Inline styles (minimal) with robust formatText
    if (["bold", "italic", "underline"].includes(format)) {
      restoreAnd(() => {
        const r2: QuillRange = quill.getSelection(true);
        if (!r2) return;
        const current: StringMap = quill.getFormat(r2.index, r2.length);
        const nextVal =
          desiredValue === undefined ? !current?.[format] : desiredValue;
        quill.formatText(r2.index, r2.length, { [format]: nextVal });
      });
      return;
    }
  };

  const handleSelectionChange = (range: QuillRange, source: string, editor: MinimalQuillEditor) => {
    try {
      if (range && range.length > 0) {
        const bounds = editor.getBounds(range.index, range.length);
        const top = Math.max(0, bounds.top - 42);
        const left = Math.max(0, bounds.left);
        setInlineToolbarPos({ top, left });
        setShowInlineToolbar(true);
        lastRangeRef.current = range;
      } else {
        setShowInlineToolbar(false);
      }
    } catch {
      setShowInlineToolbar(false);
    }
  };

  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ font: [] }],
          [{ size: [] }],
          ["bold", "italic", "underline"],
          [{ color: [] }, { background: [] }],
          [{ align: [] }],
          [{ indent: "-1" }, { indent: "+1" }],
          [{ list: "ordered" }, { list: "bullet" }, { list: "check" }],
          ["blockquote", "code-block"],
          ["link", "image", "video"],
          ["undo", "redo"],
          ["clean"],
        ],
        handlers: {
          link: function (this: { quill: MinimalQuillEditor }) {
  const sel = this.quill.getSelection(true);
  if (!sel || sel.length === 0) return;

  try {
    const formats = this.quill.getFormat(sel.index, sel.length);
    setTextLinkUrl(
      ((formats as Record<string, unknown>)?.link as string) || ""
    );
  } catch (err) {
    console.error("Error getting formats:", err);
  }

  lastRangeRef.current = sel;
  this.quill.blur();
  setShowTextLinkModal(true);
},
          image: function (this: { quill: MinimalQuillEditor }) {
            const input = document.createElement("input");
            input.setAttribute("type", "file");
            input.setAttribute("accept", "image/*");
            input.click();

            input.onchange = () => {
              const file = input.files?.[0];
              if (file) {
                if (file.size > 998 * 1024) {
                  showToast("Please upload an image smaller than 1 MB.", "warning");
                  return;
                }

                const reader = new FileReader();
                reader.onload = () => {
                  const range = this.quill.getSelection();
                  if (!range) return;
                  this.quill.insertEmbed(range.index, "image", reader.result);
                  this.quill.insertText(range.index + 1, "\n");
                  this.quill.setSelection(range.index + 2, 0);
                };
                reader.readAsDataURL(file);
              }
            };
          },
          video: function (this: { quill: MinimalQuillEditor }) {
            this.quill.blur();
            setShowVideoModal(true);
          },
          undo: function (this: { quill: MinimalQuillEditor }) {
            this.quill.history.undo();
          },
          redo: function (this: { quill: MinimalQuillEditor }) {
            this.quill.history.redo();
          },
          clean: function (this: { quill: MinimalQuillEditor }) {
            const sel = this.quill.getSelection(true);
            if (!sel) return;
            if (sel.length === 0) {
              // Clear formats at cursor line block + inline
              const formats = this.quill.getFormat();
              Object.keys(formats || {}).forEach((k) => this.quill.format(k, false));
            } else {
              this.quill.removeFormat(sel.index, sel.length, "user");
            }
          },
        },
      },
      history: { delay: 1000, maxStack: 100, userOnly: true },
    }),
    []
  );

  const formats = [
    "font",
    "size",
    "bold",
    "italic",
    "underline",
    "color",
    "background",
    "align",
    "indent",
    "list",
    "blockquote",
    "code-block",
    "link",
    "image",
    "video",
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const QuillAny: any = ReactQuill as any;

  // Utility to get base URL
  const getBaseUrl = () => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      if (origin.includes("localhost")) {
       return process.env.NEXT_PUBLIC_BASE_URL;
      } else {
        return "https://zeva360.com";
      }
    }
    return "";
  };

  return (
    <div className="min-h-screen bg-[#18232b]">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center justify-between p-4 rounded-lg shadow-lg min-w-80 transform transition-all duration-300 ease-in-out ${toast.type === "success"
              ? "bg-green-500 text-white"
              : toast.type === "error"
                ? "bg-red-500 text-white"
                : "bg-yellow-500 text-white"
              }`}
          >
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-3 text-white hover:text-gray-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Landing - Write Blog CTA */}
      {!skipLandingPage && !showEditor && (
        <div className="relative w-full h-screen flex items-center justify-center px-4 overflow-hidden">
          {/* Subtle Background */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-800">
            <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-blue-500/3 rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2"></div>
          </div>

          {/* Main Content */}
          <div className="relative z-10 max-w-2xl mx-auto text-center">
            {/* Logo */}
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 rounded-xl mb-4">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="text-2xl font-bold text-white">Zeva</div>
            </div>

            {/* Headline */}
            <div className="mb-8">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
                Write. Create. Publish.
              </h1>
              <p className="text-lg text-slate-300 leading-relaxed">
                Create compelling blogs and stories with our intuitive writing platform.
              </p>
            </div>

            {/* Features */}
            <div className="mb-8">
              <div className="flex justify-center gap-6 text-sm text-slate-400">

                <span className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                  Instant Publishing
                </span>
              </div>
            </div>

            {/* CTA Button */}
            <div>
              <button
                onClick={() => setShowEditor(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-900 rounded-lg font-semibold hover:bg-slate-50 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <FileText className="w-4 h-4" />
                Start Writing
              </button>
              <p className="mt-3 text-xs text-slate-500">Free to use</p>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Blog Editor Modal */}
      {showEditor && (
        <div className={`${skipLandingPage ? 'relative' : 'fixed inset-0 z-40'} flex items-start justify-center p-0 overflow-y-auto`}>
          {!skipLandingPage && <div className="absolute inset-0 bg-black/50" onClick={requestCloseEditor} />}
          <div className={`${skipLandingPage ? 'relative' : 'relative z-40'} w-full h-full min-h-screen overflow-hidden bg-white flex flex-col`}>

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border-b bg-gray-50 flex-shrink-0 gap-3 sm:gap-0">
              <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Zeva Blog Editor</h2>
                <div className="flex items-center gap-1 sm:gap-2 ml-auto sm:ml-0">
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(true)}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-colors"
                    title="Reset Editor"
                  >
                    <RotateCcw size={14} />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                  <button
                    onClick={saveDraft}
                    disabled={isLoading}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold bg-gray-700 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors"
                    title="Save Draft"
                  >
                    <Save size={14} />
                    <span className="hidden sm:inline">Save Draft</span>
                  </button>
                  <button
                    onClick={selectedPublished ? updatePublishedBlog : publishBlog}
                    disabled={isLoading || !title || !content}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold bg-[#2D9AA5] text-white rounded-md hover:bg-[#257A83] disabled:opacity-50 transition-colors"
                    title={selectedPublished ? "Update Blog" : "Publish Blog"}
                  >
                    <Send size={14} />
                    <span className="hidden sm:inline">{selectedPublished ? "Update" : "Publish"}</span>
                  </button>
                </div>
              </div>
              <button
                onClick={requestCloseEditor}
                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded self-end sm:self-auto"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              {/* Title and Permalink Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Blog Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Blog Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTitle(value);
                      if (!isParamlinkEditable) {
                        const slug = value
                          .toLowerCase()
                          .replace(/[^a-z0-9\s-]/g, "")
                          .trim()
                          .replace(/\s+/g, "-")
                          .slice(0, 60);
                        setParamlink(slug);
                      }
                    }}
                    placeholder="Enter your blog title..."
                    className="text-black w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#2D9AA5] focus:border-transparent text-sm sm:text-base"
                  />
                </div>

                {/* Permalink */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      URL Slug
                    </label>
                    <button
                      onClick={() => setIsParamlinkEditable(!isParamlinkEditable)}
                      className="text-xs text-[#2D9AA5] hover:text-[#257A83] font-medium"
                    >
                      {isParamlinkEditable ? "Lock" : "Edit"}
                    </button>
                  </div>
                  <div className="flex">
                    <span className="text-xs text-gray-600 bg-gray-100 px-2 py-2 rounded-l-md border border-gray-300 border-r-0">
                      {getBaseUrl()}/blog/
                    </span>
                    <input
                      type="text"
                      value={paramlink}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.length <= 60) {
                          setParamlink(value);
                        }
                      }}
                      readOnly={!isParamlinkEditable}
                      maxLength={60}
                      className={`text-black flex-1 px-3 py-2 border ${paramlinkError ? "border-red-500" : "border-gray-300"
                        } rounded-r-md focus:ring-2 focus:ring-[#2D9AA5] focus:border-transparent ${!isParamlinkEditable ? "bg-gray-50" : ""
                        } text-sm sm:text-base`}
                    />
                  </div>
                  {paramlinkError && (
                    <p className="text-red-500 text-xs mt-1">{paramlinkError}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {paramlink.length}/60 characters
                  </p>
                </div>
              </div>

              {/* Content Editor */}
              <div className="text-black">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content
                </label>
                <div className="border border-gray-300 rounded-md overflow-hidden">
                  <div className="relative quill-container h-[60vh] sm:h-[65vh] lg:h-[70vh] xl:h-[75vh]">
                    <QuillAny
                      theme="snow"
                      value={content}
                      onChange={(val: string) => setContent(val)}
                      ref={quillRef}
                      onChangeSelection={handleSelectionChange}
                      modules={modules}
                      formats={formats}
                      placeholder="Start writing your blog content..."
                      className="h-full"
                      style={{ ["--ql-primary"]: "#2D9AA5", ["--ql-image-width"]: "600px", ["--ql-image-height"]: "400px" }}
                    />
                    {showInlineToolbar && (
                      <div
                        className="absolute z-50 bg-white border border-gray-200 shadow-lg rounded-md px-2 py-1 flex items-center gap-1"
                        style={{
                          top: inlineToolbarPos.top,
                          left: inlineToolbarPos.left,
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <button
                          type="button"
                          className="p-1 hover:bg-gray-100 rounded"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => formatWithQuill("bold")}
                        >
                          <Bold size={16} />
                        </button>
                        <button
                          type="button"
                          className="p-1 hover:bg-gray-100 rounded italic"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => formatWithQuill("italic")}
                        >
                          <Italic size={16} />
                        </button>
                        <button
                          type="button"
                          className="p-1 hover:bg-gray-100 rounded underline"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => formatWithQuill("underline")}
                        >
                          <Underline size={16} />
                        </button>
                        <div className="mx-1 w-px h-4 bg-gray-200" />
                        <button
                          type="button"
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Link"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => formatWithQuill("link")}
                        >
                          <LinkIcon size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Last Saved Indicator */}
              {lastSaved && (
                <div className="pt-4 border-t bg-gray-50 -mx-6 px-6 py-3">
                  <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                    Last saved: {lastSaved.toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* All other modals remain unchanged... */}
      {/* Text Link Modal */}
      {showTextLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Link size={24} className="text-[#2D9AA5]" />
                Insert Link
              </h3>
              <button
                onClick={() => {
                  setShowTextLinkModal(false);
                  setTextLinkUrl("");
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL
                </label>
                <input
                  type="url"
                  value={textLinkUrl}
                  onChange={(e) => setTextLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="text-gray-900 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9AA5] focus:border-transparent transition-all duration-200"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty to remove link</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowTextLinkModal(false);
                    setTextLinkUrl("");
                  }}
                  className="flex-1 py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const quill = quillRef.current?.getEditor?.();
                    if (!quill) return;
                    const r = lastRangeRef.current || quill.getSelection(true);
                    if (!r || r.length === 0) {
                      setShowTextLinkModal(false);
                      setTextLinkUrl("");
                      return;
                    }
                    quill.focus();
                    quill.setSelection(r.index, r.length, "user");
                    const trimmed = textLinkUrl.trim();
                    if (trimmed) {
                      if (!/^https?:\/\//i.test(trimmed)) {
                        showToast("Please enter a valid URL starting with http(s)://", "error");
                        return;
                      }
                      quill.formatText(r.index, r.length, { link: trimmed });
                    } else {
                      quill.formatText(r.index, r.length, { link: false });
                    }
                    setShowTextLinkModal(false);
                    setTextLinkUrl("");
                  }}
                  className="flex-1 py-2 px-4 text-sm font-medium text-white bg-[#2D9AA5] rounded-lg hover:bg-[#257A83] transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Video Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Video size={24} className="text-[#2D9AA5]" />
                Insert Video
              </h3>
              <button
                onClick={() => {
                  setShowVideoModal(false);
                  setVideoUrl("");
                  setVideoType("youtube");
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Video Type
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setVideoType("youtube")}
                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors ${videoType === "youtube"
                      ? "bg-[#2D9AA5] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                  >
                    YouTube
                  </button>
                  <button
                    onClick={() => setVideoType("drive")}
                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors ${videoType === "drive"
                      ? "bg-[#2D9AA5] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                  >
                    Google Drive
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Video URL
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder={
                    videoType === "youtube"
                      ? "https://youtube.com/watch?v=..."
                      : "https://drive.google.com/file/d/.../view"
                  }
                  className="text-gray-900 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9AA5] focus:border-transparent transition-all duration-200"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowVideoModal(false);
                    setVideoUrl("");
                    setVideoType("youtube");
                  }}
                  className="flex-1 py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVideoInsert}
                  disabled={!videoUrl.trim()}
                  className="flex-1 py-2 px-4 text-sm font-medium text-white bg-[#2D9AA5] rounded-lg hover:bg-[#257A83] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Insert Video
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Editor Confirm Modal */}
      {showCloseConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Save draft before closing?</h3>
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Dismiss"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-6">You have unsaved content. Would you like to save it as a draft?</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={discardAndCloseEditor}
                  className="flex-1 py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Discard Changes
                </button>
                <button
                  onClick={saveAndCloseEditor}
                  className="flex-1 py-2 px-4 text-sm font-medium text-white bg-[#2D9AA5] rounded-lg hover:bg-[#257A83] transition-colors"
                >
                  Save as draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Editor Confirm Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Reset editor?</h3>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Dismiss"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-6">Are you sure you want to reset the editor? This will clear the title, content, and slug.</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowResetConfirm(false);
                    resetEditorFields();
                  }}
                  className="flex-1 py-2 px-4 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                >
                  Yes, reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Link size={24} className="text-[#2D9AA5]" />
                Add Image Link
              </h3>
              <button
                onClick={() => {
                  setShowLinkModal(false);
                  setSelectedImage(null);
                  setLinkUrl("");
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Link URL (optional)
                </label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="text-gray-900 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9AA5] focus:border-transparent transition-all duration-200"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to remove existing link
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowLinkModal(false);
                    setSelectedImage(null);
                    setLinkUrl("");
                  }}
                  className="flex-1 py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLinkSubmit}
                  className="flex-1 py-2 px-4 text-sm font-medium text-white bg-[#2D9AA5] rounded-lg hover:bg-[#257A83] transition-colors"
                >
                  Apply Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirmModal && confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">
                Confirm Action
              </h3>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmAction(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-6">
                Are you sure you want to delete {confirmAction.title}? This
                action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    setConfirmAction(null);
                  }}
                  className="flex-1 py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAction}
                  className="flex-1 py-2 px-4 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Context Menu */}
      {showImageContextMenu && contextMenuImage && (
        <div
          className="fixed bg-white border border-gray-300 rounded-lg shadow-lg z-50 py-2 min-w-32"
          style={{
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`,
          }}
        >
          <button
            onClick={() => {
              openImageLinkEditor(contextMenuImage);
              setShowImageContextMenu(false);
              setContextMenuImage(null);
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <Link size={14} />
            Edit Link
          </button>
          <button
            onClick={removeImage}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <Trash2 size={14} />
            Remove
          </button>
        </div>
      )}

      {/* Video Context Menu */}
      {showVideoContextMenu && contextMenuVideo && (
        <div
          className="fixed bg-white border border-gray-300 rounded-lg shadow-lg z-50 py-2 min-w-32"
          style={{
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`,
          }}
        >
          <button
            onClick={removeVideo}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <Trash2 size={14} />
            Remove Video
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2D9AA5]"></div>
            <span className="text-gray-700 font-medium">Processing...</span>
          </div>
        </div>
      )}

      {/* Custom Styles for ReactQuill */}
      <style>{`
      .quill-container .ql-toolbar {
        position: sticky !important;
        top: 0 !important;
        z-index: 10 !important;
        border-top: 1px solid #d1d5db !important;
        border-left: 1px solid #d1d5db !important;
        border-right: 1px solid #d1d5db !important;
        border-bottom: 1px solid #d1d5db !important;
        border-radius: 6px 6px 0 0 !important;
        background: #f9fafb !important;
        margin: 0 !important;
      }

      /* Friendlier toolbar visuals */
      .quill-container .ql-toolbar .ql-formats {
        background: #ffffff !important;
        padding: 4px !important;
        border: 1px solid #e5e7eb !important;
        border-radius: 8px !important;
        margin-right: 12px !important;
      }

      .quill-container .ql-toolbar button {
        border-radius: 8px !important;
        padding: 6px !important;
        color: #334155 !important; /* slate-700 */
        transition: background-color 0.15s ease, color 0.15s ease,
          transform 0.05s ease !important;
      }

      .quill-container .ql-toolbar button:active {
        transform: translateY(0.5px) !important;
      }

      .quill-container .ql-container {
        border-left: 1px solid #d1d5db !important;
        border-right: 1px solid #d1d5db !important;
        border-bottom: 1px solid #d1d5db !important;
        border-top: none !important;
        border-radius: 0 0 6px 6px !important;
        height: calc(100% - 42px) !important;
      }

      .quill-container .ql-editor {
        height: 100% !important;
        overflow-y: auto !important;
        font-size: 14px !important;
        line-height: 1.5 !important;
        padding: 12px 15px !important;
      }

      .quill-container .ql-toolbar button:hover {
        background: #e6f6f8 !important; /* light teal */
        color: #2d9aa5 !important;
        border-radius: 8px !important;
      }

      .quill-container .ql-toolbar .ql-active {
        background: #2d9aa5 !important;
        color: white !important;
        border-radius: 8px !important;
      }

      .quill-container .ql-toolbar button svg {
        width: 18px !important;
        height: 18px !important;
      }

      /* Ensure Undo/Redo are clearly visible */
      .quill-container .ql-toolbar button.ql-undo,
      .quill-container .ql-toolbar button.ql-redo {
        color: #000000 !important; /* text-black */
      }
      .quill-container .ql-toolbar button.ql-undo:hover,
      .quill-container .ql-toolbar button.ql-redo:hover,
      .quill-container .ql-toolbar button.ql-undo.ql-active,
      .quill-container .ql-toolbar button.ql-redo.ql-active {
        color: #000000 !important;
      }

      .quill-container .ql-editor img {
        width: 100% !important;
        height: var(--ql-image-height, 300px) !important;
        object-fit: contain !important;
        display: block;
        margin: 8px auto;
      }

      .quill-container .ql-editor iframe,
      .quill-container .ql-editor video {
        display: block;
        margin: 12px auto;
        border-radius: 6px;
        max-width: 100%;
      }

      .quill-container .ql-snow .ql-tooltip {
        background: white !important;
        border: 1px solid #d1d5db !important;
        border-radius: 6px !important;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
        z-index: 1000 !important;
      }

      .quill-container .ql-toolbar .ql-formats {
        margin-right: 12px !important;
      }
    `}</style>
    </div>
  );
};

export default BlogEditor;
