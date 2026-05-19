import { useLeftNav } from "@openmrs/esm-framework";
import { AppErrorBoundary } from "@sihsalus/esm-rbac";
import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import BedAdministrationTable from "./bed-administration/bed-administration-table.component";
import BedTagAdministrationTable from "./bed-tag/bed-tag-administration-table.component";
import BedTypeAdministrationTable from "./bed-type/bed-type-administration-table.component";
import Home from "./home.component";
import styles from "./root.scss";
import WardWithBeds from "./ward-with-beds/ward-with-beds.component";

function getSpaBasePath(): string {
  const value = (globalThis as { spaBase?: unknown }).spaBase;
  return typeof value === "string" ? value : "";
}

function getOpenmrsSpaBase(): string {
  const value = (
    globalThis as { getOpenmrsSpaBase?: () => unknown }
  ).getOpenmrsSpaBase?.();
  return typeof value === "string" ? value : "";
}

const Root: React.FC = () => {
  const spaBasePath = getSpaBasePath();
  const bedManagementBasename = `${getOpenmrsSpaBase()}bed-management`;

  useLeftNav({
    name: "bed-management-left-panel-slot",
    basePath: spaBasePath,
    mode: "normal",
  });

  return (
    <AppErrorBoundary appName="esm-bed-management-app">
      <BrowserRouter basename={bedManagementBasename}>
        <main className={styles.container}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/location/:location" element={<WardWithBeds />} />
            <Route
              path="/bed-administration"
              element={<BedAdministrationTable />}
            />
            <Route path="/bed-tags" element={<BedTagAdministrationTable />} />
            <Route path="/bed-types" element={<BedTypeAdministrationTable />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AppErrorBoundary>
  );
};

export default Root;
