![Node.js CI](https://github.com/openmrs/openmrs-esm-template-app/workflows/Node.js%20CI/badge.svg)

# System Administration

The `System Administration` frontend module renders a page with a number of cards that link to different pages or applications outside the main EMR. These include the following:

- Legacy System administration (`/openmrs/admin` on the configured backend)
- [Form builder](https://github.com/openmrs/openmrs-esm-form-builder)
- [Open Concept Lab (OCL) module](https://github.com/openmrs/openmrs-esm-admin-tools/tree/main/packages/esm-admin-openconceptlab-app)

It can be accessed by clicking on the `System Administration` link in the app switcher menu. It exposes an [ExtensionSlot](https://o3-docs.vercel.app/docs/extension-system) that can be used to add more cards to the page. To add a card from a different module, add an extension definition to the entry point of that module. For example, to add a card from the `medication-dispensing` module, you would add the following extension definition to its entry point in `src/index.ts`:

```ts
// index.ts
extensions: [
  {
    id: "medication-dispensing-card-link",
    slot: "system-admin-page-card-link-slot",
    load: getAsyncLifecycle(
      () => import("./medication-dispensing-card-link.component"),
      options
    ),
    online: true,
    offline: true,
  },
]
