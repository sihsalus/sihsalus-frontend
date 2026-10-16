# @openmrs/esm-translations

This framework library supports translations that can be used throughout the O3 application.

Use translations with `getCoreTranslation`. The translations are in the `core` namespace.

## Under the hood

Translation key-value pairs are kept in `src/translations.ts`. The keys in that file
are used to generate the `CoreTranslationKey` type, which allows Typescript to tell
developers whether a key is in the core translations or not. The values are used by
the `getCoreTranslation` function, so no default needs to be provided.

`yarn extract-translations` uses `i18next-cli` and its AST visitor to read string
defaults from `src/translations.ts`. No separate lexer or regular-expression
parser is maintained. Existing catalog values and keys are preserved; extraction
does not overwrite reviewed translations or prune dynamically used entries.

The app shell uses the core `connectionStatusTitle`, `connectionOffline`, and
`connectionOnline` keys for browser connectivity events. Their English and
Spanish resources must remain available because those events can fire before
translation initialization finishes; the app-shell patch also supplies safe
Spanish fallbacks for that startup window.
