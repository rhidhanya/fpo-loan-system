import React from 'react';
import { FolderOpen } from 'lucide-react';
import './EmptyState.css';

const EmptyState = ({
  icon: Icon = FolderOpen,
  title = 'No records found',
  description = 'There are no items matching your request or filter criteria.',
  action,
  className = '',
}) => {
  return (
    <div className={`empty-state-card glass-panel ${className}`}>
      <div className="empty-state-icon-wrapper">
        <Icon size={36} className="empty-state-icon" />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-description">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
};

export default EmptyState;
