# esm-patient-tests-app

Functionality for viewing test results and ordering tests, whether lab tests, radiology, or otherwise.

Creating or editing a test order requires an active clinical Provider linked to the current session. The order UI must fail closed and must not construct an order with a missing orderer.

Orderable tests are searched by their display name and concept names. `testTypeSearchAliases` provides a configurable compatibility fallback keyed by concept UUID. The default retains `TGP` for the existing alanine transferase concept and adds it to the two ALT IFCC variants, with and without pyridoxal phosphate. Each variant keeps its own UUID and backend label; the alias does not substitute one method for another or add concepts absent from the loaded orderable sets. An empty configured alias map disables the fallback. The same synonym must still be published in OCL so this local fallback can eventually be removed.

The hook regression tests cover the legacy alias, each IFCC variant, distinct choices, missing concepts, and disabled aliases. Before rollout, coordinate clinical/content review and a synthetic DEV/QLTY smoke that searches for TGP, checks the method shown, and verifies the selected concept in the saved order. Metadata existence, typechecking, and local tests alone do not establish orderability against deployed content.

### Search by concepts and synonyms

The order picker searches the names/synonyms imported into OpenMRS for the configured orderable concept sets. It ignores accents, letter case, repeated whitespace, word order and grammatical connectors, and supports word prefixes of at least five letters. Short tokens, numeric codes and Roman numerals require exact matches, so `C` cannot match `anticuerpos`, `con` cannot match `concentracion`, and `directa` cannot match `indirecta`. A match must come from one catalog name or configured alias; it does not combine unrelated synonyms or infer equivalence from OCL mappings. Duplicate UUIDs across groups appear once with their combined names; different methods and panels retain their own UUIDs and full labels.

If no catalog-name match exists, a single spelling error in a long alphabetic word can produce a clearly labeled suggestion. Short codes, numbers and method markers are not typo-corrected. Suggestions require opening the order form; neither direct addition nor bulk addition is available for them. The existing Provider, order permissions and order submission contracts are unchanged.

Read-only OCL metadata verification on 2026-09-07 confirmed [SIHSALUS/laboratorio/1300](https://app.openconceptlab.org/#/orgs/SIHSALUS/sources/laboratorio/concepts/1300/) (`9a9c73d0-76e6-4b84-b20c-dfe8efea9542`): “Prueba de hematocrito”, “Hematocrit”, “Hct”, “Hto”, “PCV”, “Packed cell volume” and “Crit”. “Recuento de hematocrito” was not one of its names. The procedures catalog also contains hematocrit and blood-count panels; these are not substituted for the laboratory concept. Tests use the verified names as metadata fixtures, not as new configuration defaults or proof of deployed orderability.

The local content bundle `laboratorio/2026-07-10-02` also contains these names and a direct `CONCEPT-SET` mapping from the configured Tests Orderability root (`4318`) to hematocrit (`1300`). This verifies the bundled relationship, not that DEV/QLTY has successfully imported that version.

OCL is the terminology source, not a runtime browser dependency: this change adds no OCL token, direct OCL calls, catalog writes or new synonyms. Newly published synonyms must be imported into OpenMRS and included in an orderable set before the picker can use them. Validate search by name/synonym, selected UUID, method/panel distinction and loading/error states locally; confirm actual orderability and save/reload with a synthetic patient and an authorized clinical Provider in coordinated DEV/QLTY before release.

## Test Results

It provides tabular and chart-based overviews of the test results available for a patient.

The reusable recent-results card is registered in `consulta-externa-pruebas-complementarias-slot` for the **Pruebas complementarias** tab in Consulta Externa. The host passes the active `patientUuid`; the extension keeps its FHIR loading, empty state, and navigation to the complete Results dashboard. This Consulta Externa registration requires `app:hoja.clinica.resultados` and remains read-only.

IMPORTANT NOTE: To have data show up in this view, your concepts just need to have "Type: Test" or "Type: LabSet".
If you are seeing strange things showing up, like Temperature, in the Test Results viewer, then you probably just need to change the Type for your Temperature concept to something other than "Test", such as "Finding."

## How to Configure the Lab Filter View

The Lab Filter feature enables you to set up custom filter views - eg based on standard medical hierarchies, or even based on your own custom concepts (e.g. "Our Favorite HIV-Related Tests"), like this:

<img width="300" alt="image" src="https://user-images.githubusercontent.com/67400059/161005725-18b38112-d2bd-4ae1-8a01-f797cb69aa57.png">

To configure your own Lab Filters, you need to use Labs, LabSets, and ConvSets (Convenience Sets) in your Concept Dictionary.
Below, we will walk through the steps taken to set up [**this OpenMRS Example Lab Filter**](https://app.openconceptlab.org/#/orgs/openmrs/collections/ExampleLabFilter/).

### 1. Decide what you want

In this example, we wanted a layout like:

- Bloodwork
  - Hematology
    - CBC
      - Lymphocytes (%)
      - Neutrophils (%)
      - Hemoglobin
      - Mean corpuscular volume (MCV)
      - Hematocrit
      - Red blood cells
      - Platelets
      - White blood cells
  - Chemistry
    - Serum Electrolytes
      - Serum calcium
      - Serum carbon dioxide
      - Serum chloride
      - Serum potassium
      - Serum sodium

### 2. Create the "parents" as concepts with type = ConvSet

- Bloodwork --> Create as a custom concept, type = ConvSet
  - Hematology --> Create as a custom concept, type = ConvSet
  - Chemistry --> Create as a custom concept, type = ConvSet

### 3. Add the "children" Set Members to each parent

- Bloodwork
  - Hematology --> Add concept as a Set Member to "Bloodwork"
    - CBC --> Add concept as a Set Member to "Hematology"
  - Chemistry --> Add concept as a Set Member to "Bloodwork"
    - Serum Electrolytes --> Add concept as a Set Member to "Chemistry"

_Note1: As of March 2022, Set Members cannot be added to concepts through the Term Browser, but you can either use your EMR directly or the OpenMRS Dictionary Manager._

_Note2: if you don't already have all the "children" concepts, e.g. CBC, Serum Electrolytes, you may have to add these specifically into your dictionary first._

### 4. Check your work

Review your concepts to see that the hierarchy all looks right in the Dictionary/Collection. In the above example (which was created using the OpenMRS Dictionary Manager), you can see that _Bloodwork_ now correctly contains _Hematology_ and _Chemistry_.

<img width="1173" alt="image" src="https://user-images.githubusercontent.com/67400059/161008455-edbd31d1-00ca-4236-9309-bc41763a6f0a.png">

### 5. Update the config-schema file with your ConvSet codes

Go here to add the UUIDs for each of your ConvSet concepts which you want to show up in the Lab Results filters:
<https://github.com/openmrs/openmrs-esm-patient-chart/blob/master/packages/esm-patient-tests-app/src/config-schema.ts#L3>
