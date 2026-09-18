import React from 'react';
import { Loader2 } from 'lucide-react';

const Loading = ({ message = 'Loading...' }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '12px', color: 'var(--text-muted)' }}>
      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      <span>{message}</span>
    </div>
  );
};

export default Loading;
