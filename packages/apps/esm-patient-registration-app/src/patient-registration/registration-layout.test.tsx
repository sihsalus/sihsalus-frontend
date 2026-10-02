import { Button } from '@carbon/react';
import { useLayoutType } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegistrationLayout } from './registration-layout.component';

const mockUseLayoutType = vi.mocked(useLayoutType);

afterEach(() => mockUseLayoutType.mockReturnValue('small-desktop'));

it('keeps a single accessible title and action set when switching from desktop to tablet', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const layout = () => (
    <RegistrationLayout
      title="Create new patient"
      sections={[]}
      onSectionSelect={vi.fn()}
      actions={
        <>
          <Button onClick={onSave}>Register patient</Button>
          <Button kind="tertiary" onClick={onCancel}>
            Cancel
          </Button>
        </>
      }
    >
      <label>
        Given name
        <input name="givenName" defaultValue="Synthetic" />
      </label>
    </RegistrationLayout>
  );
  mockUseLayoutType.mockReturnValue('small-desktop');
  const { rerender } = render(layout());
  expect(screen.getByRole('heading', { level: 1, name: 'Create new patient' })).toBeInTheDocument();
  await user.type(screen.getByRole('textbox', { name: 'Given name' }), ' entry');
  await user.click(screen.getByRole('button', { name: 'Register patient' }));
  expect(onSave).toHaveBeenCalledTimes(1);

  mockUseLayoutType.mockReturnValue('tablet');
  rerender(layout());
  expect(screen.getAllByRole('button', { name: 'Register patient' })).toHaveLength(1);
  expect(screen.getByRole('textbox', { name: 'Given name' })).toHaveValue('Synthetic entry');
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
});

it('allows keyboard section navigation without changing the route or submitting the form', async () => {
  const user = userEvent.setup();
  const onSectionSelect = vi.fn();
  const onSubmit = vi.fn();
  const originalHash = window.location.hash;
  mockUseLayoutType.mockReturnValue('small-desktop');
  render(
    <form onSubmit={onSubmit}>
      <RegistrationLayout
        title="Update patient"
        sections={[{ id: 'contact', label: 'Residence, birthplace and contact' }]}
        onSectionSelect={onSectionSelect}
        actions={<Button disabled>Update patient</Button>}
      >
        <section id="contact">Synthetic contact fields</section>
      </RegistrationLayout>
    </form>,
  );
  await user.tab();
  expect(screen.getByRole('link', { name: 'Residence, birthplace and contact' })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(onSectionSelect).toHaveBeenCalledExactlyOnceWith('contact');
  expect(window.location.hash).toBe(originalHash);
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Update patient' })).toBeDisabled();
});
