import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FileText,
  Search,
  RefreshCw,
  Eye,
  SearchCheck,
  CheckCircle2,
  XCircle,
  Banknote,
  CreditCard,
  User,
  Building2,
  Calendar,
  IndianRupee,
} from 'lucide-react';
import { loanAPI } from '../api/client';
import {
  PageHeader,
  DataTable,
  StatusBadge,
  LoadingSpinner,
  ErrorState,
  EmptyState,
  ConfirmDialog,
  useToast,
} from '../components';
import './Loans.css';

const Loans = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useToast();

  const queryParams = new URLSearchParams(location.search);
  const initialStatusFilter = queryParams.get('status') || 'ALL';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loans, setLoans] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [amountFilter, setAmountFilter] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Action Modals State
  const [activeActionModal, setActiveActionModal] = useState(null); // 'under-review' | 'approve' | 'reject' | 'disburse'
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Action Form Inputs
  const [actionForm, setActionForm] = useState({
    interestRate: 0,
    tenureMonths: 12,
    disbursedAmount: 0,
    remarks: '',
  });

  const fetchLoans = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: currentPage,
        limit: pageSize,
      };
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }

      const response = await loanAPI.getAllLoans(params);
      if (response.data?.status === 'success') {
        setLoans(response.data.data.loans || []);
        setTotalCount(response.data.totalCount || 0);
        setTotalPages(response.data.totalPages || 1);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load loan applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, [currentPage, pageSize, statusFilter]);

  // Client-side Search & Amount Filtering
  const filteredLoans = useMemo(() => {
    return loans.filter((loan) => {
      const query = searchTerm.toLowerCase().trim();
      const farmerName = loan.farmer?.name || '';
      const farmerEmail = loan.farmer?.email || '';
      const purpose = loan.purpose || '';
      const loanId = loan._id || '';

      const matchesSearch =
        !query ||
        farmerName.toLowerCase().includes(query) ||
        farmerEmail.toLowerCase().includes(query) ||
        purpose.toLowerCase().includes(query) ||
        loanId.toLowerCase().includes(query);

      let matchesAmount = true;
      const amount = loan.loanAmount || 0;
      if (amountFilter === 'LOW') matchesAmount = amount < 50000;
      else if (amountFilter === 'MID') matchesAmount = amount >= 50000 && amount <= 100000;
      else if (amountFilter === 'HIGH') matchesAmount = amount > 100000;

      return matchesSearch && matchesAmount;
    });
  }, [loans, searchTerm, amountFilter]);

  // State Transition Handlers
  const handleOpenActionModal = (loan, actionType) => {
    setSelectedLoan(loan);
    setActiveActionModal(actionType);
    setActionForm({
      interestRate: loan.interestRate || 0,
      tenureMonths: loan.tenureMonths || 12,
      disbursedAmount: loan.loanAmount || 0,
      remarks: '',
    });
  };

  const handleCloseActionModal = () => {
    setActiveActionModal(null);
    setSelectedLoan(null);
    setActionLoading(false);
  };

  const handleExecuteAction = async () => {
    if (!selectedLoan) return;
    setActionLoading(true);

    try {
      if (activeActionModal === 'under-review') {
        await loanAPI.markUnderReview(selectedLoan._id);
        showSuccess(`Loan application #${selectedLoan._id.substring(0, 8)} marked UNDER REVIEW`);
      } else if (activeActionModal === 'approve') {
        await loanAPI.approveLoan(selectedLoan._id, {
          interestRate: Number(actionForm.interestRate),
          tenureMonths: Number(actionForm.tenureMonths),
          remarks: actionForm.remarks,
        });
        showSuccess(`Loan application #${selectedLoan._id.substring(0, 8)} successfully APPROVED`);
      } else if (activeActionModal === 'reject') {
        if (!actionForm.remarks.trim()) {
          showError('Rejection remarks are mandatory.');
          setActionLoading(false);
          return;
        }
        await loanAPI.rejectLoan(selectedLoan._id, {
          remarks: actionForm.remarks.trim(),
        });
        showSuccess(`Loan application #${selectedLoan._id.substring(0, 8)} REJECTED`);
      } else if (activeActionModal === 'disburse') {
        if (!actionForm.disbursedAmount || Number(actionForm.disbursedAmount) <= 0) {
          showError('Disbursed amount must be a positive number.');
          setActionLoading(false);
          return;
        }
        await loanAPI.disburseLoan(selectedLoan._id, {
          disbursedAmount: Number(actionForm.disbursedAmount),
        });
        showSuccess(`Loan #${selectedLoan._id.substring(0, 8)} DISBURSED & Repayment Schedule Generated!`);
      }

      handleCloseActionModal();
      fetchLoans();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update loan status');
      setActionLoading(false);
    }
  };

  // Table Columns Setup
  const columns = [
    {
      header: 'Application ID',
      key: '_id',
      render: (item) => (
        <div className="loan-id-cell">
          <span className="loan-id-code">#{item._id.substring(0, 10)}...</span>
          <span className="loan-frequency-tag">{item.repaymentFrequency || 'MONTHLY'}</span>
        </div>
      ),
    },
    {
      header: 'Farmer Member',
      key: 'farmer',
      render: (item) => (
        <div className="farmer-cell">
          <div className="farmer-avatar-mini">
            <User size={15} />
          </div>
          <div className="farmer-cell-info">
            <span className="farmer-cell-name">{item.farmer?.name || 'Unknown Farmer'}</span>
            <span className="farmer-cell-phone">{item.farmer?.phone || 'No Phone'}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'FPO Organization',
      key: 'fpoName',
      render: (item) => (
        <div className="fpo-cell">
          <Building2 size={13} className="cell-icon" />
          <span>{item.farmer?.fpoName || 'Green Valley FPO'}</span>
        </div>
      ),
    },
    {
      header: 'Requested Amount',
      key: 'loanAmount',
      sortable: true,
      render: (item) => (
        <div className="amount-cell">
          <span className="amount-value">₹{item.loanAmount?.toLocaleString('en-IN')}</span>
          <span className="amount-tenure">{item.tenureMonths} Months ({item.interestRate || 0}% p.a.)</span>
        </div>
      ),
    },
    {
      header: 'Purpose',
      key: 'purpose',
      render: (item) => (
        <span className="purpose-text" title={item.purpose}>
          {item.purpose?.length > 35 ? `${item.purpose.substring(0, 35)}...` : item.purpose}
        </span>
      ),
    },
    {
      header: 'Application Date',
      key: 'createdAt',
      sortable: true,
      render: (item) => (
        <span className="date-cell">
          {new Date(item.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      align: 'center',
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      header: 'Actions',
      key: 'actions',
      align: 'right',
      render: (item) => {
        const status = (item.status || '').toUpperCase();
        return (
          <div className="action-buttons-group">
            {/* View Details */}
            <button
              onClick={() => navigate(`/admin/loans/${item._id}`)}
              className="btn btn-secondary action-btn view-btn"
              title="View Complete Loan Details"
            >
              <Eye size={14} />
              <span>View</span>
            </button>

            {/* Contextual Actions strictly based on Backend State Machine */}
            {status === 'SUBMITTED' && (
              <button
                onClick={() => handleOpenActionModal(item, 'under-review')}
                className="btn action-btn review-btn"
                title="Mark Under Review"
              >
                <SearchCheck size={14} />
                <span>Review</span>
              </button>
            )}

            {status === 'UNDER_REVIEW' && (
              <>
                <button
                  onClick={() => handleOpenActionModal(item, 'approve')}
                  className="btn action-btn approve-btn"
                  title="Approve Loan Application"
                >
                  <CheckCircle2 size={14} />
                  <span>Approve</span>
                </button>
                <button
                  onClick={() => handleOpenActionModal(item, 'reject')}
                  className="btn action-btn reject-btn"
                  title="Reject Loan Application"
                >
                  <XCircle size={14} />
                  <span>Reject</span>
                </button>
              </>
            )}

            {status === 'APPROVED' && (
              <button
                onClick={() => handleOpenActionModal(item, 'disburse')}
                className="btn action-btn disburse-btn"
                title="Disburse Funds & Generate EMI Schedule"
              >
                <Banknote size={14} />
                <span>Disburse</span>
              </button>
            )}

            {status === 'DISBURSED' && (
              <button
                onClick={() => navigate(`/admin/repayments?loan=${item._id}`)}
                className="btn action-btn repayment-btn"
                title="View Repayment Installments"
              >
                <CreditCard size={14} />
                <span>Repayments</span>
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="loans-page-container">
      <PageHeader
        title="Loan Applications Management"
        subtitle="Review agricultural credit requests, conduct evaluation reviews, approve applications, and disburse capital"
        actions={
          <button onClick={fetchLoans} className="btn btn-secondary refresh-btn" disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            <span>Refresh Applications</span>
          </button>
        }
      />

      {/* Filter & Search Header */}
      <div className="loans-filter-bar glass-panel">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by Loan ID, Farmer Name, or Purpose..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="filter-search-input"
          />
        </div>

        <div className="filters-group">
          <div className="filter-item">
            <label htmlFor="loan-status-select" className="filter-label">
              Status:
            </label>
            <select
              id="loan-status-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="filter-select"
            >
              <option value="ALL">All Application Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="DISBURSED">Disbursed</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <div className="filter-item">
            <label htmlFor="amount-select" className="filter-label">
              Amount:
            </label>
            <select
              id="amount-select"
              value={amountFilter}
              onChange={(e) => setAmountFilter(e.target.value)}
              className="filter-select"
            >
              <option value="ALL">All Amounts</option>
              <option value="LOW">&lt; ₹50,000</option>
              <option value="MID">₹50,000 - ₹1,00,000</option>
              <option value="HIGH">&gt; ₹1,00,000</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table & Content Section */}
      {loading ? (
        <div className="loans-loading-container glass-panel">
          <LoadingSpinner message="Fetching loan applications from backend database..." />
        </div>
      ) : error ? (
        <ErrorState title="Failed to Load Loan Applications" message={error} onRetry={fetchLoans} />
      ) : filteredLoans.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Loan Applications Found"
          description={
            searchTerm || statusFilter !== 'ALL' || amountFilter !== 'ALL'
              ? 'No loan applications matched your search or filter options.'
              : 'There are currently no loan applications submitted in the system.'
          }
          action={
            (searchTerm || statusFilter !== 'ALL' || amountFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('ALL');
                  setAmountFilter('ALL');
                }}
                className="btn btn-secondary"
              >
                Clear Filters
              </button>
            )
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredLoans}
          pagination={{
            currentPage,
            totalPages,
            totalItems: totalCount,
            pageSize,
            onPageChange: setCurrentPage,
            onPageSizeChange: (newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            },
          }}
          onRowClick={(item) => navigate(`/admin/loans/${item._id}`)}
        />
      )}

      {/* MODAL 1: Mark Under Review */}
      <ConfirmDialog
        isOpen={activeActionModal === 'under-review'}
        type="info"
        title="Move Application to UNDER REVIEW?"
        message={`Transition loan application #${selectedLoan?._id?.substring(0, 8)} into UNDER REVIEW status for administrative evaluation?`}
        confirmText="Confirm Under Review"
        onConfirm={handleExecuteAction}
        onCancel={handleCloseActionModal}
        loading={actionLoading}
      />

      {/* MODAL 2: Approve Loan Modal Form */}
      {activeActionModal === 'approve' && (
        <div className="modal-backdrop" onClick={handleCloseActionModal}>
          <div className="modal-card action-modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="title-group">
                <CheckCircle2 size={24} className="text-emerald" />
                <h3>Approve Loan Application</h3>
              </div>
              <button className="modal-close-btn" onClick={handleCloseActionModal}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-intro">
                Approve loan request for <strong>{selectedLoan?.farmer?.name}</strong> (Requested Amount: ₹
                {selectedLoan?.loanAmount?.toLocaleString('en-IN')})
              </p>

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="approve-interest" className="form-label">
                    Interest Rate (% p.a.)
                  </label>
                  <input
                    id="approve-interest"
                    type="number"
                    min="0"
                    step="0.5"
                    className="form-input"
                    value={actionForm.interestRate}
                    onChange={(e) => setActionForm({ ...actionForm, interestRate: e.target.value })}
                  />
                  <span className="input-hint">0% for subsidized loans</span>
                </div>

                <div className="form-group">
                  <label htmlFor="approve-tenure" className="form-label">
                    Tenure Duration (Months)
                  </label>
                  <input
                    id="approve-tenure"
                    type="number"
                    min="1"
                    className="form-input"
                    value={actionForm.tenureMonths}
                    onChange={(e) => setActionForm({ ...actionForm, tenureMonths: e.target.value })}
                  />
                </div>

                <div className="form-group col-span-2">
                  <label htmlFor="approve-remarks" className="form-label">
                    Approval Remarks
                  </label>
                  <textarea
                    id="approve-remarks"
                    className="form-textarea"
                    rows="3"
                    placeholder="Enter approval details or collateral conditions..."
                    value={actionForm.remarks}
                    onChange={(e) => setActionForm({ ...actionForm, remarks: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleCloseActionModal} disabled={actionLoading}>
                Cancel
              </button>
              <button className="btn approve-btn" onClick={handleExecuteAction} disabled={actionLoading}>
                {actionLoading ? 'Approving...' : 'Confirm Loan Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Reject Loan Modal Form */}
      {activeActionModal === 'reject' && (
        <div className="modal-backdrop" onClick={handleCloseActionModal}>
          <div className="modal-card action-modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="title-group">
                <XCircle size={24} className="text-rose" />
                <h3>Reject Loan Application</h3>
              </div>
              <button className="modal-close-btn" onClick={handleCloseActionModal}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-intro">
                Reject loan request for <strong>{selectedLoan?.farmer?.name}</strong>. Rejection remarks are mandatory.
              </p>

              <div className="form-group col-span-2">
                <label htmlFor="reject-remarks" className="form-label">
                  Rejection Remarks <span className="required-star">*</span>
                </label>
                <textarea
                  id="reject-remarks"
                  className="form-textarea"
                  rows="4"
                  placeholder="State the explicit reasons for application rejection (e.g. Invalid land 7/12 record)..."
                  value={actionForm.remarks}
                  onChange={(e) => setActionForm({ ...actionForm, remarks: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleCloseActionModal} disabled={actionLoading}>
                Cancel
              </button>
              <button className="btn reject-btn" onClick={handleExecuteAction} disabled={actionLoading}>
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Disburse Loan Modal Form */}
      {activeActionModal === 'disburse' && (
        <div className="modal-backdrop" onClick={handleCloseActionModal}>
          <div className="modal-card action-modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="title-group">
                <Banknote size={24} className="text-indigo" />
                <h3>Disburse Loan Funds</h3>
              </div>
              <button className="modal-close-btn" onClick={handleCloseActionModal}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-intro">
                Disburse credit funds to <strong>{selectedLoan?.farmer?.name}</strong>. Disbursing automatically generates the monthly repayment installment schedule.
              </p>

              <div className="form-group">
                <label htmlFor="disburse-amount" className="form-label">
                  Disbursed Amount (₹)
                </label>
                <input
                  id="disburse-amount"
                  type="number"
                  min="1"
                  className="form-input"
                  value={actionForm.disbursedAmount}
                  onChange={(e) => setActionForm({ ...actionForm, disbursedAmount: e.target.value })}
                />
                <span className="input-hint">Approved Loan Amount: ₹{selectedLoan?.loanAmount?.toLocaleString('en-IN')}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleCloseActionModal} disabled={actionLoading}>
                Cancel
              </button>
              <button className="btn disburse-btn" onClick={handleExecuteAction} disabled={actionLoading}>
                {actionLoading ? 'Disbursing...' : 'Disburse & Generate Repayments'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Loans;
