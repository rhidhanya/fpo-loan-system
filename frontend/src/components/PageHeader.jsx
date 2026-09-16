import React from 'react';
import Breadcrumbs from './Breadcrumbs';
import './PageHeader.css';

const PageHeader = ({ title, subtitle, actions, breadcrumbsItems }) => {
  return (
    <div className="page-header-container">
      <Breadcrumbs items={breadcrumbsItems} />
      <div className="page-header-content">
        <div className="page-header-titles">
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
    </div>
  );
};

export default PageHeader;
