import React from 'react';
import { Loader2 } from 'lucide-react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ size = 'medium', message, fullPage = false, className = '' }) => {
  const spinnerSize = size === 'small' ? 18 : size === 'large' ? 36 : 24;

  const content = (
    <div className={`spinner-wrapper size-${size} ${className}`}>
      <Loader2 size={spinnerSize} className="spinner-icon-animated" />
      {message && <p className="spinner-message">{message}</p>}
    </div>
  );

  if (fullPage) {
    return <div className="spinner-fullpage-backdrop">{content}</div>;
  }

  return content;
};

export default LoadingSpinner;
