# esm-patient-search-app

App para búsqueda de pacientes y selección contextual.

Terminología de dominio: visita = consulta, encounter = atención, appointment = cita.

## Marco normativo
- Ley N.° 29733, Ley de Protección de Datos Personales (Perú).

## Límites funcionales
- Proporciona búsqueda compacta, overlay y página de resultados.
- Facilita la selección de paciente para otros módulos del portal.
- No crea ni modifica el registro del paciente.
- No reemplaza módulos de admisión, listas o atención clínica.
- No debe depender de DNI, teléfono o código postal como pivotes principales para encontrar pacientes.

## Búsqueda avanzada e identidad

La búsqueda avanzada debe priorizar datos que sirven para confirmar identidad o ubicar una atención real:

- identificadores clínicos/administrativos y código temporal,
- nombre,
- sexo,
- edad exacta expresada en días, meses o años,
- existencia de una consulta activa,
- estado de verificación de identidad,
- estado de identificación en admisión.

El texto principal admite nombre o cualquier identificador/documento, por lo que no se duplican filtros separados de tipo y número de documento. La consulta se ejecuta desde 3 caracteres y se limita a 100 tanto en la cabecera como en la página completa.

Para evitar unidades ambiguas, la edad se captura como número más unidad: días (0–27), meses (0–23) o años (0–140, respetando los límites configurados). El filtro de consulta activa contrasta los resultados con las visitas actualmente activas de OpenMRS.

Los resultados se muestran de 10 en 10. Cada cambio de página devuelve el foco visual al inicio de los resultados para no dejar al usuario al final de la lista anterior.

`zipcode`, `postcode`, código postal y teléfono no se muestran como filtros avanzados por defecto. Son datos débiles para admisión/emergencia: pueden faltar, estar desactualizados, pertenecer a un responsable o generar falsos positivos. Solo deben habilitarse por configuración local si hay un caso administrativo específico.

El filtro de atributos textuales usa coincidencia parcial para facilitar búsquedas operativas, por ejemplo `SAMU` encuentra `SAMU Loreto`.

## Integraciones
- API de búsqueda y datos básicos del paciente.
- Componentes compactos, overlays y extensiones del buscador.
- Contexto compartido para interoperar con otros flujos del frontend.
- Person attributes definidos en `sihsalus-content` para pacientes no identificados y responsable.

## Metadata esperada

| Uso | Person attribute type |
| --- | --- |
| Estado de verificación civil | `Estado de Verificación de Identidad` |
| Estado administrativo de identificación | `Estado de Identificación en Admisión` |

Si alguno de estos person attribute types no existe en el backend objetivo, el filtro se oculta para no bloquear ni ensuciar la búsqueda.
