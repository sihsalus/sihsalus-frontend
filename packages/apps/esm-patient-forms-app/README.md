# esm-patient-forms-app

The forms widget. It provides a tabular overview of the clinical forms available for use in the system. Presently, the forms widget is configured to use forms built using the AMPATH form engine. Read the docs [here](https://ampath-forms.vercel.app).

Queued encounter and person updates are synchronized only for the queue owner's authenticated session. Every clinical
write receives the queue synchronization abort signal so logout, account change, or explicit cancellation prevents
later requests from starting. An interrupted or failed item remains pending for review and retry.
