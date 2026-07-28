import React from 'react';
import type { ToothRootDesign } from '../types/odontogram';

type ToothDesignProps = {
  design: ToothRootDesign;
};

const ToothDesigns: React.FC<ToothDesignProps> = ({ design }) => {
  const renderDesign = () => {
    switch (design) {
      case 'default':
        return (
          <>
            <line x1="0" y1="20" x2="5" y2="0" stroke="black" strokeWidth="0.15" />
            <line x1="5" y1="0" x2="10" y2="20" stroke="black" strokeWidth="0.15" />
            <line x1="10" y1="20" x2="15" y2="0" stroke="black" strokeWidth="0.15" />
            <line x1="15" y1="0" x2="20" y2="20" stroke="black" strokeWidth="0.15" />
            <line x1="7.5" y1="10" x2="10" y2="0" stroke="black" strokeWidth="0.15" />
            <line x1="10" y1="0" x2="12.5" y2="10" stroke="black" strokeWidth="0.15" />
          </>
        );
      case 'design2':
        return (
          <>
            <line x1="5" y1="20" x2="10" y2="0" stroke="black" strokeWidth="0.15" />
            <line x1="10" y1="0" x2="15" y2="20" stroke="black" strokeWidth="0.15" />
          </>
        );

      /* case 'design3':
        return (
          <>
            <line x1="2" y1="20" x2="8" y2="0" stroke="black" strokeWidth="0.15" />
            <line x1="8" y1="0" x2="14" y2="20" stroke="black" strokeWidth="0.15" />
            <line x1="11" y1="10" x2="14" y2="0" stroke="black" strokeWidth="0.15" strokeDasharray="1" />
            <line x1="14" y1="0" x2="18" y2="20" stroke="black" strokeWidth="0.15" strokeDasharray="1" />
          </>
        );
      case 'design4':
        return (
          <>
            <line x1="2" y1="20" x2="8" y2="0" stroke="black" strokeWidth="0.15" strokeDasharray="1" />
            <line x1="8" y1="0" x2="12" y2="10" stroke="black" strokeWidth="0.15" strokeDasharray="1" />
            <line x1="10" y1="20" x2="14" y2="0" stroke="black" strokeWidth="0.15" />
            <line x1="14" y1="0" x2="18" y2="20" stroke="black" strokeWidth="0.15" />
          </>
        ); */
      case 'design3':
        return (
          <>
            <line x1="0" y1="20" x2="5" y2="0" stroke="black" strokeWidth="0.15" />
            <line x1="5" y1="0" x2="10" y2="20" stroke="black" strokeWidth="0.15" />
            <line x1="10" y1="20" x2="15" y2="0" stroke="black" strokeWidth="0.15" strokeDasharray="1" />
            <line x1="15" y1="0" x2="20" y2="20" stroke="black" strokeWidth="0.15" strokeDasharray="1" />
          </>
        );
      case 'design4':
        return (
          <>
            <line x1="0" y1="20" x2="5" y2="0" stroke="black" strokeWidth="0.15" strokeDasharray="1" />
            <line x1="5" y1="0" x2="10" y2="20" stroke="black" strokeWidth="0.15" strokeDasharray="1" />
            <line x1="10" y1="20" x2="15" y2="0" stroke="black" strokeWidth="0.15" />
            <line x1="15" y1="0" x2="20" y2="20" stroke="black" strokeWidth="0.15" />
          </>
        );
      default:
        return null;
    }
  };
  return (
    <svg width="60" height="60" viewBox="0 0 20 20" className="tooth-design">
      {renderDesign()}
    </svg>
  );
};

export default ToothDesigns;
