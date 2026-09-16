import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import './Breadcrumbs.css';

const PATH_NAME_MAP = {
  admin: 'Admin Portal',
  dashboard: 'Dashboard',
  farmers: 'Farmer Registry',
  loans: 'Loan Applications',
  repayments: 'Repayments & EMI',
  reports: 'Financial Reports',
  notifications: 'Notifications & Alerts',
};

const Breadcrumbs = ({ items }) => {
  const location = useLocation();

  // If custom items passed, use them, otherwise generate from path
  const breadcrumbItems = React.useMemo(() => {
    if (items && items.length > 0) return items;

    const pathSegments = location.pathname.split('/').filter(Boolean);
    const generated = [];

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const label = PATH_NAME_MAP[segment] || (segment.length > 15 ? `${segment.substring(0, 12)}...` : segment);
      generated.push({
        label,
        path: currentPath,
        isLast: index === pathSegments.length - 1,
      });
    });

    return generated;
  }, [items, location.pathname]);

  if (breadcrumbItems.length <= 1) return null;

  return (
    <nav className="breadcrumbs-container" aria-label="Breadcrumb">
      <ol className="breadcrumbs-list">
        <li className="breadcrumb-item">
          <Link to="/admin/dashboard" className="breadcrumb-link home-link" aria-label="Home">
            <Home size={14} />
          </Link>
        </li>

        {breadcrumbItems.map((item, index) => (
          <li key={item.path || index} className="breadcrumb-item">
            <ChevronRight size={13} className="breadcrumb-separator" />
            {item.isLast ? (
              <span className="breadcrumb-current" aria-current="page">
                {item.label}
              </span>
            ) : (
              <Link to={item.path} className="breadcrumb-link">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
