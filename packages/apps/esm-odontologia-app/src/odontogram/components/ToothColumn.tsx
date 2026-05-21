/**
 * ToothColumn — wraps a single tooth column with an info button + modal trigger.
 *
 * Shows a small "i" button on hover. Clicking it opens the ToothInfoModal
 * with all findings for that tooth, allowing viewing details and removing findings.
 */

import React, { useCallback, useState } from 'react';
import { useOdontogramContext } from '../providers/OdontogramProvider';
import ToothInfoModal from './ToothInfoModal';
import './ToothInfoModal.css';

interface ToothColumnProps {
  toothId: number;
  children: React.ReactNode;
}

const ToothColumn: React.FC<ToothColumnProps> = ({ toothId, children }) => {
  const [showModal, setShowModal] = useState(false);
  const { data, config, toothActions, readOnly } = useOdontogramContext();

  const tooth = data.teeth.find((t) => t.toothId === toothId);
  const toothConfig = [...config.teeth.upper, ...config.teeth.lower].find((t) => t.id === toothId);

  const handleClose = useCallback(() => {
    setShowModal(false);
  }, []);

  const handleRemoveFinding = useCallback(
    (params: { toothId: number; findingId: number; instanceId?: string }) => {
      toothActions.removeToothFinding(params);
    },
    [toothActions],
  );

  const handleRegisterFinding = useCallback(
    (params: {
      toothId: number;
      findingId: number;
      subOptionId?: number;
      color: { id: number; name: string };
      designNumber?: number | null;
    }) => {
      toothActions.registerToothFinding(params);
    },
    [toothActions],
  );

  // NOTE: Info "i" button, finding-count badge and eye button intentionally
  // removed from the canvas for now. Per-tooth detail entry will be re-added
  // in a later iteration with a polished UX. The modal logic and state stay
  // here so re-enabling is just a matter of restoring the trigger element.
  //
  // The wrapper div `tim-tooth-col` was also removed: it only existed to give
  // the absolute-positioned info button a relative parent. Without it, the
  // tooth SVG becomes a direct flex item of the visualizationRow — structurally
  // identical to SpaceBetweenTeeth — so the flex parent computes both heights
  // the same way and they line up at the same pixel.

  return (
    <>
      {children}
      {showModal && tooth && toothConfig && (
        <ToothInfoModal
          toothId={toothId}
          findings={tooth.findings}
          annotations={tooth.annotations ?? []}
          findingOptions={config.findingOptions}
          zones={toothConfig.zones}
          rootDesign={toothConfig.rootDesign}
          readOnly={readOnly}
          onRemoveFinding={handleRemoveFinding}
          onRegisterFinding={handleRegisterFinding}
          onClose={handleClose}
        />
      )}
    </>
  );
};

export default ToothColumn;
