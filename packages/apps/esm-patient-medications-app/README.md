# esm-patient-medications-app

The medications widget. It provides a tabular overview of the active and past medications recorded for a patient. It also provides the ability to modify, reorder or discontinue medications as well as an order basket for ordering new medications.

Creating or editing a medication order requires an active clinical Provider linked to the current session. Administrative accounts without that clinical identity must see a blocked action instead of creating an unattributed draft.

Drug search combines direct OpenMRS `Drug` matches with formulations linked to matching Drug-class concept names and synonyms, so aliases imported through OCL can resolve to an orderable presentation. Concept import alone is not sufficient: a medication must also have an OpenMRS Drug record with the reviewed generic name, strength and dosage form. The UI does not create uncoded medication orders or accept a free-text drug name; missing presentations must follow the governed Pharmacy/content catalog workflow.

If one search source fails but another returns medications, the UI keeps the usable results and shows a partial-results warning without exposing backend details. Persistence errors are normalized to a safe user-facing message; field validation objects are not written to the browser console.

## Direct prescribing entry

The existing `add-drug-order` workspace accepts `returnToOrderBasket` for the direct outpatient prescribing action. When opened as a root workspace, its form save/cancel returns to the existing `order-basket` after closing is confirmed. Pending orders stay in the shared basket; adding a draft does not sign or submit it. Child workspaces retain their existing parent navigation, and the window header keeps its ordinary close behavior.

A patient or visit change during closing prevents reopening the previous chart context. A refused or failed basket launch reports a safe message and leaves drafts available from the basket action. The caller checks medication editing plus both basket privileges before invoking the visit guard. This reuses the existing OpenMRS order APIs and does not implement medication-history capture.

## Missing medications and supplies

The search includes **Cannot find a medication or supply?**, an optional,
collapsed catalog-review helper. It explains generic names/synonyms and the
difference between the local catalog and the MINSA list: no search result does
not prove that an item is absent from MINSA or unavailable in stock.

The free-text area prepares an administrative draft (maximum 1,000 characters)
for Pharmacy to review a medication's name, strength and form, or a supply's
specifications. It is **not a prescription**: it never adds an order to the
basket, writes the chart, creates catalog metadata or sends a request. Only an
explicit click copies a preview bearing that disclaimer. A failed or unavailable
clipboard leaves the preview available for manual copying, without exposing
browser error details. Sending remains manual through the institution's
approved channel; this is not a request-tracking system.

Do not enter patient information. The helper has no patient fields, receives no
clinical data, and uses no browser storage. Its local state resets when the
search unmounts or patient, visit or account changes. The existing prescription
workspace's visit, provider and permission requirements remain authoritative.

OpenMRS has a native
[`drugNonCoded` REST field](https://github.com/openmrs/openmrs-module-webservices.rest/blob/master/omod/src/main/java/org/openmrs/module/webservices/rest/web/v1_0/resource/openmrs1_12/DrugOrderSubclassHandler1_12.java).
This change does not enable that separate clinical workflow: approval from
Pharmacy/clinical owners, the deployed backend/content contract, validation of
structured dosing, allergy/safety checks, signing, printing, dispensing and
audit are still required. Never substitute an invented Drug UUID or a catalog
request for a valid order, and do not model a supply as a drug implicitly.

Minimum regression coverage: blank descriptions, explicit copying and its
failure/unavailability, no persistence, repeated-click protection, context
changes, and the existing coded-order form. A coordinated synthetic QLTY smoke
of search, draft copying and normal prescription remains required before merge.

## Outpatient prescription contract

### Medication summary while scrolling

The prescription form keeps one medication summary and one `medication-info-slot`
mounted. Native CSS sticky positioning keeps that summary visible while scrolling
through the fields; its blue background is also used before scrolling. Dose,
route and unit changes update that same summary without mounting another copy.

The former intersection observer inserted an additional summary into the observed
layout. With scroll anchoring disabled, scrolling just past the summary's top
repeatedly added and removed that copy without further user input. A local
Chromium reproduction establishes this layout feedback, but does not establish
that it is the cause of every hospital report of medication-form flicker.

Minimum regression coverage: one summary across visibility transitions on desktop
and tablet, entered values and focus retained, and no implicit save. A browser
smoke must also check scrolling in both directions, the first and last fields,
long medication names, dose updates and the medication-info extension. Include a
case with `overflow-anchor: none` on the workspace scroll container to ensure
stability does not depend on the browser compensating for layout shifts. Confirm
the reported hospital scenario in coordinated DEV/QLTY before closing backlog
issue [#84](https://github.com/sihsalus/sihsalus-frontend.tasktree/issues/84).

### Required prescription fields

For outpatient prescriptions, the form visibly marks and validates the treatment duration, duration unit, dispense quantity and unit, number of refills, and configured indication. It follows the backend quantity policy and uses OpenMRS's safe required default while that policy is loading or unavailable, so a clinical role does not need broad global-property privileges and the fields do not become mandatory after the clinician starts entering a prescription. The duration selector is limited by `outpatientDurationUnitUuids` (days, weeks, and months by default); other backend duration units remain available outside the outpatient quantity workflow, and legacy values remain visible while an existing order is edited. New outpatient prescriptions default to structured dose, unit, route, and frequency fields and offer free-text dosage as an explicit exception, except for the configured single-dose frequency. Free-text dosage requires a nonblank regimen and retains the outpatient duration, dispensing, refill, and configured indication requirements; the dispense quantity must be entered manually and is never calculated from the text. Switching to free-text dosage clears the structured dosing fields; switching back requires structured dosing again. When the selected drug's dosage form exactly matches a configured dosing or dispensing unit, that unit is proposed without overwriting a clinician's selection; the dosing unit is only proposed in structured mode. A reason is required whenever the medication is marked for as-needed use; route and frequency are never inferred.

### Dose-unit catalog availability

The dose-unit selector uses only `drugDosingUnits` from the existing REST
OMOD's `/ws/rest/v1/orderentryconfig`. A drug's dosage form is proposed only
when its UUID is present in that catalog; it never substitutes for a missing
catalog. The REST resource can omit a catalog on HTTP 200 when its internal
query fails. Missing/malformed, empty, loading and failed responses therefore
have explicit states. No new OMOD, local concept list, global property or
privilege is introduced.

Retry reloads both existing order-entry requests without resetting form values.
Loading/retrying or an HTTP error blocks submission; structured dosing also
requires a unit in the current catalog. A previously selected unit remains
visible when unavailable and requires explicit replacement rather than silent
conversion. The existing free-text exception remains an explicit clinical
choice and does not hide a dose-catalog warning or bypass transport errors.

Local regressions exercise the real metadata hook and form with synthetic HTTP
responses, including 401/403/500, failed retry, recovery and preservation of
entered values. Payload/read-mapper checks establish UUID continuity, not live
database persistence. Before acceptance, use an authorized clinical account in
coordinated DEV/QLTY to verify the deployed REST version, permissions and the
members of `order.drugDosingUnitsConceptUuid`, then select a unit, sign a
synthetic prescription, reload it and clean up. An administrator's successful
catalog lookup alone does not validate the prescribing role.

## STAT and one administration

Urgency and dosing frequency are separate. `STAT` means start immediately; it does not make a daily prescription a single dose. The form and both medication draft builders preserve urgency, including existing scheduled-order dates. The medication basket and medication history identify STAT orders explicitly.

The **STAT — administer once now** preset requires `singleDoseFrequencyUuid`: the UUID of a clinically reviewed OpenMRS **OrderFrequency** whose concept means one administration only. The default is empty. The preset stays disabled when that UUID is absent from `/ws/rest/v1/orderentryconfig`, while a draft referencing an unavailable configured single-dose frequency cannot be submitted. Neither display names nor `frequencyPerDay` identify one-time dosing; `frequencyPerDay: 1` can mean once every day. The SIH Salus content frequency CSV inspected on 2026-09-07 contains periodic frequencies and does not establish a reviewed one-time frequency, so enabling this configuration remains a Pharmacy/content task.

The local `SIHSALUS/sihsalus` concept export `2026-07-16-02` does contain Frequency concept `4089` (`8574a202-8412-5ffa-9a1e-6e320290d7ce`), named “One time” / “Frecuencia de una vez”. It is a content candidate for review, but the order-frequency CSV has no corresponding row. A concept UUID must not be substituted for the missing OrderFrequency UUID. Pharmacy/content must review the concept, create or identify its native frequency record through the governed content workflow, verify the deployed fulfiller behavior, and only then configure the frontend.

Basket signing also requires current order-entry metadata and validates single-dose constraints before preparing the payload, including direct renewals. A loading, failed or missing frequency catalog blocks signing the configured one-time order. The shared basket dispatcher follows current mounted preparers, and existing-encounter submission prepares every payload before the first write; a preparation failure retains every unsent item for review.

Selecting the preset explicitly applies `urgency: STAT`, the configured native `frequency` UUID, structured dosing, today's start date, `asNeeded: false`, `numRefills: 0`, and no duration or duration unit. It clears the old dispense quantity. The quantity estimate uses one dose only when dose and dispense unit UUIDs match; otherwise the clinician must enter the quantity. Dose, route, indication and additional instructions remain visible for review. Selecting the native single-dose frequency directly applies the same restrictions without changing urgency. Existing recurring STAT orders retain their frequency and duration until explicitly changed. The schema rejects single-dose drafts with PRN, refills, duration or free-text dosing.

This uses the existing `webservices.rest >=2.2.0` drug-order endpoint and native coded frequency; it adds no FHIR Timing payload, synthetic frequency, administration event, automatic discontinuation or expiry. OpenMRS distinguishes the [order urgency enum](https://rest.openmrs.org/#create-an-order) from the [coded OrderFrequency](https://resources.openmrs.org/doc-1.10/org/openmrs/OrderFrequency.html); its maintainers explain the [one-time versus STAT distinction](https://talk.openmrs.org/t/mapping-openmrs-order-frequencies-fhir/36421). An order remaining in the active list does not prove that a dose was administered or should repeat. Backend/fulfiller support for the configured once concept must be verified in coordinated DEV/QLTY before activation; the frontend cannot establish administration completion.

Minimum regression coverage: routine and daily STAT retain their regimen; the once preset and direct frequency selection remove repeating fields; PRN/refill/duration conflicts are rejected; matching-unit quantity counts one dose even when the prior estimate is identical or the preset is applied again; subsequent manual quantity overrides survive dose changes; missing content disables the preset; urgency and frequency survive new/revised/renewed REST payloads and both editing entry points. Clinical acceptance still requires an authorized synthetic patient, prescribing account and deployed SHA in DEV/QLTY, followed by save, reload, dispensing/administration review and fixture cleanup. No remote clinical fixtures were created for local validation.

### Draft start dates across midnight

New, renewed and revised drafts mark an untouched current-time default with
`startDateIsExplicit: false`. Signing omits `dateActivated` for that default even
on a later day, allowing the backend to assign the save time after the encounter
exists. Reopening refreshes that implicit default to the current date. Selecting
a date marks it explicit and preserves it through save/reopen; older drafts
without the flag conservatively retain their date. Explicit dates from a previous
day are still sent and remain subject to backend encounter/date validation.
Single-dose STAT drafts from an earlier day still require review before signing;
this change does not bypass that guard or change dose/frequency/quantity.
