import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type RecordPermission } from '../core/api/types/RecordPermission';
import { type StockOperationDTO } from '../core/api/types/stockOperation/StockOperationDTO';
import { type StockOperationType } from '../core/api/types/stockOperation/StockOperationType';

const mockCanEdit = vi.hoisted(() => vi.fn(() => false));

vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: ({ children }: { children: ReactNode }) => (mockCanEdit() ? children : null),
}));

vi.mock('./stock-operations-modal/stock-operations-approve-button.component', () => ({
  default: () => <span>approve action</span>,
}));
vi.mock('./stock-operations-modal/stock-operations-approve-dispatch-button.component', () => ({
  default: () => <span>dispatch action</span>,
}));
vi.mock('./stock-operations-modal/stock-operations-cancel-button.component', () => ({
  default: () => <span>cancel action</span>,
}));
vi.mock('./stock-operations-modal/stock-operations-completed-dispatch-button.component', () => ({
  default: () => <span>receive action</span>,
}));
vi.mock('./stock-operations-modal/stock-operations-issue-stock-button.component', () => ({
  default: () => <span>issue action</span>,
}));
vi.mock('./stock-operations-modal/stock-operations-print-button.component', () => ({
  default: () => <span>print action</span>,
}));
vi.mock('./stock-operations-modal/stock-operations-reject-button.component', () => ({
  default: () => <span>reject action</span>,
}));
vi.mock('./stock-operations-modal/stock-operations-return-button.component', () => ({
  default: () => <span>return action</span>,
}));

import StockOperationActions from './stock-operation-actions.component';

const operationType = {
  operationType: 'adjustment',
  allowExpiredBatchNumbers: false,
} as StockOperationType;

const defaultPermission: RecordPermission = {
  canView: true,
  canEdit: false,
  canApprove: false,
  canReceiveItems: false,
  canDisplayReceivedItems: false,
  isRequisitionAndCanIssueStock: false,
  canUpdateBatchInformation: false,
};

function renderActions(permission: Partial<RecordPermission>) {
  const stockOperation = {
    operationType: 'adjustment',
    permission: { ...defaultPermission, ...permission },
  } as StockOperationDTO;

  return render(<StockOperationActions stockOperation={stockOperation} stockOperationType={operationType} />);
}

describe('StockOperationActions', () => {
  beforeEach(() => {
    mockCanEdit.mockReturnValue(false);
  });

  it('hides approval actions when the frontend edit privilege is missing', () => {
    renderActions({ canEdit: false, canApprove: true });

    expect(screen.queryByText('approve action')).not.toBeInTheDocument();
  });

  it('shows approval actions only when frontend and backend permissions allow them', () => {
    mockCanEdit.mockReturnValue(true);

    renderActions({ canEdit: false, canApprove: true });

    expect(screen.getByText('approve action')).toBeInTheDocument();
    expect(screen.getByText('reject action')).toBeInTheDocument();
  });

  it('shows receiving actions only when frontend and backend permissions allow them', () => {
    mockCanEdit.mockReturnValue(true);

    renderActions({ canEdit: false, canReceiveItems: true });

    expect(screen.getByText('receive action')).toBeInTheDocument();
  });

  it('shows issue actions only when frontend and backend permissions allow them', () => {
    mockCanEdit.mockReturnValue(true);

    renderActions({ canEdit: false, isRequisitionAndCanIssueStock: true });

    expect(screen.getByText('issue action')).toBeInTheDocument();
  });

  it('still requires the frontend edit privilege for edit-only actions', () => {
    renderActions({ canEdit: true });

    expect(screen.queryByText('cancel action')).not.toBeInTheDocument();
  });

  it('shows edit-only actions when both backend and frontend permissions allow them', () => {
    mockCanEdit.mockReturnValue(true);

    renderActions({ canEdit: true });

    expect(screen.getByText('cancel action')).toBeInTheDocument();
  });
});
