import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'node:util';

if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder as unknown as typeof global.TextEncoder;
}

if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder as unknown as typeof global.TextDecoder;
}
