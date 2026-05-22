import { ConfigurableLink } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface OfflineToolsNavLinkProps {
  page?: string;
  title: string;
}

void React;

export default function OfflineToolsNavLink({ page, title }: OfflineToolsNavLinkProps) {
  const { t } = useTranslation();
  const openmrsSpaBasePlaceholder = ['${', 'openmrsSpaBase', '}'].join('');

  return (
    <div key={page}>
      <ConfigurableLink
        to={`${openmrsSpaBasePlaceholder}/offline-tools${page ? `/${page}` : ''}`}
        className="cds--side-nav__link"
      >
        {t(title, title)}
      </ConfigurableLink>
    </div>
  );
}
