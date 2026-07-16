# openmrs-esm-error-handling

openmrs-esm-error-handling provides facilities for handling errors
consistently across the application.

## User-facing error messages

Use `getUserFacingErrorMessage` before displaying an unknown error. The helper
logs the complete technical error, resolves explicitly mapped error codes or
HTTP statuses, and otherwise returns the localized fallback supplied by the
caller. Backend and browser error messages are never returned to the user.

```ts
import { getUserFacingErrorMessage } from '@openmrs/esm-framework';

const message = getUserFacingErrorMessage(error, t('saveFailed', 'No se pudo guardar el registro.'), {
  codeMessages: {
    DUPLICATE_IDENTIFIER: t('duplicateIdentifier', 'El identificador ya está en uso.'),
  },
  statusMessages: {
    403: t('saveForbidden', 'No tienes permisos para guardar este registro.'),
  },
  logContext: 'Saving patient',
});
```

Set `log: false` when the technical error has already been recorded. Use
`logError(error, context)` when logging and rendering happen at different
points in a component lifecycle.
