import React from 'react';

const ImmunizationIllustration: React.FC = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <title>Calendar and Vaccine Icon</title>
    <rect x="4" y="12" width="56" height="48" rx="4" fill="#E8F5F4" />
    <rect x="4" y="10" width="56" height="48" rx="4" fill="#CEE6E5" stroke="#7BBCB9" strokeWidth="2" />
    <path d="M4 22H60" stroke="#7BBCB9" strokeWidth="2" />
    <circle cx="16" cy="16" r="2" fill="#7BBCB9" />
    <circle cx="24" cy="16" r="2" fill="#7BBCB9" />
    <circle cx="32" cy="16" r="2" fill="#7BBCB9" />
    <path
      d="M20.5 42C20.5 40.6193 21.6193 39.5 23 39.5H53C54.3807 39.5 55.5 40.6193 55.5 42C55.5 43.3807 54.3807 44.5 53 44.5H23C21.6193 44.5 20.5 43.3807 20.5 42Z"
      fill="url(#paint0_linear)"
    />
    <path
      d="M20.5 30.3333C20.5 28.9526 21.6193 27.8333 23 27.8333H53C54.3807 27.8333 55.5 28.9526 55.5 30.3333C55.5 31.714 54.3807 32.8333 53 32.8333H23C21.6193 32.8333 20.5 31.714 20.5 30.3333Z"
      fill="url(#paint1_linear)"
    />
    <rect x="28" y="34" width="10" height="18" rx="2" fill="#7BBCB9" stroke="#5A7F7C" strokeWidth="1.5" />
    <path d="M33 34V28" stroke="#5A7F7C" strokeWidth="2" strokeLinecap="round" />
    <line x1="28" y1="42" x2="38" y2="42" stroke="#5A7F7C" strokeWidth="1.5" />
    <line x1="28" y1="38" x2="38" y2="38" stroke="#5A7F7C" strokeWidth="1.5" />
    <rect x="30" y="43" width="6" height="7" rx="1" fill="#5A7F7C" fillOpacity="0.3" />
    <path d="M32.5 28L33.5 28L33.5 26L32.5 26L32.5 28Z" fill="#5A7F7C" />
    <path d="M29 35C29 34.4477 29.4477 34 30 34H31V36H29V35Z" fill="#A3D3D1" />
    <defs>
      <linearGradient id="paint0_linear" x1="20.5" y1="42" x2="55.5" y2="42" gradientUnits="userSpaceOnUse">
        <stop stopColor="#8BC6C3" />
        <stop offset="1" stopColor="#7BBCB9" />
      </linearGradient>
      <linearGradient id="paint1_linear" x1="20.5" y1="30.3333" x2="55.5" y2="30.3333" gradientUnits="userSpaceOnUse">
        <stop stopColor="#8BC6C3" />
        <stop offset="1" stopColor="#7BBCB9" />
      </linearGradient>
    </defs>
  </svg>
);

export default ImmunizationIllustration;
