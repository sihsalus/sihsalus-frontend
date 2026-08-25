# openmrs-esm-implementer-tools-app

openmrs-esm-implementer-tools-app provides a UI for
viewing and editing configurations, and viewing other administrative information
about the frontend application. It is part of the
[Extension System](https://github.com/openmrs/openmrs-rfc-frontend/pull/27/files).

The backend-module inventory is an implementer-only diagnostic. Failed
background inventory requests are recorded in the console and shown only in
the Backend Modules tab; they must not interrupt the active application with a
global toast. A successful inventory may still raise a global warning when it
finds missing or incompatible dependencies.
