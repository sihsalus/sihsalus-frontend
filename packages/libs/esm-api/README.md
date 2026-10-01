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

La configuración admite un nombre o un arreglo de nombres. Un valor mal formado
se deniega, también para roles de superusuario. Se mantienen los contratos
existentes para `undefined`, cadena vacía y arreglo vacío; la autorización del
backend sigue siendo obligatoria.

## Respuestas de sesión

El fork de SIH Salus conserva únicamente la respuesta de la solicitud de sesión
más reciente. Cerrar sesión invalida las respuestas pendientes: una consulta o
selección de ubicación anterior no puede restaurar el actor ni la ubicación
previos. Los errores de solicitudes reemplazadas tampoco borran una sesión más
nueva. Esas promesas devuelven el estado vigente, sin volver a publicar el anterior.
Las consultas de sesión usan `cache: 'no-store'` y las respuestas deben contener
un indicador `authenticated` booleano.

Las regresiones de `current-user.test.ts` cubren respuestas fuera de orden,
cierre de sesión, ubicación, errores tardíos y cuerpos inválidos con datos
sintéticos. Estos cambios afectan a consumidores de la sesión compartida,
incluidos login, navegación y guards de permisos. No sustituyen la invalidación
de sesión del servidor ni la validación por rol en DEV/QLTY.
