import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import './Toast.css';

const ToastContainer = ({ toasts = [], onClose }) => {
  if (!toasts.length) return null;

  const iconMap = {
    success: <CheckCircle2 size={18} className="toast-icon toast-success" />,
    error: <AlertCircle size={18} className="toast-icon toast-error" />,
    warning: <AlertTriangle size={18} className="toast-icon toast-warning" />,
    info: <Info size={18} className="toast-icon toast-info" />,
  };

  return (
    <div className="toast-container-root">
      {toasts.map((t) => (
        <div key={t.id} className={`toast-item toast-item-${t.type} glass-panel`}>
          <div className="toast-content-wrapper">
            {iconMap[t.type] || iconMap.info}
            <span className="toast-message">{t.message}</span>
          </div>
          <button
            onClick={() => onClose(t.id)}
            className="toast-close-btn"
            aria-label="Close notification"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
