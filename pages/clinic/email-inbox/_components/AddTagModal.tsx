import React, { useEffect, useState } from "react";
import { X, Tag } from "lucide-react";

interface IProps {
  isOpen: boolean;
  onClose: () => void;
  leadId?: string;
  conversationTitle?: string;
  existingTags?: string[];
  handleAddTagToConversation: (leadId: string, tag: string) => Promise<void>;
  loading: boolean;
}

const AddTagModal: React.FC<IProps> = ({
  isOpen,
  onClose,
  leadId,
  conversationTitle = "Email",
  existingTags = [],
  handleAddTagToConversation,
  loading = false,
}) => {
  const [tagName, setTagName] = useState<string>("");

  const exampleTags = [
    "Important",
    "Follow-up",
    "Urgent",
    "Resolved",
    "Needs Review",
    "Escalated",
    "Customer Support",
    "Sales Inquiry",
    "Technical Issue",
    "Feature Request",
    "Bug Report",
    "Positive Feedback",
    "Negative Feedback",
    "Billing Issue",
    "Onboarding",
    "VIP Customer",
    "Priority Ticket",
    "Awaiting Response",
  ];

  useEffect(() => {
    if (!isOpen) {
      resetModal();
    }
  }, [isOpen]);

  const resetModal = () => {
    setTagName("");
  };

  const handleBackdropClick = () => {
    if (!loading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="pi-add-tag-modal-backdrop" onClick={handleBackdropClick}>
      <div
        className="pi-add-tag-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-tag-modal-title"
      >
        <div className="pi-add-tag-modal-header">
          <div>
            <div className="pi-add-tag-modal-title-section">
              <Tag className="w-5 h-5 text-primary-bright" />
              <h2 className="pi-add-tag-modal-title" id="add-tag-modal-title">
                Add Tag to Email
              </h2>
            </div>
            <p className="pi-add-tag-modal-subtitle">
              {conversationTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="pi-icon-btn subtle"
            aria-label="Close add tag modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="pi-add-tag-modal-body">
          {/* Tag Name Input */}
          <div className="pi-add-tag-modal-section">
            <label className="pi-add-tag-modal-label">
              Tag Name *
            </label>
            <input
              type="text"
              value={tagName}
              onChange={(e) => setTagName(e.target.value.slice(0, 30))}
              placeholder="Enter a tag name (e.g., Urgent, Follow-up, Resolved)"
              className="pi-add-tag-modal-input"
              maxLength={30}
              autoFocus
              disabled={loading}
            />
            <div className="pi-add-tag-modal-input-count">
              {tagName.length}/30
            </div>
            {existingTags.length > 0 && (
              <div className="mt-4">
                <p className="pi-add-tag-modal-label" style={{ marginBottom: '8px' }}>
                  Existing tags:
                </p>
                <div className="pi-add-tag-modal-tags">
                  {existingTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border"
                      style={{
                        background: 'var(--panel-2)',
                        borderColor: 'var(--border-soft)',
                        color: 'var(--text-dim)',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Example Tags */}
          <div className="pi-add-tag-modal-section">
            <p className="pi-add-tag-modal-label">
              Quick Select Tags
            </p>
            <div className="pi-add-tag-modal-tags">
              {exampleTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTagName(tag)}
                  disabled={loading}
                  className={`pi-add-tag-modal-tag ${tagName === tag ? 'selected' : ''}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pi-add-tag-modal-actions">
          <button
            onClick={onClose}
            disabled={loading}
            className="pi-secondary-btn"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (leadId && tagName.trim()) {
                handleAddTagToConversation(leadId, tagName.trim());
              }
            }}
            disabled={!tagName?.trim() || loading || !leadId}
            className="pi-add-tag-modal-primary-btn"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Adding...
              </>
            ) : (
              "Add Tag"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddTagModal;
