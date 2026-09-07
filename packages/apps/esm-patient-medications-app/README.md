# esm-patient-medications-app

The medications widget. It provides a tabular overview of the active and past medications recorded for a patient. It also provides the ability to modify, reorder or discontinue medications as well as an order basket for ordering new medications.

Creating or editing a medication order requires an active clinical Provider linked to the current session. Administrative accounts without that clinical identity must see a blocked action instead of creating an unattributed draft.

Drug search combines direct OpenMRS `Drug` matches with formulations linked to matching Drug-class concept names and synonyms, so aliases imported through OCL can resolve to an orderable presentation. Concept import alone is not sufficient: a medication must also have an OpenMRS Drug record with the reviewed generic name, strength and dosage form. The UI does not create uncoded medication orders or accept a free-text drug name; missing presentations must follow the governed Pharmacy/content catalog workflow.

If one search source fails but another returns medications, the UI keeps the usable results and shows a partial-results warning without exposing backend details. Persistence errors are normalized to a safe user-facing message; field validation objects are not written to the browser console.

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

For outpatient prescriptions, the form visibly marks and validates the treatment duration, duration unit, dispense quantity and unit, number of refills, and configured indication. It follows the backend quantity policy and uses OpenMRS's safe required default while that policy is loading or unavailable, so a clinical role does not need broad global-property privileges and the fields do not become mandatory after the clinician starts entering a prescription. The duration selector is limited by `outpatientDurationUnitUuids` (days, weeks, and months by default); other backend duration units remain available outside the outpatient quantity workflow, and legacy values remain visible while an existing order is edited. New outpatient prescriptions use structured dose, unit, route, and frequency fields; free-text dosage remains available outside this workflow and when editing a legacy free-text order. When the selected drug's dosage form exactly matches a configured dosing or dispensing unit, that unit is proposed without overwriting a clinician's selection. A reason is required whenever the medication is marked for as-needed use; route and frequency are never inferred.
