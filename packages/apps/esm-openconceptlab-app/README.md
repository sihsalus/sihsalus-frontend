![Node.js CI](https://github.com/openmrs/openmrs-esm-template-app/workflows/Node.js%20CI/badge.svg)

# OCL Subscription Module

The `esm-admin-openconceptlab-app` is a package that provides the capability to manage openmrs concepts easily through an Open Concept Lab dictionary subscription. The package supports the following functionalities:

- Adding, removing or editing an OCL subscription
- Import concepts through the OCL subscription
- View detailed overview of an selected import

Both the administration card and the direct `/ocl` page require the backend `Manage Concepts` privilege. OCL imports update concept dictionary content; they do not create the OpenMRS Drug records required for orderable medication presentations. Imports must use reviewed released content and must not be started during clinical data-entry hours.
