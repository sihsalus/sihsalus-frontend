# CRED NTS 238 gap analysis

Fecha de revision: 2026-05-18

Fuente normativa principal:

- MINSA gob.pe: https://www.gob.pe/institucion/minsa/informes-publicaciones/7857089-norma-tecnica-de-salud-para-el-control-de-crecimiento-y-desarrollo-del-nino-nts-n-238-minsa-dgiesp-2025
- PDF oficial: https://cdn.www.gob.pe/uploads/document/file/9598727/7857089-norma-cred-12-03-26.pdf?v=1773347457

## Resumen

La norma vigente para CRED es la NTS N. 238-MINSA/DGIESP-2025, aprobada por R.M. 682-2025/MINSA. Reemplaza el enfoque anterior centrado en menores de 5 anios y extiende el control hasta los 11 anios, 11 meses y 29 dias.

El modulo `esm-crecimiento-desarrollo-app` ya tiene buena base de UI y configuracion: dashboard CRED, agenda, matriz de controles, selector de formularios, crecimiento, inmunizaciones, anemia, suplementacion, nutricion, estimulacion temprana y Test Peruano. La brecha principal esta en la alineacion normativa del flujo completo: calendario, actividades por edad cronologica, tamizajes EDI/TEA/salud mental, seguimiento, visita domiciliaria, referencia/interconsulta y registro estructurado.

## Hallazgos principales

| Area | Estado | Brecha |
|---|---|---|
| Calendario CRED | Parcial | El codigo estaba basado en NTS 137 y 33 controles. NTS 238 programa 27 controles: 3 RN, 7 menores de 1 anio, 4 de 1 anio, 2 por anio de 2 a 4 anios, y 1 anual de 5 a 11 anios. |
| Cobertura por edad | Parcial | La UI muestra hasta 11 anios, pero el calendario tenia un control de 12 anios que excede la norma. |
| Selector de formularios | Riesgoso | `formsList` contiene strings, pero `useCREDFormsForAgeGroup` los trataba como objetos `Form`. Esto puede generar objetos invalidos. |
| Actividades por edad cronologica | Parcial | Hay formularios por grupo etario, pero no existe matriz normativa completa por control/edad. |
| Valoracion | Parcial | Hay antropometria, desarrollo y algunos antecedentes, pero faltan formularios estructurados para riesgo/proteccion, examen fisico integral, salud oral, vision, audicion, exposicion a metales, sospecha de cancer y violencia/disciplina. |
| Desarrollo infantil | Parcial | Hay Test Peruano, EEDP/TEPSI y placeholder EDI. La norma prioriza EDI y vigilancia por edad cronologica. |
| TEA | Parcial bajo | Existe `autismScreeningForm`, pero falta integracion obligatoria a los 24 meses y por riesgo. |
| Salud mental y psicosocial | Parcial bajo | Existe `childMentalHealthForm`, pero falta cubrir PHQ-9, AUDIT-C, violencia a madre de menor de 5 anios y listas pediatricas segun edad. |
| Intervencion y consejeria | Parcial | Hay consejeria, pero falta registrar acuerdos, compromisos, practicas priorizadas y seguimiento. |
| Seguimiento | Bajo | Falta modelo para seguimiento fijo, visita domiciliaria, ATD priorizada, referencia/interconsulta y continuidad por hallazgos. |

## Plan de implementacion

Estado actual del plan:

1. Calendario CRED NTS 238: implementado en `cred-schedule-rules.ts` y cubierto por `cred-schedule-rules.test.ts`.
2. Selector de formularios CRED: corregido en `useCREDFormsForAgeGroup`, que construye objetos `Form` validos desde keys de `formsList`.
3. `formsList` y `CREDFormsByAgeGroup`: ampliados con placeholders normativos configurables; falta validar que esos forms existan en content/QLTY.
4. Pendiente: conectar formularios reales del backend para los placeholders normativos antes de exponerlos como flujo productivo.
5. Pendiente: crear una matriz normativa central reutilizable que no solo liste formularios, sino actividades obligatorias por edad.
6. Pendiente: agregar reglas de seguimiento: malnutricion, anemia, rezago/riesgo de desarrollo, TEA, violencia, prematuridad, bajo peso y ausencia a citas.

## No cubierto aun

- Validacion real contra formularios existentes en QLTY.
- Creacion de formularios backend faltantes.
- Reglas automaticas de derivacion/interconsulta.
- Visita domiciliaria y seguimiento movil.
- Registro estructurado de acuerdos de consejeria y compromisos familiares.
- Matriz clinica completa del Anexo 18.
