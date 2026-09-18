/**
 * Format numeric amount into INR currency (₹)
 */
export const formatCurrency = (amount) => {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Format ISO date string into readable date format (e.g., "15 Sep 2026")
 */
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

/**
 * Get CSS badge class for loan/document/repayment status
 */
export const getStatusBadgeClass = (status) => {
  if (!status) return 'badge-pending';
  const lower = status.toLowerCase();
  return `badge badge-${lower}`;
};
