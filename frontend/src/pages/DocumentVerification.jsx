import React, { useState, useEffect, useMemo } from 'react';
import {
  FileCheck,
  Search,
  RefreshCw,
  Clock,
  ShieldCheck,
  XCircle,
  FileText,
} from 'lucide-react';
import { documentAPI } from '../api/client';
import {
  PageHeader,
  StatusBadge,
  LoadingSpinner,
  ErrorState,
  EmptyState,
  DocumentReview,
  useToast,
} from '../components';
import './DocumentVerification.css';

const DocumentVerification = () => {
  const { showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [documents, setDocuments] = useState([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const response = await documentAPI.getAllDocuments(params);
      if (response.data?.status === 'success') {
        setDocuments(response.data.data?.documents || []);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load documents';
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [statusFilter]);

  // Client-side search
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return documents;
    const q = searchTerm.toLowerCase();
    return documents.filter(
      (d) =>
        d.user?.name?.toLowerCase().includes(q) ||
        d.user?.email?.toLowerCase().includes(q) ||
        d.documentName?.toLowerCase().includes(q) ||
        d.documentType?.toLowerCase().includes(q)
    );
  }, [documents, searchTerm]);

  // Summary counts (from all documents regardless of current filter)
  const [allDocs, setAllDocs] = useState([]);
  useEffect(() => {
    documentAPI
      .getAllDocuments({})
      .then((r) => setAllDocs(r.data?.data?.documents || []))
      .catch(() => {});
  }, [documents]); // refresh summary whenever main data changes

  const summary = useMemo(() => ({
    total: allDocs.length,
    pending: allDocs.filter((d) => d.status === 'PENDING').length,
    verified: allDocs.filter((d) => d.status === 'VERIFIED').length,
    rejected: allDocs.filter((d) => d.status === 'REJECTED').length,
  }), [allDocs]);

  const STATUS_TABS = [
    { key: 'ALL',      label: 'All Documents', icon: FileText,   count: summary.total },
    { key: 'PENDING',  label: 'Pending',        icon: Clock,      count: summary.pending },
    { key: 'VERIFIED', label: 'Verified',       icon: ShieldCheck,count: summary.verified },
    { key: 'REJECTED', label: 'Rejected',       icon: XCircle,    count: summary.rejected },
  ];

  return (
    <div className="docver-page-container">
      <PageHeader
        title="Document Verification"
        subtitle="Review and verify farmer documents for loan applications"
        icon={<FileCheck size={22} />}
      />

      {/* Summary Cards */}
      <div className="metrics-overview-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Documents</span>
            <div className="metric-icon-box blue"><FileText size={18} /></div>
          </div>
          <div className="metric-main-value">{summary.total}</div>
          <div className="metric-footer-text">All uploaded documents</div>
        </div>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Pending Review</span>
            <div className="metric-icon-box amber"><Clock size={18} /></div>
          </div>
          <div className="metric-main-value">{summary.pending}</div>
          <div className="metric-footer-text">Awaiting admin action</div>
        </div>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Verified</span>
            <div className="metric-icon-box emerald"><ShieldCheck size={18} /></div>
          </div>
          <div className="metric-main-value">{summary.verified}</div>
          <div className="metric-footer-text">Approved documents</div>
        </div>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Rejected</span>
            <div className="metric-icon-box rose"><XCircle size={18} /></div>
          </div>
          <div className="metric-main-value">{summary.rejected}</div>
          <div className="metric-footer-text">Documents rejected</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="docver-filter-bar">
        {/* Status Tabs */}
        <div className="docver-tabs">
          {STATUS_TABS.map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              className={`docver-tab-btn ${statusFilter === key ? 'active' : ''}`}
              onClick={() => setStatusFilter(key)}
            >
              <Icon size={15} />
              <span>{label}</span>
              <span className="tab-count">{count}</span>
            </button>
          ))}
        </div>

        {/* Search + Refresh */}
        <div className="docver-filter-right">
          <div className="search-input-wrapper">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search farmer, document..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            className="btn btn-secondary refresh-btn"
            onClick={fetchDocuments}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="docver-loader-wrap">
          <LoadingSpinner message="Loading documents..." />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchDocuments} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileCheck size={40} />}
          title={statusFilter === 'ALL' ? 'No documents uploaded yet' : `No ${statusFilter.toLowerCase()} documents`}
          message="Documents uploaded by farmers will appear here."
        />
      ) : (
        <div className="glass-panel docver-content-panel">
          <div className="docver-results-header">
            <span className="docver-results-count">
              Showing {filtered.length} document{filtered.length !== 1 ? 's' : ''}
            </span>
            {statusFilter !== 'ALL' && (
              <StatusBadge status={statusFilter} size="small" />
            )}
          </div>
          <DocumentReview
            documents={filtered}
            onRefresh={fetchDocuments}
          />
        </div>
      )}
    </div>
  );
};

export default DocumentVerification;
