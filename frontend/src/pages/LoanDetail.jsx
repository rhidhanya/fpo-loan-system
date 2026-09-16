import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  XCircle,
  Banknote,
  SearchCheck,
  CreditCard,
  ShieldCheck,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { loanAPI, documentAPI, repaymentAPI } from '../api/client';
import {
  PageHeader,
  StatusBadge,
  LoadingSpinner,
  ErrorState,
  ConfirmDialog,
  DocumentReview,
  useToast,
} from '../components';
import './LoanDetail.css';

const LoanDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loan, setLoan] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [repayments, setRepayments] = useState([]);

  // Action Modals State
  const [activeActionModal, setActiveActionModal] = useState(null); // 'under-review' | 'approve' | 'reject' | 'disburse'
  const [actionLoading, setActionLoading] = useState(false);
  const [actionForm, setActionForm] = useState({
    interestRate: 0,
    tenureMonths: 12,
    disbursedAmount: 0,
    remarks: '',
  });

  const fetchLoanData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Loan Details
      const loanRes = await loanAPI.getLoanById(id);
      if (!loanRes.data?.data?.loan) {
        throw new Error('Loan application document not returned by server');
      }
      const fetchedLoan = loanRes.data.data.loan;
      setLoan(fetchedLoan);
      setActionForm({
        interestRate: fetchedLoan.interestRate || 0,
        tenureMonths: fetchedLoan.tenureMonths || 12,
        disbursedAmount: fetchedLoan.loanAmount || 0,
        remarks: '',
      });

      // 2. Fetch Supporting Documents
      try {
        const docsRes = await documentAPI.getLoanDocuments(id);
        if (docsRes.data?.data?.documents) {
          setDocuments(docsRes.data.data.documents);
        }
      } catch (docErr) {
        console.warn('Documents fetch warning:', docErr.message);
      }

      // 3. Fetch Repayment Schedule if loan is DISBURSED or CLOSED
      const currentStatus = (fetchedLoan.status || '').toUpperCase();
      if (['DISBURSED', 'CLOSED'].includes(currentStatus)) {
        try {
          const repayRes = await repaymentAPI.getLoanRepayments(id);
          if (repayRes.data?.data?.repayments) {
            setRepayments(repayRes.data.data.repayments);
          }
        } catch (repayErr) {
          console.warn('Repayments fetch warning:', repayErr.message);
        }
      }
    } catch (err) {
      const statusCode = err.response?.status;
      let msg = err.response?.data?.message || err.message || 'Failed to load loan application';

      if (statusCode === 404) msg = 'Loan Application ID not found in database (HTTP 404)';
      else if (statusCode === 403) msg = 'Forbidden: You do not have permission to view this loan (HTTP 403)';
      else if (statusCode === 400) msg = 'Invalid Loan ID format (HTTP 400)';
      else if (statusCode === 500) msg = 'Backend database error loading loan file (HTTP 500)';

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoanData();
  }, [id]);

  // Execute State Transition Mutations
  const handleExecuteAction = async () => {
    if (!loan || actionLoading) return;
    setActionLoading(true);

    try {
      if (activeActionModal === 'under-review') {
        const res = await loanAPI.markUnderReview(loan._id);
        showSuccess(res.data?.message || 'Loan status updated to UNDER REVIEW');
      } else if (activeActionModal === 'approve') {
        const res = await loanAPI.approveLoan(loan._id, {
          interestRate: Number(actionForm.interestRate),
          tenureMonths: Number(actionForm.tenureMonths),
          remarks: actionForm.remarks,
        });
        showSuccess(res.data?.message || 'Loan application successfully APPROVED');
      } else if (activeActionModal === 'reject') {
        if (!actionForm.remarks.trim()) {
          showError('Rejection remarks are mandatory.');
          setActionLoading(false);
          return;
        }
        const res = await loanAPI.rejectLoan(loan._id, {
          remarks: actionForm.remarks.trim(),
        });
        showSuccess(res.data?.message || 'Loan application REJECTED');
      } else if (activeActionModal === 'disburse') {
        if (!actionForm.disbursedAmount || Number(actionForm.disbursedAmount) <= 0) {
          showError('Disbursed amount must be a positive number.');
          setActionLoading(false);
          return;
        }
        const res = await loanAPI.disburseLoan(loan._id, {
          disbursedAmount: Number(actionForm.disbursedAmount),
        });
        showSuccess(res.data?.message || 'Loan DISBURSED and Repayment Schedule generated!');
      }

      setActiveActionModal(null);
      // Refetch complete loan state from backend to maintain single source of truth
      await fetchLoanData();
    } catch (err) {
      const statusCode = err.response?.status;
      let errMsg = err.response?.data?.message || 'Failed to process loan action';

      if (statusCode === 400) {
        errMsg = `Invalid State Transition (400): ${errMsg}`;
      } else if (statusCode === 403) {
        errMsg = `Forbidden (403): Admin authorization required.`;
      } else if (statusCode === 409) {
        errMsg = `Conflict (409): State conflict detected. Please refresh.`;
      } else if (statusCode === 500) {
        errMsg = `Server Error (500): ${errMsg}`;
      }

      showError(errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loan-detail-loading glass-panel">
        <LoadingSpinner message="Fetching loan application file & verification documents..." />
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="loan-detail-error-container">
        <ErrorState title="Loan Application Unavailable" message={error} onRetry={fetchLoanData} />
        <button onClick={() => navigate('/admin/loans')} className="btn btn-secondary mt-4">
          <ArrowLeft size={16} /> Return to Loans Queue
        </button>
      </div>
    );
  }

  const farmer = loan.farmer || {};
  const status = (loan.status || '').toUpperCase();

  return (
    <div className="loan-detail-container">
      <PageHeader
        title={`Loan Application #${loan._id.substring(0, 10)}`}
        subtitle={`Submitted by ${farmer.name || 'Farmer'} on ${new Date(loan.createdAt).toLocaleDateString('en-IN')}`}
        breadcrumbsItems={[
          { label: 'Admin Portal', path: '/admin' },
          { label: 'Loan Applications', path: '/admin/loans' },
          { label: `Loan #${loan._id.substring(0, 8)}`, path: `/admin/loans/${loan._id}`, isLast: true },
        ]}
        actions={
          <div className="detail-header-actions">
            <button onClick={() => navigate('/admin/loans')} className="btn btn-secondary">
              <ArrowLeft size={16} />
              <span>Back to Queue</span>
            </button>
            <button onClick={fetchLoanData} className="btn btn-secondary" title="Refresh Application Data">
              <RefreshCw size={16} />
            </button>
          </div>
        }
      />

      {/* Top Banner Status & Workflow Action Bar */}
      <div className="status-banner-card glass-panel">
        <div className="banner-left">
          <span className="banner-label">Lifecycle Status:</span>
          <StatusBadge status={loan.status} size="large" />
        </div>

        {/* State Machine Transition Controls */}
        <div className="banner-actions">
          {status === 'SUBMITTED' && (
            <button
              onClick={() => setActiveActionModal('under-review')}
              className="btn review-btn"
              disabled={actionLoading}
            >
              <SearchCheck size={16} />
              <span>Move to Under Review</span>
            </button>
          )}

          {status === 'UNDER_REVIEW' && (
            <>
              <button
                onClick={() => setActiveActionModal('approve')}
                className="btn approve-btn"
                disabled={actionLoading}
              >
                <CheckCircle2 size={16} />
                <span>Approve Loan</span>
              </button>
              <button
                onClick={() => setActiveActionModal('reject')}
                className="btn reject-btn"
                disabled={actionLoading}
              >
                <XCircle size={16} />
                <span>Reject Loan</span>
              </button>
            </>
          )}

          {status === 'APPROVED' && (
            <button
              onClick={() => setActiveActionModal('disburse')}
              className="btn disburse-btn"
              disabled={actionLoading}
            >
              <Banknote size={16} />
              <span>Disburse Funds & Generate EMI</span>
            </button>
          )}

          {status === 'DISBURSED' && (
            <button onClick={() => navigate(`/admin/repayments?loan=${loan._id}`)} className="btn repayment-btn">
              <CreditCard size={16} />
              <span>View Repayments Module</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Details & Borrower Profile */}
      <div className="loan-detail-grid">
        {/* Left Column: Financial Specifications */}
        <div className="detail-card glass-panel">
          <h3 className="card-section-title">
            <FileText size={18} className="text-emerald" />
            <span>Financial & Application Specifications</span>
          </h3>

          <div className="specs-grid">
            <div className="spec-item">
              <span className="spec-label">Requested Amount</span>
              <span className="spec-value highlight-currency">
                ₹{loan.loanAmount?.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="spec-item">
              <span className="spec-label">Loan Purpose</span>
              <span className="spec-value">{loan.purpose}</span>
            </div>

            <div className="spec-item">
              <span className="spec-label">Tenure Duration</span>
              <span className="spec-value">{loan.tenureMonths} Months</span>
            </div>

            <div className="spec-item">
              <span className="spec-label">Annual Interest Rate</span>
              <span className="spec-value">{loan.interestRate || 0}% p.a.</span>
            </div>

            <div className="spec-item">
              <span className="spec-label">Repayment Frequency</span>
              <span className="spec-value">{loan.repaymentFrequency || 'MONTHLY'}</span>
            </div>

            {loan.disbursedAmount > 0 && (
              <div className="spec-item">
                <span className="spec-label">Disbursed Amount</span>
                <span className="spec-value text-indigo">
                  ₹{loan.disbursedAmount?.toLocaleString('en-IN')}
                </span>
              </div>
            )}

            {loan.disbursedDate && (
              <div className="spec-item">
                <span className="spec-label">Disbursement Date</span>
                <span className="spec-value">
                  {new Date(loan.disbursedDate).toLocaleDateString('en-IN')}
                </span>
              </div>
            )}
          </div>

          {loan.remarks && (
            <div className="remarks-box">
              <strong>Administrative Audit Remarks:</strong>
              <p>{loan.remarks}</p>
            </div>
          )}
        </div>

        {/* Right Column: Farmer Borrower Information */}
        <div className="detail-card glass-panel">
          <h3 className="card-section-title">
            <User size={18} className="text-emerald" />
            <span>Farmer Member Profile</span>
          </h3>

          <div className="borrower-profile">
            <div className="borrower-name-header">
              <div className="borrower-avatar">
                <User size={24} />
              </div>
              <div>
                <h4 className="borrower-name">{farmer.name || 'Farmer Member'}</h4>
                <span className="borrower-role">FARMER MEMBER</span>
              </div>
            </div>

            <div className="borrower-fields">
              <div className="info-row">
                <Mail size={15} className="info-icon" />
                <span>{farmer.email || 'N/A'}</span>
              </div>
              <div className="info-row">
                <Phone size={15} className="info-icon" />
                <span>{farmer.phone || 'N/A'}</span>
              </div>
              <div className="info-row">
                <Building2 size={15} className="info-icon" />
                <span>{farmer.fpoName || 'Green Valley FPO'}</span>
              </div>
              <div className="info-row">
                <MapPin size={15} className="info-icon" />
                <span>
                  {[farmer.address?.village, farmer.address?.district, farmer.address?.state].filter(Boolean).join(', ') ||
                    'Location not specified'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Generated Repayment Schedule Table (For DISBURSED or CLOSED loans) */}
      {['DISBURSED', 'CLOSED'].includes(status) && (
        <div className="repayments-schedule-card glass-panel">
          <h3 className="card-section-title">
            <CreditCard size={18} className="text-indigo" />
            <span>Generated Repayment Schedule ({repayments.length} Installments)</span>
          </h3>

          {repayments.length === 0 ? (
            <p className="no-docs-text">Repayment schedule loading or empty...</p>
          ) : (
            <div className="repayments-table-wrapper">
              <table className="repayments-table">
                <thead>
                  <tr>
                    <th>Installment #</th>
                    <th>Due Date</th>
                    <th>Amount Due</th>
                    <th>Amount Paid</th>
                    <th>Status</th>
                    <th>Payment Method</th>
                    <th>Paid Date</th>
                  </tr>
                </thead>
                <tbody>
                  {repayments.map((r) => (
                    <tr key={r._id}>
                      <td className="font-semibold">Installment #{r.installmentNumber}</td>
                      <td>{new Date(r.dueDate).toLocaleDateString('en-IN')}</td>
                      <td className="font-semibold text-emerald">₹{r.amountDue?.toLocaleString('en-IN')}</td>
                      <td>₹{r.amountPaid?.toLocaleString('en-IN')}</td>
                      <td>
                        <StatusBadge status={r.paymentStatus} size="small" />
                      </td>
                      <td>{r.paymentMethod || '—'}</td>
                      <td>{r.paidDate ? new Date(r.paidDate).toLocaleDateString('en-IN') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Dedicated Admin Document Review Module */}
      <DocumentReview documents={documents} onRefresh={fetchLoanData} />

      {/* Modal Action Controls */}

      {/* MODAL 1: Mark Under Review */}
      <ConfirmDialog
        isOpen={activeActionModal === 'under-review'}
        type="info"
        title="Move Application to UNDER REVIEW?"
        message="Transition this loan application into UNDER REVIEW status for administrative evaluation?"
        confirmText="Confirm Under Review"
        onConfirm={handleExecuteAction}
        onCancel={() => setActiveActionModal(null)}
        loading={actionLoading}
      />

      {/* MODAL 2: Approve Loan */}
      {activeActionModal === 'approve' && (
        <div className="modal-backdrop" onClick={() => !actionLoading && setActiveActionModal(null)}>
          <div className="modal-card action-modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="title-group">
                <CheckCircle2 size={24} className="text-emerald" />
                <h3>Approve Loan Application</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setActiveActionModal(null)} disabled={actionLoading}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Interest Rate (% p.a.)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="form-input"
                  value={actionForm.interestRate}
                  onChange={(e) => setActionForm({ ...actionForm, interestRate: e.target.value })}
                  disabled={actionLoading}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tenure Duration (Months)</label>
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  value={actionForm.tenureMonths}
                  onChange={(e) => setActionForm({ ...actionForm, tenureMonths: e.target.value })}
                  disabled={actionLoading}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Approval Remarks</label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  value={actionForm.remarks}
                  onChange={(e) => setActionForm({ ...actionForm, remarks: e.target.value })}
                  disabled={actionLoading}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setActiveActionModal(null)} disabled={actionLoading}>
                Cancel
              </button>
              <button className="btn approve-btn" onClick={handleExecuteAction} disabled={actionLoading}>
                {actionLoading ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Reject Loan */}
      {activeActionModal === 'reject' && (
        <div className="modal-backdrop" onClick={() => !actionLoading && setActiveActionModal(null)}>
          <div className="modal-card action-modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="title-group">
                <XCircle size={24} className="text-rose" />
                <h3>Reject Loan Application</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setActiveActionModal(null)} disabled={actionLoading}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Rejection Remarks *</label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  value={actionForm.remarks}
                  onChange={(e) => setActionForm({ ...actionForm, remarks: e.target.value })}
                  disabled={actionLoading}
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setActiveActionModal(null)} disabled={actionLoading}>
                Cancel
              </button>
              <button className="btn reject-btn" onClick={handleExecuteAction} disabled={actionLoading}>
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Disburse Loan */}
      {activeActionModal === 'disburse' && (
        <div className="modal-backdrop" onClick={() => !actionLoading && setActiveActionModal(null)}>
          <div className="modal-card action-modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="title-group">
                <Banknote size={24} className="text-indigo" />
                <h3>Disburse Loan Funds</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setActiveActionModal(null)} disabled={actionLoading}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Disbursed Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  value={actionForm.disbursedAmount}
                  onChange={(e) => setActionForm({ ...actionForm, disbursedAmount: e.target.value })}
                  disabled={actionLoading}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setActiveActionModal(null)} disabled={actionLoading}>
                Cancel
              </button>
              <button className="btn disburse-btn" onClick={handleExecuteAction} disabled={actionLoading}>
                {actionLoading ? 'Disbursing...' : 'Disburse Funds'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoanDetail;
