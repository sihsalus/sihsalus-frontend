# openmrs-esm-api

openmrs-esm-api exports low-level functions that interact with the OpenMRS API.

See the [Retrieving and posting data](https://o3-docs.openmrs.org/docs/recipes/retrieve-and-post-data)
page of the Developer Documentation.

## Evaluación de privilegios

`userHasAccess` acepta un nombre o un arreglo de nombres. Un arreglo tiene semántica AND: el usuario debe poseer todos los privilegios. Los nombres son case-sensitive y no existe herencia automática; por ejemplo, un privilegio `.editar` no concede su privilegio padre.

Además de una coincidencia exacta, SIH Salus admite pares bidireccionales explícitos de nombres actuales y heredados definidos en `src/legacy-privilege-aliases.ts`. La equivalencia:

- solo aplica al par declarado;
- no es transitiva ni relaciona privilegios de dominios distintos;
- permite que bases OpenMRS existentes con nombres inmutables funcionen durante la migración;
- no debe usarse como sustituto de actualizar content y roles.

Los aliases actuales incluyen las capacidades de finalización de citas para Home y hoja clínica. Ya no se ofrece equivalencia heredada para las capacidades retiradas de edición de acciones offline, resultados, seguimiento de casos en chart, tamizajes ni edición genérica de Home; una coincidencia exacta con un nombre todavía usado sigue comportándose como cualquier otro privilegio.

Los roles `System Developer` y `Application: Has Super User Privileges` omiten la comprobación normal. Las pruebas funcionales de RBAC deben usar roles operativos de privilegio mínimo, no esos bypasses.
