"use client";
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  Image as ImageIcon,
  Video,
  Link as LinkIcon,
  Send,
  X,
  Eye,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Plus
} from 'lucide-react';

interface ModernBlogEditorProps {
  tokenKey: "clinicToken" | "doctorToken" | "agentToken";
  onClose?: () => void;
  editBlogId?: string;
  editDraftId?: string;
  onSave?: () => void;
}

const ModernBlogEditor: React.FC<ModernBlogEditorProps> = ({
  tokenKey,
  onClose,
  editBlogId,
  editDraftId,
  onSave
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [paramlink, setParamlink] = useState('');
  const [featuredImage, setFeaturedImage] = useState<string>('');
  const [topics, setTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [readTime, setReadTime] = useState(0);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(editDraftId || null);
  const [showVideoOptions, setShowVideoOptions] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentRef = useRef<string>('');
  const lastTitleRef = useRef<string>('');

  const getAuthHeaders = () => {
    const token = localStorage.getItem(tokenKey);
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  };

  // Track content changes with MutationObserver to ensure updates are captured
  useEffect(() => {
    if (!editorRef.current) return;
    
    const observer = new MutationObserver(() => {
      // Content changed, update state
      updateContent();
    });
    
    observer.observe(editorRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['src', 'href'] // Track image/video src changes
    });
    
    return () => observer.disconnect();
  }, []);

  // Load blog/draft if editing
  useEffect(() => {
    const loadBlog = async () => {
      if (editBlogId) {
        try {
          const res = await axios.get(`/api/blog/published?id=${editBlogId}`, getAuthHeaders());
          if (res.data.success && res.data.blog) {
            setTitle(res.data.blog.title || '');
            setContent(res.data.blog.content || '');
            setParamlink(res.data.blog.paramlink || '');
            const postedBy = res.data.blog.postedBy;
            setAuthorName(
              typeof postedBy === 'object' && postedBy !== null
                ? (postedBy.name || postedBy.username || '')
                : (postedBy || '')
            );
            // Set content in editor after a brief delay
            setTimeout(() => {
              if (editorRef.current) {
                editorRef.current.innerHTML = res.data.blog.content || '';
              }
            }, 100);
          }
        } catch (error) {
          console.error('Error loading blog:', error);
        }
      } else if (editDraftId) {
        try {
          const res = await axios.get(`/api/blog/draft?id=${editDraftId}`, getAuthHeaders());
          if (res.data.success && res.data.draft) {
            const draftTitle = res.data.draft.title || '';
            const draftContent = res.data.draft.content || '';
            // Set title - preserve actual title from database, even if empty
            setTitle(draftTitle);
            setContent(draftContent);
            setParamlink(res.data.draft.paramlink || '');
            setCurrentDraftId(editDraftId);
            // Store last saved values to prevent overwriting - use actual saved values
            lastTitleRef.current = draftTitle || '';
            lastContentRef.current = draftContent || '';
            const postedBy = res.data.draft.postedBy;
            setAuthorName(
              typeof postedBy === 'object' && postedBy !== null
                ? (postedBy.name || postedBy.username || '')
                : (postedBy || '')
            );
            // Set content in editor after a brief delay
            setTimeout(() => {
              if (editorRef.current) {
                editorRef.current.innerHTML = draftContent;
              }
            }, 100);
          }
        } catch (error) {
          console.error('Error loading draft:', error);
        }
      }
    };
    loadBlog();
  }, [editBlogId, editDraftId]);

  // Sync editor content with state
  useEffect(() => {
    if (editorRef.current && content !== editorRef.current.innerHTML) {
      // Only update if content changed externally (e.g., from loading blog)
      const currentContent = editorRef.current.innerHTML;
      if (content && content !== currentContent && currentContent === '') {
        editorRef.current.innerHTML = content;
      }
    }
  }, [content]);

  // Calculate word count and read time
  useEffect(() => {
    const text = content.replace(/<[^>]*>/g, '').trim();
    const words = text.split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
    setReadTime(Math.ceil(words.length / 200)); // Average reading speed: 200 words/min
  }, [content]);

  // Auto-save functionality - saves every 1 minute (60 seconds)
  useEffect(() => {
    // Clear any existing timer
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }

    // Set up auto-save interval (1 minute = 60000ms)
    autoSaveTimerRef.current = setInterval(() => {
      // Only auto-save if there's content and we have a draft ID (to update, not create new)
      // This ensures we only create one draft, then update it
      if (currentDraftId || editDraftId) {
        // We have an existing draft, update it
        if (title || content || (editorRef.current && editorRef.current.innerHTML.trim() !== '')) {
          saveDraft(true); // true indicates auto-save
        }
      } else {
        // No draft yet, but only create one if user has typed something
        const hasContent = title || (editorRef.current && editorRef.current.innerHTML.trim() !== '');
        if (hasContent) {
          saveDraft(true); // This will create the first draft
        }
      }
    }, 60000); // 1 minute (60 seconds)

    // Cleanup on unmount
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [currentDraftId, editDraftId]); // Re-run when draft ID changes

  // Ensure editor always has cursor when empty
  useEffect(() => {
    if (editorRef.current) {
      const checkCursor = () => {
        if (editorRef.current) {
          const isEmpty = !editorRef.current.textContent || editorRef.current.textContent.trim() === '';
          if (isEmpty && editorRef.current.innerHTML === '') {
            // Add a paragraph to ensure cursor is visible
            editorRef.current.innerHTML = '<p><br></p>';
            const range = document.createRange();
            const selection = window.getSelection();
            if (selection && editorRef.current.firstChild) {
              range.setStart(editorRef.current.firstChild, 0);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
            }
          }
        }
      };
      
      // Check on mount and after content changes
      const timer = setTimeout(checkCursor, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  // Format text with proper selection handling
  const formatText = (command: string, value?: string) => {
    if (!editorRef.current) return;
    
    editorRef.current.focus();
    
    // Save current selection
    let selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // No selection, create a range at cursor
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    try {
      // Execute command
      if (value) {
        document.execCommand(command, false, value);
      } else {
        document.execCommand(command, false);
      }
      
      // Update content after formatting
      setTimeout(() => {
        updateContent();
        editorRef.current?.focus();
      }, 10);
    } catch (error) {
      console.error('Error executing command:', error);
    }
  };

  const updateContent = () => {
    if (editorRef.current) {
      const htmlContent = editorRef.current.innerHTML || '';
      // Always update content, even if empty (will be handled in save)
      setContent(htmlContent);
      // Also update lastContentRef for change detection
      lastContentRef.current = htmlContent;
    }
  };

  // Handle paste events to clean HTML
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    updateContent();
  };

  const removeImage = (imageContainer: HTMLElement) => {
    if (!editorRef.current) return;
    
    // Create a paragraph after the image for cursor positioning
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    
    // Insert paragraph after image container - use insertAdjacentElement for safety
    if (imageContainer.parentNode) {
      imageContainer.insertAdjacentElement('afterend', p);
    } else {
      editorRef.current.appendChild(p);
    }
    
    // Remove the image container
    imageContainer.remove();
    
    // Set cursor in the new paragraph
    const range = document.createRange();
    range.selectNodeContents(p);
    range.collapse(true);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    editorRef.current.focus();
    updateContent();
  };

  const insertVideoFromUrl = (url: string) => {
    if (!editorRef.current || !url.trim()) return;
    
    editorRef.current.focus();
    
    let embedUrl = url.trim();
    let videoType = 'iframe';
    
    // YouTube URL handling
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      embedUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      embedUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (url.includes('youtube.com/embed/')) {
      embedUrl = url;
    }
    // Vimeo URL handling
    else if (url.includes('vimeo.com/')) {
      const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
      embedUrl = `https://player.vimeo.com/video/${videoId}`;
    }
    // Dailymotion URL handling
    else if (url.includes('dailymotion.com/video/')) {
      const videoId = url.split('dailymotion.com/video/')[1]?.split('?')[0];
      embedUrl = `https://www.dailymotion.com/embed/video/${videoId}`;
    } else if (url.includes('dai.ly/')) {
      const videoId = url.split('dai.ly/')[1]?.split('?')[0];
      embedUrl = `https://www.dailymotion.com/embed/video/${videoId}`;
    }
    // Direct video file (MP4, WebM, etc.)
    else if (url.match(/\.(mp4|webm|ogg|mov|avi|wmv|flv)(\?.*)?$/i)) {
      videoType = 'video';
    }
    // Generic iframe URL
    else if (url.includes('embed') || url.includes('iframe')) {
      embedUrl = url;
    }
    // If none match, try to use as direct video URL
    else {
      videoType = 'video';
    }
    
    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.margin = '16px 0';
    container.style.textAlign = 'center';
    container.style.display = 'inline-block';
    container.style.width = '100%';
    container.className = 'video-container';
    
    let mediaElement: HTMLElement;
    
    if (videoType === 'video') {
      const video = document.createElement('video');
      video.src = embedUrl;
      video.controls = true;
      video.style.width = '100%';
      video.style.maxWidth = '100%';
      video.style.height = 'auto';
      video.style.borderRadius = '12px';
      video.style.display = 'block';
      mediaElement = video;
    } else {
      const iframe = document.createElement('iframe');
      iframe.src = embedUrl;
      iframe.width = '100%';
      iframe.height = '400';
      iframe.style.maxWidth = '100%';
      iframe.style.borderRadius = '12px';
      iframe.style.border = 'none';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      mediaElement = iframe;
    }
    
    // Create remove button
    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '×';
    removeBtn.style.position = 'absolute';
    removeBtn.style.top = '8px';
    removeBtn.style.right = '8px';
    removeBtn.style.width = '32px';
    removeBtn.style.height = '32px';
    removeBtn.style.borderRadius = '50%';
    removeBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    removeBtn.style.color = 'white';
    removeBtn.style.border = 'none';
    removeBtn.style.cursor = 'pointer';
    removeBtn.style.display = 'flex';
    removeBtn.style.alignItems = 'center';
    removeBtn.style.justifyContent = 'center';
    removeBtn.style.fontSize = '20px';
    removeBtn.style.fontWeight = 'bold';
    removeBtn.style.opacity = '0';
    removeBtn.style.transition = 'opacity 0.2s';
    removeBtn.style.zIndex = '10';
    removeBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      if (container.parentNode) {
        container.insertAdjacentElement('afterend', p);
      } else {
        editorRef.current?.appendChild(p);
      }
      container.remove();
      const range = document.createRange();
      range.selectNodeContents(p);
      range.collapse(true);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      editorRef.current?.focus();
      updateContent();
    };
    
    container.onmouseenter = () => {
      removeBtn.style.opacity = '1';
    };
    container.onmouseleave = () => {
      removeBtn.style.opacity = '0';
    };
    
    container.appendChild(mediaElement);
    container.appendChild(removeBtn);
    
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(container);
      
      if (container.parentNode) {
        container.insertAdjacentElement('afterend', p);
      } else {
        editorRef.current.appendChild(p);
      }
      
      const newRange = document.createRange();
      newRange.selectNodeContents(p);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
    } else {
      editorRef.current.appendChild(container);
      editorRef.current.appendChild(p);
      
      const range = document.createRange();
      range.selectNodeContents(p);
      range.collapse(true);
      const newSelection = window.getSelection();
      if (newSelection) {
        newSelection.removeAllRanges();
        newSelection.addRange(range);
      }
    }
    
    editorRef.current.focus();
    updateContent();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    // Show loading state
    showToast('Uploading image...', 'success');
    
    try {
      // Upload image to server first to avoid base64 in content (prevents 413 error)
      const formData = new FormData();
      formData.append('file', file);
      
      const token = localStorage.getItem(tokenKey);
      
      // Upload to server
      const uploadResponse = await axios.post(
        '/api/blog/upload',
        formData,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            // Don't set Content-Type - let browser set it with boundary for multipart/form-data
          },
        }
      );
      
      if (!uploadResponse.data || !uploadResponse.data.url) {
        throw new Error('Upload failed: No URL returned from server');
      }
      
      const imageUrl = uploadResponse.data.url;
      
      if (editorRef.current) {
        editorRef.current.focus();
        
        // Create container div for image with remove button
        const container = document.createElement('div');
        container.style.position = 'relative';
        container.style.margin = '16px 0';
        container.style.display = 'inline-block';
        container.style.width = '100%';
        container.className = 'image-container';
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '12px';
        img.style.display = 'block';
        img.alt = 'Uploaded image';
        
        // Create remove button
        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '×';
        removeBtn.style.position = 'absolute';
        removeBtn.style.top = '8px';
        removeBtn.style.right = '8px';
        removeBtn.style.width = '32px';
        removeBtn.style.height = '32px';
        removeBtn.style.borderRadius = '50%';
        removeBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
        removeBtn.style.color = 'white';
        removeBtn.style.border = 'none';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.display = 'flex';
        removeBtn.style.alignItems = 'center';
        removeBtn.style.justifyContent = 'center';
        removeBtn.style.fontSize = '20px';
        removeBtn.style.fontWeight = 'bold';
        removeBtn.style.opacity = '0';
        removeBtn.style.transition = 'opacity 0.2s';
        removeBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          removeImage(container);
        };
        
        // Show remove button on hover
        container.onmouseenter = () => {
          removeBtn.style.opacity = '1';
        };
        container.onmouseleave = () => {
          removeBtn.style.opacity = '0';
        };
        
        container.appendChild(img);
        container.appendChild(removeBtn);
        
        // Create paragraph after image for cursor positioning
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(container);
          
          // Insert paragraph after container - use insertAdjacentElement for safety
          if (container.parentNode) {
            container.insertAdjacentElement('afterend', p);
          } else {
            editorRef.current.appendChild(p);
          }
          
          // Move cursor to the paragraph after image
          const newRange = document.createRange();
          newRange.selectNodeContents(p);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        } else {
          // Append at end
          editorRef.current.appendChild(container);
          editorRef.current.appendChild(p);
          
          // Set cursor in the paragraph
          const range = document.createRange();
          range.selectNodeContents(p);
          range.collapse(true);
          const newSelection = window.getSelection();
          if (newSelection) {
            newSelection.removeAllRanges();
            newSelection.addRange(range);
          }
        }
        
        editorRef.current.focus();
        
        // Force content update immediately after image insertion
        setTimeout(() => {
          updateContent();
          // Trigger input event to ensure content is tracked
          const inputEvent = new Event('input', { bubbles: true });
          editorRef.current?.dispatchEvent(inputEvent);
        }, 100);
        
        showToast('Image uploaded successfully', 'success');
      }
    } catch (error: any) {
      console.error('Error uploading image:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to upload image';
      showToast(errorMessage, 'error');
      alert(`Failed to upload image: ${errorMessage}`);
    } finally {
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      alert('Video size should be less than 100MB');
      return;
    }

    if (!file.type.startsWith('video/')) {
      alert('Please select a valid video file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const videoUrl = event.target?.result as string;
      if (editorRef.current) {
        editorRef.current.focus();
        
        const container = document.createElement('div');
        container.style.position = 'relative';
        container.style.margin = '16px 0';
        container.style.textAlign = 'center';
        container.style.display = 'inline-block';
        container.style.width = '100%';
        container.className = 'video-container';
        
        const video = document.createElement('video');
        video.src = videoUrl;
        video.controls = true;
        video.style.width = '100%';
        video.style.maxWidth = '100%';
        video.style.height = 'auto';
        video.style.borderRadius = '12px';
        video.style.display = 'block';
        
        // Create remove button
        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '×';
        removeBtn.style.position = 'absolute';
        removeBtn.style.top = '8px';
        removeBtn.style.right = '8px';
        removeBtn.style.width = '32px';
        removeBtn.style.height = '32px';
        removeBtn.style.borderRadius = '50%';
        removeBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
        removeBtn.style.color = 'white';
        removeBtn.style.border = 'none';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.display = 'flex';
        removeBtn.style.alignItems = 'center';
        removeBtn.style.justifyContent = 'center';
        removeBtn.style.fontSize = '20px';
        removeBtn.style.fontWeight = 'bold';
        removeBtn.style.opacity = '0';
        removeBtn.style.transition = 'opacity 0.2s';
        removeBtn.style.zIndex = '10';
        removeBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const p = document.createElement('p');
          p.innerHTML = '<br>';
          if (container.parentNode) {
            container.insertAdjacentElement('afterend', p);
          } else {
            editorRef.current?.appendChild(p);
          }
          container.remove();
          const range = document.createRange();
          range.selectNodeContents(p);
          range.collapse(true);
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
          editorRef.current?.focus();
          updateContent();
        };
        
        container.onmouseenter = () => {
          removeBtn.style.opacity = '1';
        };
        container.onmouseleave = () => {
          removeBtn.style.opacity = '0';
        };
        
        container.appendChild(video);
        container.appendChild(removeBtn);
        
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(container);
          
          if (container.parentNode) {
            container.insertAdjacentElement('afterend', p);
          } else {
            editorRef.current.appendChild(p);
          }
          
          const newRange = document.createRange();
          newRange.selectNodeContents(p);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        } else {
          editorRef.current.appendChild(container);
          editorRef.current.appendChild(p);
          
          const range = document.createRange();
          range.selectNodeContents(p);
          range.collapse(true);
          const newSelection = window.getSelection();
          if (newSelection) {
            newSelection.removeAllRanges();
            newSelection.addRange(range);
          }
        }
        
        editorRef.current.focus();
        updateContent();
      }
    };
    reader.onerror = () => {
      alert('Error reading video file');
    };
    reader.readAsDataURL(file);
    
    // Reset input
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
    setShowVideoOptions(false);
  };

  const addTopic = () => {
    if (newTopic.trim() && !topics.includes(newTopic.trim())) {
      setTopics([...topics, newTopic.trim()]);
      setNewTopic('');
    }
  };

  const removeTopic = (topic: string) => {
    setTopics(topics.filter(t => t !== topic));
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

  useEffect(() => {
    if (title && !paramlink) {
      setParamlink(slugify(title));
    }
  }, [title]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const saveDraft = async (isAutoSave: boolean = false) => {
    // Always capture content directly from editor DOM (most up-to-date)
    // Don't rely on state which might be stale
    let finalContent = '';
    if (editorRef.current) {
      finalContent = editorRef.current.innerHTML || '';
      // Update state with editor content to keep it in sync
      setContent(finalContent);
    } else {
      // Fallback to state if editor ref is not available
      finalContent = content || '';
    }
    
    // Get current title from state - use actual value, don't default yet
    const currentTitleFromState = title?.trim() || '';
    const currentContent = finalContent || '<p><br></p>';
    
    // Skip auto-save if no changes detected (prevents saving same content multiple times)
    if (isAutoSave) {
      // Compare with last saved content and title to avoid duplicate saves
      // Use the actual title from state, not the defaulted one
      if (currentContent === lastContentRef.current && currentTitleFromState === lastTitleRef.current) {
        return; // No changes, skip save to avoid creating duplicate drafts
      }
    }
    
    // Ensure content is not empty - API requires non-empty content
    // Use minimal HTML structure if content is truly empty
    if (!finalContent || !finalContent.trim() || finalContent.trim() === '<br>' || finalContent.trim() === '<p></p>') {
      finalContent = '<p><br></p>';
    }

    // Determine draft ID to use (before try block for error handling)
    const draftIdToUse = currentDraftId || editDraftId;
    
    // Determine effective title - always preserve user's title, never overwrite with "Untitled Draft"
    let effectiveTitle: string;
    
    if (draftIdToUse) {
      // Existing draft - prioritize title from state (what user typed)
      // If state is empty, use last saved title to preserve existing title
      if (currentTitleFromState && currentTitleFromState.trim() !== '') {
        // User has typed a title - use it
        effectiveTitle = currentTitleFromState;
      } else if (lastTitleRef.current && lastTitleRef.current.trim() !== '' && lastTitleRef.current !== 'Untitled Draft') {
        // No title in state, but we have a saved title - preserve it
        effectiveTitle = lastTitleRef.current;
      } else {
        // Truly no title exists - only then use default
        effectiveTitle = 'Untitled Draft';
      }
    } else {
      // New draft - use title from state or default to "Untitled Draft"
      effectiveTitle = currentTitleFromState || 'Untitled Draft';
    }
    
    // Final check - ensure title is not empty (API requirement)
    // But don't overwrite if user has a title
    if (!effectiveTitle || effectiveTitle.trim() === '') {
      effectiveTitle = 'Untitled Draft';
    }

    // Ensure paramlink exists by auto-generating when missing
    let effectiveParamlink = paramlink?.trim();
    if (!effectiveParamlink) {
      const base = (effectiveTitle || 'untitled').toString();
      effectiveParamlink = slugify(base).slice(0, 60) || `untitled-${Date.now()}`;
      setParamlink(effectiveParamlink);
    }

    if (!isAutoSave) {
      setIsLoading(true);
    }
    
    try {
      // Final validation - ensure all fields are non-empty (API requirement)
      if (!effectiveTitle || effectiveTitle.trim() === '') {
        effectiveTitle = 'Untitled Draft';
      }
      if (!finalContent || finalContent.trim() === '') {
        finalContent = '<p><br></p>';
      }
      if (!effectiveParamlink || effectiveParamlink.trim() === '') {
        const base = (effectiveTitle || 'untitled').toString();
        effectiveParamlink = slugify(base).slice(0, 60) || `untitled-${Date.now()}`;
        setParamlink(effectiveParamlink);
      }
      
      const draftData = {
        title: effectiveTitle.trim(),
        content: finalContent,
        paramlink: effectiveParamlink.trim(),
      };
      
      // Don't update title state after saving - preserve what user has typed
      // The title state should only be updated by user input, not by save operation

      let response;
      
      // Add timeout to prevent hanging requests
      const axiosConfig = {
        ...getAuthHeaders(),
        timeout: 30000, // 30 seconds timeout
      };
      
      if (draftIdToUse) {
        // Update existing draft
        response = await axios.put(
          `/api/blog/draft?id=${draftIdToUse}`,
          draftData,
          axiosConfig
        );
      } else {
        // Create new draft
        response = await axios.post(
          '/api/blog/draft',
          draftData,
          axiosConfig
        );
        // Save the draft ID for future updates
        if (response.data?.success && response.data?.draft?._id) {
          setCurrentDraftId(response.data.draft._id);
        }
      }
      
      // Update last saved content and title
      lastContentRef.current = finalContent;
      lastTitleRef.current = effectiveTitle;
      setLastSaved(new Date());
      
      if (onSave) onSave();
      
      if (isAutoSave) {
        showToast('Draft auto-saved', 'success');
      } else {
        showToast('Draft saved successfully!', 'success');
      }
    } catch (error: any) {
      console.error('Error saving draft:', error);
      console.error('Draft data sent:', { 
        title: effectiveTitle, 
        contentLength: finalContent.length, 
        paramlink: effectiveParamlink,
        draftId: draftIdToUse 
      });
      
      let errorMessage = 'Failed to save draft';
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        // Request timeout
        errorMessage = 'Request timed out. Please check your connection and try again.';
        console.error('Request timeout:', error);
      } else if (error.response) {
        // Server responded with error
        errorMessage = error.response.data?.message || error.response.data?.error || `Server error: ${error.response.status}`;
        console.error('Server error response:', error.response.data);
      } else if (error.request) {
        // Request was made but no response received
        errorMessage = 'Network error: Unable to connect to server. Please check your internet connection.';
        console.error('Network error - no response:', error.request);
      } else {
        // Something else happened
        errorMessage = error.message || 'Unknown error occurred';
        console.error('Error setting up request:', error.message);
      }
      
      if (isAutoSave) {
        showToast('Auto-save failed', 'error');
      } else {
        showToast(errorMessage, 'error');
      }
    } finally {
      if (!isAutoSave) {
        setIsLoading(false);
      }
    }
  };

  const publishBlog = async () => {
    if (!title || !content) {
      alert('Title and content are required');
      return;
    }

    // Ensure paramlink exists by auto-generating when missing
    let effectiveParamlink = paramlink?.trim();
    if (!effectiveParamlink) {
      const base = (title || 'untitled').toString();
      effectiveParamlink = slugify(base).slice(0, 60) || `untitled-${Date.now()}`;
      setParamlink(effectiveParamlink);
    }

    setIsPublishing(true);
    try {
      const publishData = {
        title: title.trim(),
        content: content.trim(),
        paramlink: effectiveParamlink,
      };

      if (editBlogId) {
        await axios.put(
          `/api/blog/published?id=${editBlogId}`,
          publishData,
          getAuthHeaders()
        );
      } else {
        await axios.post(
          '/api/blog/published',
          publishData,
          getAuthHeaders()
        );
      }
      if (onSave) onSave();
      alert('Blog published successfully!');
      if (onClose) onClose();
    } catch (error: any) {
      console.error('Error publishing blog:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Failed to publish blog';
      alert(errorMessage);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {/* Video Options Modal */}
      {showVideoOptions && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowVideoOptions(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Add Video</h3>
              <button
                onClick={() => setShowVideoOptions(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => {
                  videoInputRef.current?.click();
                }}
                className="w-full flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all group"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Video className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">Upload Video</div>
                  <div className="text-sm text-gray-500">Upload a video file from your device</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowVideoOptions(false);
                  const url = prompt('Enter video URL (YouTube, Vimeo, Dailymotion, or direct video link):');
                  if (url && url.trim()) {
                    insertVideoFromUrl(url);
                  }
                }}
                className="w-full flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all group"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <LinkIcon className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">Add URL</div>
                  <div className="text-sm text-gray-500">Paste a video link (YouTube, Vimeo, etc.)</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toaster Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[60] animate-in slide-in-from-top-5">
          <div className={`px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 ${
            toast.type === 'success' 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 hover:opacity-70"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header - Compact */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {editBlogId || editDraftId ? 'Edit Post' : 'New Post'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Preview"
            >
              <Eye className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Title at Top */}
        <div className="px-6 py-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="Title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-3xl font-bold border-none outline-none placeholder-gray-400"
          />
        </div>

        <div className="flex-1 overflow-hidden flex relative">
          {/* Main Editor */}
          <div className={`flex-1 flex flex-col ${showPreview ? 'w-1/2' : 'w-full'} transition-all duration-300`}>
            {/* Floating Toolbar in Corner */}
            <div className="absolute top-4 right-4 z-10">
              <div className="relative">
                {/* Plus Button */}
                <button
                  onClick={() => setShowToolbar(!showToolbar)}
                  className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all transform hover:scale-110"
                  title="Formatting Options"
                >
                  <Plus className={`w-6 h-6 transition-transform ${showToolbar ? 'rotate-45' : ''}`} />
                </button>
                
                {/* Expanded Toolbar */}
                {showToolbar && (
                  <div className="absolute top-14 right-0 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 min-w-[220px] max-h-[85vh] overflow-y-auto z-20">
                    <div className="flex flex-col gap-1">
                      <div className="text-xs font-semibold text-gray-500 mb-2 px-2">Text Format</div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            formatText('bold');
                            setShowToolbar(false);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Bold"
                          type="button"
                        >
                          <Bold className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            formatText('italic');
                            setShowToolbar(false);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Italic"
                          type="button"
                        >
                          <Italic className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            formatText('underline');
                            setShowToolbar(false);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Underline"
                        >
                          <Underline className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="border-t border-gray-200 my-2"></div>
                      <div className="text-xs font-semibold text-gray-500 mb-2 px-2">Headings</div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            formatText('formatBlock', '<h1>');
                            setShowToolbar(false);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Heading 1"
                          type="button"
                        >
                          <Heading1 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            formatText('formatBlock', '<h2>');
                            setShowToolbar(false);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Heading 2"
                          type="button"
                        >
                          <Heading2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            formatText('formatBlock', '<h3>');
                            setShowToolbar(false);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Heading 3"
                          type="button"
                        >
                          <Heading3 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="border-t border-gray-200 my-2"></div>
                      <div className="text-xs font-semibold text-gray-500 mb-2 px-2">Alignment</div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          onClick={() => {
                            formatText('justifyLeft');
                            setShowToolbar(false);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Align Left"
                        >
                          <AlignLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            formatText('justifyCenter');
                            setShowToolbar(false);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Align Center"
                        >
                          <AlignCenter className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            formatText('justifyRight');
                            setShowToolbar(false);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Align Right"
                        >
                          <AlignRight className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="border-t border-gray-200 my-2"></div>
                      <div className="text-xs font-semibold text-gray-500 mb-2 px-2">Lists & More</div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          onClick={() => {
                            formatText('insertUnorderedList');
                            setShowToolbar(false);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Bullet List"
                        >
                          <List className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            formatText('insertOrderedList');
                            setShowToolbar(false);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Numbered List"
                        >
                          <List className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            formatText('formatBlock', '<blockquote>');
                            setShowToolbar(false);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Quote"
                        >
                          <Quote className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="border-t border-gray-200 my-2"></div>
                      <div className="text-xs font-semibold text-gray-500 mb-2 px-2">Media</div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          onClick={() => {
                            fileInputRef.current?.click();
                            setShowToolbar(false);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Insert Image"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        <button
                          onClick={() => {
                            setShowVideoOptions(true);
                            setShowToolbar(false);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Insert Video"
                        >
                          <Video className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            const selection = window.getSelection();
                            if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
                              alert('Please select text to create a link');
                              setShowToolbar(false);
                              return;
                            }
                            
                            const url = prompt('Enter link URL:', 'https://');
                            if (url && url.trim()) {
                              if (!url.startsWith('http://') && !url.startsWith('https://')) {
                                formatText('createLink', `https://${url}`);
                              } else {
                                formatText('createLink', url);
                              }
                            }
                            setShowToolbar(false);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Insert Link"
                        >
                          <LinkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Editor Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Story/Content Editor */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Story</label>
              </div>

              {/* Comprehensive Toolbar - All in One Line */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Text Formatting */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      formatText('bold');
                    }}
                    className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-300"
                    title="Bold (Ctrl+B)"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      formatText('italic');
                    }}
                    className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-300"
                    title="Italic (Ctrl+I)"
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => formatText('underline')}
                    className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-300"
                    title="Underline (Ctrl+U)"
                  >
                    <Underline className="w-4 h-4" />
                  </button>
                  
                  <div className="w-px h-6 bg-gray-300 mx-1" />
                  
                  {/* Headings */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      formatText('formatBlock', '<h1>');
                    }}
                    className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-300"
                    title="Heading 1"
                  >
                    <Heading1 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      formatText('formatBlock', '<h2>');
                    }}
                    className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-300"
                    title="Heading 2"
                  >
                    <Heading2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      formatText('formatBlock', '<h3>');
                    }}
                    className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-300"
                    title="Heading 3"
                  >
                    <Heading3 className="w-4 h-4" />
                  </button>
                  
                  <div className="w-px h-6 bg-gray-300 mx-1" />
                  
                  {/* Alignment */}
                  <button
                    onClick={() => formatText('justifyLeft')}
                    className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-300"
                    title="Align Left"
                  >
                    <AlignLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => formatText('justifyCenter')}
                    className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-300"
                    title="Align Center"
                  >
                    <AlignCenter className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => formatText('justifyRight')}
                    className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-300"
                    title="Align Right"
                  >
                    <AlignRight className="w-4 h-4" />
                  </button>
                  
                  <div className="w-px h-6 bg-gray-300 mx-1" />
                  
                  {/* Lists & Quote */}
                  <button
                    onClick={() => formatText('insertUnorderedList')}
                    className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-300"
                    title="Bullet List"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => formatText('insertOrderedList')}
                    className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-300"
                    title="Numbered List"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => formatText('formatBlock', '<blockquote>')}
                    className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-300"
                    title="Quote"
                  >
                    <Quote className="w-4 h-4" />
                  </button>
                  
                  <div className="w-px h-6 bg-gray-300 mx-1" />
                  
                  {/* Media */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-300"
                    title="Insert Image"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => setShowVideoOptions(true)}
                    className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-300"
                    title="Insert Video"
                  >
                    <Video className="w-4 h-4" />
                  </button>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => {
                      const selection = window.getSelection();
                      if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
                        alert('Please select text to create a link');
                        return;
                      }
                      
                      const url = prompt('Enter link URL:', 'https://');
                      if (url && url.trim()) {
                        if (!url.startsWith('http://') && !url.startsWith('https://')) {
                          formatText('createLink', `https://${url}`);
                        } else {
                          formatText('createLink', url);
                        }
                      }
                    }}
                    className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-300"
                    title="Insert Link"
                  >
                    <LinkIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Featured Image */}
              {featuredImage && (
                <div className="mb-6 relative group">
                  <img
                    src={featuredImage}
                    alt="Featured"
                    className="w-full h-64 object-cover rounded-2xl"
                  />
                  <button
                    onClick={() => setFeaturedImage('')}
                    className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}

              {/* Content Editor */}
              <div
                ref={editorRef}
                contentEditable
                onInput={updateContent}
                onPaste={handlePaste}
                onBlur={updateContent}
                onKeyDown={() => {
                  // Ensure cursor is visible after key presses
                  if (editorRef.current) {
                    setTimeout(() => {
                      const selection = window.getSelection();
                      if (selection && selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        // Ensure cursor is visible
                        try {
                          range.collapse(true);
                          selection.removeAllRanges();
                          selection.addRange(range);
                        } catch (err) {
                          // Ignore errors
                        }
                      }
                    }, 0);
                  }
                }}
                onClick={() => {
                  // Ensure cursor is visible on click
                  if (editorRef.current) {
                    setTimeout(() => {
                      editorRef.current?.focus();
                    }, 0);
                  }
                }}
                className="min-h-[400px] text-lg leading-relaxed text-gray-700 focus:outline-none prose prose-lg max-w-none"
                style={{
                  wordBreak: 'break-word',
                  caretColor: '#9333ea', // Purple cursor color for visibility
                  outline: 'none',
                }}
                suppressContentEditableWarning={true}
              />

              {/* Topics */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  #Hashtags
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {topics.map((topic) => (
                    <span
                      key={topic}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-full text-sm font-medium"
                    >
                      #{topic}
                      <button
                        onClick={() => removeTopic(topic)}
                        className="hover:text-purple-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a topic..."
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTopic();
                      }
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={addTopic}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* URL Slug */}
              <div className="mt-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  URL Slug
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">/blogs/</span>
                  <input
                    type="text"
                    value={paramlink}
                    onChange={(e) => setParamlink(slugify(e.target.value))}
                    placeholder="blog-url-slug"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Footer Stats */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>{wordCount} words</span>
                <span>{readTime} min read</span>
                {lastSaved && (
                  <span className="text-xs text-gray-500">
                    Last saved: {lastSaved.toLocaleTimeString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => saveDraft(false)}
                  disabled={isLoading}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  onClick={publishBlog}
                  disabled={isPublishing}
                  className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {isPublishing ? 'Publishing...' : 'Publish'}
                </button>
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          {showPreview && (
            <div className="w-1/2 border-l border-gray-200 overflow-y-auto bg-gray-50 p-6">
              <h3 className="text-2xl font-bold mb-4">Preview</h3>
              <article className="bg-white rounded-2xl p-8 shadow-lg">
                {featuredImage && (
                  <img
                    src={featuredImage}
                    alt="Featured"
                    className="w-full h-64 object-cover rounded-xl mb-6"
                  />
                )}
                <h1 className="text-4xl font-bold mb-4">{title || 'Untitled'}</h1>
                {authorName && (
                  <p className="text-lg text-gray-600 mb-6">By {authorName}</p>
                )}
                <div
                  className="prose prose-lg max-w-none"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
                {topics.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <div className="flex flex-wrap gap-2">
                      {topics.map((topic) => (
                        <span
                          key={topic}
                          className="px-3 py-1 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-full text-sm font-medium"
                        >
                          #{topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModernBlogEditor;

