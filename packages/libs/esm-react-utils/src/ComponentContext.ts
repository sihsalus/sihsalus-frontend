import { type ComponentConfig } from '@openmrs/esm-extensions';
import { createContext } from 'react';

/**
 * Available to all components. Provided by `openmrsComponentDecorator`.
 */
export const ComponentContext = createContext<ComponentConfig>({
  moduleName: '',
  featureName: '',
});
