# @openmrs/esm-translations

This framework library supports translations that can be used throughout the O3 application.

Use translations with `getCoreTranslation`. The translations are in the `core` namespace.

## Under the hood

Translation key-value pairs are kept in `src/translations.ts`. The keys in that file
are used to generate the `CoreTranslationKey` type, which allows Typescript to tell
developers whether a key is in the core translations or not. The values are used by
the `getCoreTranslation` function, so no default needs to be provided.

A custom i18next-parser lexer is defined so that the `extract-translations` script
pulls translation strings directly out of this `translations.ts` file.

The app shell uses the core `connectionStatusTitle`, `connectionOffline`, and
`connectionOnline` keys for browser connectivity events. Their English and
Spanish resources must remain available because those events can fire before
translation initialization finishes; the app-shell patch also supplies safe
Spanish fallbacks for that startup window.
