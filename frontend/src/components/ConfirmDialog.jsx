import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle, HelpCircle, X } from 'lucide-react';
import './ConfirmDialog.css';

const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info', // 'info' | 'danger' | 'warning' | 'success'
  onConfirm,
  onCancel,
  loading = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onCancel();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, loading, onCancel]);

  if (!isOpen) return null;

  const iconMap = {
    info: <HelpCircle size={28} className="dialog-icon icon-info" />,
    danger: <AlertCircle size={28} className="dialog-icon icon-danger" />,
    warning: <AlertCircle size={28} className="dialog-icon icon-warning" />,
    success: <CheckCircle size={28} className="dialog-icon icon-success" />,
  };

  return (
    <div className="confirm-dialog-overlay" onClick={!loading ? onCancel : undefined}>
      <div
        className={`confirm-dialog-card glass-panel type-${type}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          className="dialog-close-btn"
          onClick={onCancel}
          disabled={loading}
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        <div className="dialog-header">
          <div className="dialog-icon-container">{iconMap[type] || iconMap.info}</div>
          <h3 className="dialog-title">{title}</h3>
        </div>

        <div className="dialog-body">
          {typeof message === 'string' ? <p>{message}</p> : message}
        </div>

        <div className="dialog-footer">
          <button
            type="button"
            className="btn btn-secondary dialog-cancel-btn"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn dialog-confirm-btn btn-type-${type}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
