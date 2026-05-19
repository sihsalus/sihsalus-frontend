import { Category, Dashboard, HospitalBed, Tag } from "@carbon/react/icons";
import { ConfigurableLink } from "@openmrs/esm-framework";
import last from "lodash-es/last";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BrowserRouter, useLocation } from "react-router-dom";

type SideNavIcon = React.ComponentType<{
  className?: string;
  size?: number | string;
}>;

export interface LinkConfig {
  name: string;
  title: string;
  icon: SideNavIcon;
}

function getOpenmrsSpaBase(): string {
  const value = (
    globalThis as { getOpenmrsSpaBase?: () => unknown }
  ).getOpenmrsSpaBase?.();
  return typeof value === "string" ? value : "";
}

function LinkExtension({ config }: { config: LinkConfig }) {
  const { t } = useTranslation();
  const { name, title } = config;
  const location = useLocation();

  let urlSegment = useMemo(() => {
    const segment = last(location.pathname.split("/"));
    return decodeURIComponent(segment ?? "");
  }, [location.pathname]);

  const isUUID = (value: string) => {
    const regex =
      /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/;
    return regex.test(value);
  };

  if (isUUID(urlSegment)) {
    urlSegment = "bed-management";
  }

  const Icon = config.icon;

  return (
    <ConfigurableLink
      to={`${getOpenmrsSpaBase()}bed-management${name && name !== "bed-management" ? `/${name}` : ""}`}
      className={`cds--side-nav__link ${name === urlSegment && "active-left-nav-link"}`}
    >
      <span className="sihsalus-side-nav__item">
        <Icon
          aria-hidden="true"
          className="sihsalus-side-nav__icon"
          size={20}
        />
        <span className="sihsalus-side-nav__text">{t(title, title)}</span>
      </span>
    </ConfigurableLink>
  );
}

export const createLeftPanelLink = (config: LinkConfig) => () => (
  <BrowserRouter>
    <LinkExtension config={config} />
  </BrowserRouter>
);

export const bedManagementSidebarIcons = {
  summary: Dashboard,
  wardAllocation: HospitalBed,
  bedTypes: Category,
  bedTags: Tag,
} as const;
