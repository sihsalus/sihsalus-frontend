import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import en from '../../../translations/en.json';
import es from '../../../translations/es.json';
import { adultConfig } from '../config/adultConfig';
import { OdontogramProvider } from '../providers/OdontogramProvider';
import FormDentalClinicalFindings from './FormDentalClinicalFindings';
import OdontogramTextFields from './OdontogramTextFields';
import ToothVisualization from './ToothVisualization';

const i18n = createInstance();
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: i18n.t.bind(i18n) }) }));
const data = { teeth: [], spacingFindings: {}, legendSpaces: [], especificaciones: 'Synthetic note' };

beforeAll(async () => {
  await i18n.init({ resources: { en: { translation: en }, es: { translation: es } }, lng: 'en', fallbackLng: false });
});

it.each([
  { language: 'en', select: 'Select a finding...', picker: 'Select a finding', tooth: 'Tooth 11', design: 'Design 1' },
  {
    language: 'es',
    select: 'Seleccionar hallazgo...',
    picker: 'Seleccionar hallazgo',
    tooth: 'Diente 11',
    design: 'Diseño 1',
  },
])('opens a tooth and applies a design with the keyboard in $language', async (labels) => {
  await i18n.changeLanguage(labels.language);
  const user = userEvent.setup();
  const onChange = vi.fn();
  const chartData = { ...data, teeth: [{ toothId: 11, findings: [] }] };
  const content = (readOnly: boolean) => (
    <OdontogramProvider config={adultConfig} data={chartData} onChange={onChange} readOnly={readOnly}>
      <FormDentalClinicalFindings />
      <ToothVisualization idTooth={11} zones={4} />
    </OdontogramProvider>
  );
  const { rerender } = render(content(false));
  await user.click(screen.getByRole('button', { name: labels.select }));
  await user.click(
    within(screen.getByRole('dialog', { name: labels.picker })).getByRole('button', {
      name: 'Lesión de caries dental',
    }),
  );
  await user.click(screen.getByRole('button', { name: 'MB' }));
  const tooth = screen.getByRole('button', { name: labels.tooth });
  tooth.focus();
  await user.keyboard('{Enter}');
  const design = screen.getByRole('button', { name: labels.design });
  design.focus();
  await user.keyboard(' ');
  expect(onChange).toHaveBeenCalledOnce();
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      especificaciones: 'Synthetic note',
      teeth: [
        expect.objectContaining({
          toothId: 11,
          findings: [
            expect.objectContaining({
              findingId: 16,
              subOptionId: 1601,
              color: { id: 102, name: 'red' },
              designNumber: 1,
            }),
          ],
        }),
      ],
    }),
  );
  rerender(content(true));
  expect(screen.getByRole('button', { name: labels.tooth })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: labels.tooth }));
  expect(onChange).toHaveBeenCalledOnce();
});

it.each([
  { language: 'en', select: 'Select a finding...', search: 'Search findings', clear: 'Clear finding', blue: 'Blue' },
  {
    language: 'es',
    select: 'Seleccionar hallazgo...',
    search: 'Buscar hallazgo',
    clear: 'Limpiar hallazgo',
    blue: 'Azul',
  },
])('keeps finding selection and clearing independently accessible in $language', async (labels) => {
  await i18n.changeLanguage(labels.language);
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <OdontogramProvider config={adultConfig} data={data} onChange={onChange}>
      <FormDentalClinicalFindings />
    </OdontogramProvider>,
  );
  await user.click(screen.getByRole('button', { name: labels.select }));
  const dialog = screen.getByRole('dialog');
  await user.type(within(dialog).getByRole('searchbox', { name: labels.search }), 'caries');
  await user.click(within(dialog).getByRole('button', { name: 'Lesión de caries dental' }));
  const trigger = screen.getByRole('button', { name: 'Lesión de caries dental', expanded: false });
  const clear = screen.getByRole('button', { name: labels.clear });
  expect(clear).toBeEnabled();
  expect(trigger).not.toContainElement(clear);
  // Selecting a two-color finding shows translated controls without altering the stored color codes.
  await user.click(trigger);
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Aparato ortodóntico fijo' }));
  await user.click(screen.getByRole('button', { name: labels.blue }));
  expect(screen.getByRole('button', { name: labels.blue })).toHaveAttribute('aria-pressed', 'true');
  await user.tab({ shift: true });
  expect(screen.getByRole('button', { name: labels.clear })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('button', { name: labels.select })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('button', { name: labels.select })).toHaveFocus();
  expect(onChange).not.toHaveBeenCalled();
});

it.each([
  {
    language: 'en',
    label: 'Specifications',
    help: 'What to enter in Specifications',
    heading: 'What goes in "Specifications"?',
    close: 'Close',
  },
  {
    language: 'es',
    label: 'Especificaciones',
    help: 'Qué va en Especificaciones',
    heading: '¿Qué va en "Especificaciones"?',
    close: 'Cerrar',
  },
])('localizes help while preserving read-only notes in $language', async (labels) => {
  await i18n.changeLanguage(labels.language);
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<OdontogramTextFields data={data} onChange={onChange} readOnly />);
  const notes = screen.getByRole('textbox', { name: new RegExp(labels.label) });
  expect(notes).toBeDisabled();
  expect(notes).toHaveValue('Synthetic note');
  await user.click(screen.getByRole('button', { name: labels.help }));
  expect(screen.getByRole('dialog', { name: labels.heading })).toBeVisible();
  await user.click(screen.getByRole('button', { name: labels.close }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(notes).toHaveValue('Synthetic note');
  expect(onChange).not.toHaveBeenCalled();
});
