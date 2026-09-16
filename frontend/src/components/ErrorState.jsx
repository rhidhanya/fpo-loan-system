import React from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import './ErrorState.css';

const ErrorState = ({ title = 'Something went wrong', message, onRetry, className = '' }) => {
  return (
    <div className={`error-state-card glass-panel ${className}`}>
      <div className="error-state-icon">
        <AlertOctagon size={32} />
      </div>
      <div className="error-state-body">
        <h3 className="error-state-title">{title}</h3>
        {message && <p className="error-state-message">{message}</p>}
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-secondary error-retry-btn">
          <RotateCcw size={16} />
          <span>Try Again</span>
        </button>
      )}
    </div>
  );
};

export default ErrorState;
