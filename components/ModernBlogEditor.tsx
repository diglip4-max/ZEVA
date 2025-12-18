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
  Plus,
  Sparkles
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
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem(tokenKey);
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  };

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
            setTitle(res.data.draft.title || '');
            setContent(res.data.draft.content || '');
            setParamlink(res.data.draft.paramlink || '');
            const postedBy = res.data.draft.postedBy;
            setAuthorName(
              typeof postedBy === 'object' && postedBy !== null
                ? (postedBy.name || postedBy.username || '')
                : (postedBy || '')
            );
            // Set content in editor after a brief delay
            setTimeout(() => {
              if (editorRef.current) {
                editorRef.current.innerHTML = res.data.draft.content || '';
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
    }
  };

  // Handle paste events to clean HTML
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    updateContent();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string;
      if (editorRef.current) {
        editorRef.current.focus();
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '12px';
        img.style.margin = '16px 0';
        img.style.display = 'block';
        img.alt = 'Uploaded image';
        
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(img);
          
          // Move cursor after image
          range.setStartAfter(img);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          // Append at end
          editorRef.current.appendChild(img);
          const range = document.createRange();
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
          const newSelection = window.getSelection();
          if (newSelection) {
            newSelection.removeAllRanges();
            newSelection.addRange(range);
          }
        }
        
        updateContent();
      }
    };
    reader.onerror = () => {
      alert('Error reading image file');
    };
    reader.readAsDataURL(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

  const saveDraft = async () => {
    // Require some content to save
    if (!title && !content) {
      alert('Please enter at least a title or content');
      return;
    }

    // Always capture content from editor before saving
    let finalContent = content;
    if (editorRef.current) {
      const editorContent = editorRef.current.innerHTML || '';
      // Update state with editor content
      if (editorContent) {
        finalContent = editorContent;
        setContent(editorContent);
      }
    }
    
    // Ensure content is not empty - API requires non-empty content
    // Use minimal HTML structure if content is truly empty
    if (!finalContent || !finalContent.trim() || finalContent.trim() === '<br>' || finalContent.trim() === '<p></p>') {
      finalContent = '<p><br></p>';
    }

    // Ensure paramlink exists by auto-generating when missing
    let effectiveParamlink = paramlink?.trim();
    if (!effectiveParamlink) {
      const base = (title || 'untitled').toString();
      effectiveParamlink = slugify(base).slice(0, 60) || `untitled-${Date.now()}`;
      setParamlink(effectiveParamlink);
    }

    // Ensure title exists
    const effectiveTitle = (title || 'Untitled Draft').trim();

    setIsLoading(true);
    try {
      // Always send title, content, and paramlink (all non-empty)
      const draftData = {
        title: effectiveTitle,
        content: finalContent,
        paramlink: effectiveParamlink,
      };
      
      // Final validation - ensure all fields are non-empty strings
      if (!draftData.title || draftData.title.length === 0) {
        alert('Title is required');
        setIsLoading(false);
        return;
      }
      if (!draftData.content || draftData.content.length === 0) {
        alert('Content is required');
        setIsLoading(false);
        return;
      }
      if (!draftData.paramlink || draftData.paramlink.length === 0) {
        alert('URL slug is required');
        setIsLoading(false);
        return;
      }

      if (editDraftId) {
        await axios.put(
          `/api/blog/draft?id=${editDraftId}`,
          draftData,
          getAuthHeaders()
        );
      } else {
        await axios.post(
          '/api/blog/draft',
          draftData,
          getAuthHeaders()
        );
      }
      if (onSave) onSave();
      alert('Draft saved successfully!');
    } catch (error: any) {
      console.error('Error saving draft:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Failed to save draft';
      alert(errorMessage);
    } finally {
      setIsLoading(false);
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
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {editBlogId || editDraftId ? 'Edit Post' : 'Create New Post'}
              </h2>
              <p className="text-sm text-gray-500">Write something amazing</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Preview"
            >
              <Eye className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Main Editor */}
          <div className={`flex-1 flex flex-col ${showPreview ? 'w-1/2' : 'w-full'} transition-all duration-300`}>
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    formatText('bold');
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
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Italic"
                  type="button"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <button
                  onClick={() => formatText('underline')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Underline"
                >
                  <Underline className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    formatText('formatBlock', '<h1>');
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
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Heading 3"
                  type="button"
                >
                  <Heading3 className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button
                  onClick={() => formatText('justifyLeft')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Align Left"
                >
                  <AlignLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => formatText('justifyCenter')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Align Center"
                >
                  <AlignCenter className="w-4 h-4" />
                </button>
                <button
                  onClick={() => formatText('justifyRight')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Align Right"
                >
                  <AlignRight className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button
                  onClick={() => formatText('insertUnorderedList')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Bullet List"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => formatText('insertOrderedList')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Numbered List"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => formatText('formatBlock', '<blockquote>')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Quote"
                >
                  <Quote className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button
                  onClick={() => fileInputRef.current?.click()}
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
                    const url = prompt('Enter YouTube or video URL:');
                    if (url && editorRef.current) {
                      editorRef.current.focus();
                      
                      let embedUrl = url;
                      // Convert YouTube URL to embed format
                      if (url.includes('youtube.com/watch?v=')) {
                        const videoId = url.split('v=')[1]?.split('&')[0];
                        embedUrl = `https://www.youtube.com/embed/${videoId}`;
                      } else if (url.includes('youtu.be/')) {
                        const videoId = url.split('youtu.be/')[1]?.split('?')[0];
                        embedUrl = `https://www.youtube.com/embed/${videoId}`;
                      }
                      
                      const container = document.createElement('div');
                      container.style.margin = '16px 0';
                      container.style.textAlign = 'center';
                      
                      const iframe = document.createElement('iframe');
                      iframe.src = embedUrl;
                      iframe.width = '100%';
                      iframe.height = '400';
                      iframe.style.maxWidth = '100%';
                      iframe.style.borderRadius = '12px';
                      iframe.style.border = 'none';
                      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
                      iframe.allowFullscreen = true;
                      
                      container.appendChild(iframe);
                      
                      const selection = window.getSelection();
                      if (selection && selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        range.deleteContents();
                        range.insertNode(container);
                        range.setStartAfter(container);
                        range.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(range);
                      } else {
                        editorRef.current.appendChild(container);
                      }
                      
                      updateContent();
                    }
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
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Insert Link"
                >
                  <LinkIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Editor Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Title */}
              <input
                type="text"
                placeholder="Write a catchy title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-4xl font-bold mb-6 border-none outline-none placeholder-gray-400"
              />

              {/* Author Name */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Author name (optional)"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="w-full text-lg text-gray-600 border-none outline-none placeholder-gray-400"
                />
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
                className="min-h-[400px] text-lg leading-relaxed text-gray-700 focus:outline-none prose prose-lg max-w-none"
                style={{
                  wordBreak: 'break-word',
                }}
                suppressContentEditableWarning={true}
              />

              {/* Topics */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Topics / Tags
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
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={saveDraft}
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

