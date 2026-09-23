import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import en from '../../../translations/en.json';
import es from '../../../translations/es.json';
import DesignSelector from './DesignSelector';

const i18n = createInstance();
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: i18n.t.bind(i18n) }) }));

const designs = [
  { number: 1, nombre: 'Catálogo 1', componente: 'Finding5Design1' },
  { number: 2, nombre: 'Catálogo 2', componente: 'Finding5Design2' },
];

beforeAll(async () => {
  await i18n.init({ resources: { en: { translation: en }, es: { translation: es } }, lng: 'en', fallbackLng: false });
});

it.each([
  { language: 'en', tooth: 'Tooth 11', color: 'Color: Blue', design: 'Design 1', applied: 'Applied', close: 'Close' },
  {
    language: 'es',
    tooth: 'Diente 11',
    color: 'Color: Azul',
    design: 'Diseño 1',
    applied: 'Aplicado',
    close: 'Cerrar',
  },
])('localizes design controls and preserves keyboard selection in $language', async (labels) => {
  await i18n.changeLanguage(labels.language);
  const user = userEvent.setup();
  const onClose = vi.fn();
  const onDesignSelect = vi.fn();
  render(
    <DesignSelector
      isOpen
      keepOpen
      onClose={onClose}
      designs={designs}
      selectedColor={{ id: 1, name: 'blue' }}
      findingName="Caries"
      toothId={11}
      toothZones={5}
      onDesignSelect={onDesignSelect}
      existingFindings={[{ id: 'synthetic-finding', findingId: 5, designNumber: 1, color: { id: 1, name: 'blue' } }]}
    />,
  );

  expect(screen.getByText(labels.tooth)).toBeVisible();
  expect(screen.getByText(labels.color)).toBeVisible();
  const applied = screen.getByRole('button', { name: `${labels.design} ${labels.applied}`, pressed: true });
  applied.focus();
  await user.keyboard('{Enter}');
  expect(onDesignSelect).toHaveBeenLastCalledWith(designs[0]);
  await user.tab();
  await user.keyboard(' ');
  expect(onDesignSelect).toHaveBeenLastCalledWith(designs[1]);
  expect(onDesignSelect).toHaveBeenCalledTimes(2);
  expect(onClose).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: labels.close }));
  expect(onClose).toHaveBeenCalledOnce();
});

it('shows a translated unavailable state without exposing component names', async () => {
  await i18n.changeLanguage('en');
  render(
    <DesignSelector
      isOpen
      onClose={vi.fn()}
      designs={[{ number: 99, nombre: 'Unknown', componente: 'InternalMissingComponent' }]}
      selectedColor={null}
      findingName="Caries"
      toothId={11}
      toothZones={5}
      onDesignSelect={vi.fn()}
    />,
  );
  expect(screen.getByText('This design is unavailable.')).toBeVisible();
  expect(screen.queryByText(/InternalMissingComponent/)).not.toBeInTheDocument();
});
