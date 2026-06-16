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
- fecha de nacimiento o edad aproximada,
- marcador `Paciente No Identificado`,
- nombre del responsable o acompañante,
- parentesco/vínculo del responsable.

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
| Paciente no identificado | `Paciente No Identificado` |
| Responsable/acompañante | `Nombre del Acompañante` |
| Vínculo del responsable | `Parentesco del Acompañante` |

El filtro `Estado de identificación` queda pendiente hasta que el attribute type correspondiente exista en el backend objetivo.
