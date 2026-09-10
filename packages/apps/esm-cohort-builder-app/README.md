![Node.js CI](https://github.com/openmrs/openmrs-esm-template-app/workflows/Node.js%20CI/badge.svg)

👋 New to our project? Be sure to review the ![OpenMRS 3 Frontend Developer Documentation](https://openmrs.atlassian.net/wiki/x/IABBHg) 🧑‍🏫

# OpenMRS ESM Cohort Builder App

The Cohort Builder is a tool in OpenMRS 1.0 in the Reporting Compatibility module (included with most OpenMRS installations) that lets the user perform ad-hoc queries for patients with defined characteristics, and combines multiple queries into more complex ones.

## Running this code

```sh
yarn  # to install dependencies
yarn start  # to run the dev server
```

Once it is running, a browser window
should open with the OpenMRS 3 application. Log in and then navigate to
`/openmrs/spa/cohort-builder`.

## Composition queries

Composition refers to the numbered entries currently shown in search history.
It combines their query definitions and evaluates the resulting query through
`POST /ws/rest/v1/reportingrest/adhocquery?v=full`. It requires the Reporting and
Reporting REST modules declared in `src/routes.json` and the existing
`app:constructorCohortes` access guard.

Use positive history numbers with `AND`, `OR`, `NOT` and balanced parentheses,
for example `(1 OR 2) AND NOT 3`. Surrounding whitespace and nested parentheses
are supported. Incomplete expressions and missing history references show the
translated invalid-composition message without submitting a query.

Each referenced query keeps its original filter grouping. All filter references,
including numbers above nine, are offset together when queries are combined.
Composing a query must not modify the source history or the query definition
produced by repeating the same composition. History is limited to the current
session's most recent 20 entries; use the numbers currently displayed after
removing entries.

Local regression coverage is in `src/components/composition/*.test.*`. Before
clinical acceptance, use synthetic data in coordinated DEV/QLTY to combine two
searches with multiple criteria, repeat the composition, and rerun the original
searches. Verify the returned membership against the criteria; unit tests do not
validate the deployed Reporting implementation.

## Result and saved-definition tables

Result tables and saved cohorts/queries share the framework's client-side
pagination. The displayed page and page size track the visible rows. A new
search resets its results to page one; a refreshed saved list clamps a removed
page to the last available page.

View and delete actions resolve the saved definition by the displayed row's ID,
including on pages after the first. The confirmation modal and deletion callback
must refer to that same ID. The existing confirmation and backend deletion
contracts remain in place. This does not change backend pagination or collection
endpoints.

`src/components/pagination.regression.test.tsx` exercises page navigation, size
changes, row-specific view/delete actions and smaller replacement datasets.
Manual acceptance must also check the modal name and affected ID for synthetic
definitions beyond the first page, then verify deletion and cleanup in DEV/QLTY.

## History actions and saving

History actions use the displayed entry, including after changing page size.
Removal resolves a stable session identity against the current store, preserves
searches added while confirmation was open, and renumbers the visible history
from that same store for composition. Evicted entries cannot delete successors.

History retains only the CSV export columns in memory within the existing
20-entry limit. Downloads use that original snapshot, without rerunning a query
whose membership may have changed. CSV quoting and text-cell handling preserve
column boundaries and prevent spreadsheet evaluation of user-controlled text.

Saving a query or cohort validates trimmed required fields, prevents repeated
submissions, and keeps the form and its entries when saving cannot be confirmed.
The shared form closes only after its save callback fulfills. Query metadata
comes from the submitted form without mutating the source query. No automatic
POST retries are performed; a lost response still requires checking whether the
server created the definition before retrying.

Regression cases are in `search-history.regression.test.tsx`,
`save-history.regression.test.tsx`, and `search-history-store.test.ts`.
