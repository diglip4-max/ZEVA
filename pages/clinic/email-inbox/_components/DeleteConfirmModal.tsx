import React from "react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  loading,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = () => {
    if (!loading) {
      onClose();
    }
  };

  const handleConfirm = async () => {
    if (!loading) {
      await onConfirm();
    }
  };

  return (
    <div className="pi-delete-modal-backdrop" onClick={handleBackdropClick}>
      <div
        className="pi-delete-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
      >
        <div className="pi-delete-modal-header">
          <div className="pi-delete-modal-title" id="delete-confirm-title">
            Delete email permanently?
          </div>
          <button
            type="button"
            className="pi-icon-btn subtle"
            onClick={onClose}
            aria-label="Close delete confirmation"
            disabled={loading}
          >
            ×
          </button>
        </div>

        <div className="pi-delete-modal-body">
          <p>
            This action cannot be undone. The message will be removed from your
            inbox permanently.
          </p>
        </div>

        <div className="pi-delete-modal-actions">
          <button
            type="button"
            className="pi-secondary-btn"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="pi-danger-btn"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
