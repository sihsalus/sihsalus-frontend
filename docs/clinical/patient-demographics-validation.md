# Validación de fecha de nacimiento y edad

Estado: vigente
Última revisión: 2026-07-13
Ámbito: búsqueda de pacientes, registro principal, registro rápido de emergencia, importación masiva y creación de personas responsables.

## Decisión

La fecha de nacimiento se trata como una **fecha calendario**, no como un instante. El límite operativo es el que impone OpenMRS Core: la fecha no puede estar en el futuro ni ser anterior a la fecha calendario de hoy menos 140 años.

La fuente de verdad del frontend es `packages/libs/esm-utils/src/patient-demographics.ts`. Ningún flujo debe volver a declarar por su cuenta los límites de día, mes, año o edad.

## Fundamento

- La NTS N.° 139-MINSA/2018/DGAIN exige registrar tanto edad como fecha de nacimiento entre los datos generales de la historia clínica. Véanse las páginas 18 a 21 de la [Norma Técnica de Salud para la Gestión de la Historia Clínica](https://portal.insnsb.gob.pe/docs-trans/resoluciones/rd-ra/RM2018/R.M_214-2018-MINSA-Aprobar-la-NTS-139-MINSA-2018-DGAIN.pdf).
- FHIR define `Patient.birthDate` con el tipo primitivo `date`, no `dateTime`: [HL7 FHIR Patient](https://hl7.org/fhir/R4B/patient.html).
- El tipo FHIR `date` admite `YYYY`, `YYYY-MM` o `YYYY-MM-DD`, exige fechas reales y no admite desplazamiento de zona horaria: [HL7 FHIR Datatypes](https://fhir.hl7.org/fhir/datatypes.html#date).
- OpenMRS Core rechaza fechas futuras y fechas anteriores a 140 años: [OpenMRS `PersonValidator`](https://github.com/openmrs/openmrs-core/blob/master/api/src/main/java/org/openmrs/validator/PersonValidator.java).
- OpenMRS calcula la edad comparando año, mes y día del cumpleaños, es decir, en años cumplidos: [OpenMRS `Person#getAge`](https://github.com/openmrs/openmrs-core/blob/master/api/src/main/java/org/openmrs/Person.java).
- OpenMRS conserva una fecha y el indicador `birthdateEstimated` cuando la fecha es aproximada: [OpenMRS Approximate Date Support](https://openmrs.atlassian.net/wiki/display/RES/Approximate%2BDate%2BSupport).

El valor de 140 años es una restricción de compatibilidad con el backend, no una afirmación biológica ni una regla derivada de MINSA. La configuración puede reducir el intervalo de edad de una búsqueda concreta, pero nunca ampliarlo más allá de lo que acepta OpenMRS.

## Reglas obligatorias

### Fecha exacta

- Formato canónico: `YYYY-MM-DD`.
- Día: entero de 1 a 31, sujeto a la cantidad real de días del mes y a años bisiestos.
- Mes: entero de 1 a 12.
- Año: desde el año de la fecha mínima aceptada hasta el año actual.
- La fecha completa debe existir, no estar en el futuro y no ser anterior a `hoy - 140 años`.
- Una cadena de OpenMRS como `2019-09-25T00:00:00.000+0000` se compara como `2019-09-25`. No se convierte con `new Date(string)` para extraer día, mes o año; en Perú esa conversión puede desplazarla al día anterior.

### Edad

- Es un entero en años cumplidos.
- El intervalo soportado es de 0 a 140 años, ambos inclusive.
- `0` es una edad válida para un recién nacido.
- La ausencia se representa con `null` o `undefined`, nunca con `0` ni con una cadena numérica centinela.
- No se aceptan decimales, signos, notación científica, `Infinity` ni `NaN`.

### Fecha estimada

- Una edad aproximada se transforma en una fecha calendario válida y se guarda con `birthdateEstimated: true`.
- El cálculo resta años y meses sobre el calendario y ajusta el día al último día válido del mes de destino.
- Cuando el formulario separa años y meses, los meses son un remanente entero de 0 a 11; 140 años solo admite 0 meses adicionales.
- La edad estimada `0` genera la fecha de referencia de hoy; la edad `140` genera exactamente el límite aceptado por OpenMRS.
- Si una implementación usa un día o mes fijo como fecha proxy, la configuración debe ser válida y el resultado se limita al intervalo aceptado.

### Búsqueda por partes

Los campos de día, mes y año son criterios opcionales e independientes. Una combinación parcial solo es válida si existe por lo menos una fecha exacta compatible dentro del intervalo aceptado.

Ejemplos con fecha de referencia 2026-07-13:

| Criterio | Resultado | Motivo |
| --- | --- | --- |
| sin día, mes ni año | válido | no se aplica filtro de nacimiento |
| día 29, mes 2 | válido | existe al menos un año bisiesto compatible |
| día 31, mes 4 | inválido | abril nunca tiene 31 días |
| mes 8, año 2026 | inválido | todo el mes está en el futuro |
| mes 6, año 1886 | inválido | todo el mes está antes del límite de 140 años |
| año 1886 | válido | existen fechas desde el 13 de julio en adelante |

## Capas de validación

1. El componente restringe el formato y declara `min`/`max` para accesibilidad y teclados numéricos.
2. El esquema del formulario impide aplicar o enviar datos inválidos.
3. Las utilidades compartidas resuelven calendario, límites y edad sin depender de la librería del formulario.
4. OpenMRS Core sigue siendo la última barrera de integridad.

El estándar del proyecto no es una única librería de esquemas:

- búsqueda avanzada y emergencia usan Zod porque sus formularios ya usan React Hook Form;
- registro principal conserva Yup porque el formulario existente usa Formik;
- ambos deben delegar las reglas de dominio a `@openmrs/esm-utils`.

Migrar Yup a Zod no forma parte de esta corrección y no es necesario para obtener reglas consistentes.

## Cobertura mínima de pruebas

Todo cambio futuro debe cubrir como mínimo:

- día 31 en un mes de 30 días;
- 29 de febrero en año bisiesto y no bisiesto;
- mañana y hoy;
- fecha exacta `hoy - 140 años` y el día anterior;
- edad vacía, 0, 140 y 141;
- edad estimada con años o meses decimales, 12 meses remanentes y 140 años más un mes;
- notación científica y decimales;
- criterios parciales sin fecha posible;
- una fecha OpenMRS a medianoche UTC bajo la zona horaria de Perú;
- coherencia entre registro individual, emergencia e importación masiva.
