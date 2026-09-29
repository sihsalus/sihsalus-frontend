# Zod 4 form validation

Zod 4 must be paired with `@hookform/resolvers` 5.2.2 or a compatible later
5.x version. Resolver 3 checks an error property removed by Zod 4: invalid
forms can reject their submission promise instead of displaying field errors.
Workspaces using these packages must declare their dependencies directly.

## Form contracts

- Derive form types from the schema. A form editing part of an order or resource
  is not the complete persisted object. Merge validated fields with the original
  resource when preparing its existing payload.
- When defaults or preprocessing change the shape, use
  `useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>`. Do not
  suppress mismatches by casting the resolver, enabling its raw mode, or
  weakening required fields.
- Pass the concrete form type through reusable controls. Controller fields can
  also be passed as the particular properties a child needs; they do not need
  access to the entire form.
- Zod 4 uses `error` instead of `required_error`, `invalid_type_error`, and
  `errorMap`. Preserve translated required/invalid messages and existing limits.
  Defaults, coercion and refinements still need behavioral tests.
- A resolver failure returns empty `values` and field `errors`. Custom clinical
  checks must follow that contract as well.
- Stock operation drafts can omit fields that will be completed later, or that
  do not apply to that operation. The operation-specific schema remains the
  submission gate: receipt batch/date, selected batches, packaging units and
  quantity restrictions must still be enforced.

## Migration evidence and review

The dependency migration includes medication identity/metadata tests and stock
resolver regressions covering incomplete receipts, coercion, operation-specific
batch requirements, requisitions and negative adjustments. Existing workspace
suites cover clinical defaults, required fields and submission behavior. Run the
full repository verification because a resolver upgrade affects its consumers
beyond the first workspace reporting a type error.

Local tests do not establish backend or clinical compatibility. Before merging,
record synthetic DEV/QLTY smoke evidence for the affected workflows and the exact
candidate SHA. Keep the PR in draft if authentication or clinical acceptance is
unavailable. No data migration or deployment is part of a dependency PR.
