import { formatAverageWaitTime } from './format-average-wait-time';

it.each([
  [12.3456789, 'en', '12.3'],
  ['12.3456789', 'es-PE', '12.3'],
  ['12.3456789', 'es', '12,3'],
  [12.35, 'en_US', '12.4'],
  [0, 'es', '0'],
  ['0', 'en', '0'],
  [69, 'en', '69'],
  [0.04, 'es', '0'],
])('formats %s minutes using %s as %s', (value, locale, expected) => {
  expect(formatAverageWaitTime(value, locale)).toBe(expected);
});

it.each([null, undefined, '', ' ', 'invalid', Number.NaN, Number.POSITIVE_INFINITY, 'Infinity', -1])(
  'does not present an absent or invalid metric (%s) as a confirmed wait',
  (value) => expect(formatAverageWaitTime(value, 'es')).toBe('--'),
);
