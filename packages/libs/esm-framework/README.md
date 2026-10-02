# openmrs-esm-framework

`openmrs-esm-framework` aggregates all the core libraries for the OpenMRS 3.0 MF app in one package.

The [public entry point](src/index.ts) lists the core library exports aggregated
by this package. Use the [module documentation index](../../../docs/modules.md)
to find the contracts and configuration of each underlying library.

## Local notification extension contract

The local SIHSALUS fork exports the type-only `NotificationInboxItem` and
`NotificationDetailState` contracts. These add no runtime service or dependency.
A generic header hosts `notification-inbox-detail-slot`; a domain module registers
its detail extension with a unique `meta.notificationType` and its normal
privileges. State provides the authorized notification, session cache identity,
`markRead()` and `back()`. Each domain component must guard its own permissions,
load authoritative resource details and handle acknowledgement failure. Marking a
notification read is separate from clinical review or approval. Primary-navigation
and laboratory are the current consumers; existing extension integration tests
and both consumers' typechecks/regressions must pass when this contract changes.
