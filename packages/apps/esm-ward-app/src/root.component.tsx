import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import WardView from './ward-view/ward-view.component';

const trimTrailingSlash = (path: string) => path.replace(/\/+$/, '');

const Root: React.FC = () => {
  // t('wards', 'Wards')
  const spaBase = trimTrailingSlash(window.getOpenmrsSpaBase?.() ?? globalThis.spaBase ?? '/openmrs/spa');
  const wardViewBasename = `${spaBase}/home/ward`;

  return (
    <main>
      <BrowserRouter basename={wardViewBasename}>
        <Routes>
          <Route path="/" element={<WardView />} />
          <Route path="/:locationUuid" element={<WardView />} />
        </Routes>
      </BrowserRouter>
    </main>
  );
};

export default Root;
