import React from 'react';
import { getStatusBadgeClass } from '../utils/formatters';

const Badge = ({ status, label }) => {
  const badgeClass = getStatusBadgeClass(status);
  return <span className={badgeClass}>{label || status}</span>;
};

export default Badge;
