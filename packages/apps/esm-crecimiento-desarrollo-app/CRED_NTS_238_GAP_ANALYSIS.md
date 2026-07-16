# CRED NTS 238 gap analysis

Fecha de revision: 2026-07-14

Fuente normativa principal:

- MINSA gob.pe: https://www.gob.pe/institucion/minsa/informes-publicaciones/7857089-norma-tecnica-de-salud-para-el-control-de-crecimiento-y-desarrollo-del-nino-nts-n-238-minsa-dgiesp-2025
- PDF oficial: https://cdn.www.gob.pe/uploads/document/file/9598727/7857089-norma-cred-12-03-26.pdf?v=1773347457

## Resumen

La norma vigente para CRED es la NTS N. 238-MINSA/DGIESP-2025, aprobada por R.M. 682-2025/MINSA. Reemplaza el enfoque anterior centrado en menores de 5 anios y extiende el control hasta los 11 anios, 11 meses y 29 dias.

El modulo `esm-crecimiento-desarrollo-app` ya tiene una base normativa para calendario, numero real de control, agenda y actividades por edad cronologica. Las brechas principales quedan en la profundidad de los instrumentos EDI/TEA/salud mental, seguimiento, visita domiciliaria, referencia/interconsulta y registro estructurado.

## Hallazgos principales

| Area | Estado | Brecha |
|---|---|---|
| Calendario CRED | Implementado en frontend | Mantiene 27 edades ideales como referencia y calcula el siguiente control desde la ultima atencion real, con intervalos minimos, banda etaria y limite anterior al cumpleanos 12. |
| Cobertura por edad | Implementado en frontend | Las actividades se seleccionan por edad cronologica en la fecha real de atencion. |
| Selector de formularios | Implementado | Construye formularios validos y siempre abre un encuentro nuevo; el historial no se edita desde un control nuevo. |
| Actividades por edad cronologica | Implementado en frontend | La matriz central incluye cortes e instrumentos del Anexo 18. Persisten brechas en el contenido de varios formularios. |
| Valoracion | Parcial | Existen formularios para examen, crecimiento, salud oral, vision, audicion, metales, cancer y violencia; falta validar profundidad y persistencia en DEV. |
| Desarrollo infantil | Parcial por contenido | La UI vigente usa Huanca, EDI y habilidades. CRED-009, 026 y 027 solo registran resumen, no el instrumento completo. |
| TEA | Parcial por contenido | Se ofrece M-CHAT a los 24 meses y por riesgo de 18 a 30; CRED-010 no contiene las 20 preguntas ni el seguimiento R/F. |
| Salud mental y psicosocial | Parcial por contenido | La periodicidad esta en la matriz y CRED-011 identifica el instrumento principal, puntaje, resultado y violencia; faltan grupos repetibles e items oficiales. |
| Intervencion y consejeria | Parcial | Hay consejeria, pero falta registrar acuerdos, compromisos, practicas priorizadas y seguimiento. |
| Seguimiento | Bajo | Falta modelo para seguimiento fijo, visita domiciliaria, ATD priorizada, referencia/interconsulta y continuidad por hallazgos. |

## Estado de implementacion

Estado actual del plan:

1. Calendario CRED NTS 238: implementado con 27 controles ideales y una recomendacion operativa calculada desde el ultimo control real.
2. Selector de formularios: usa edad cronologica en la fecha real de atencion y siempre crea un encuentro nuevo.
3. Numero real de control: se calcula por controles registrados, no por la edad ideal seleccionada, y se detiene al completar 27.
4. Matriz central del Anexo 18: implementada en `cred-nts238-form-groups.ts` con EDI, Huanca, M-CHAT y habilidades.
5. Citas: solo se genera la siguiente cita real futura; el recurso rechaza fechas historicas y no encadena citas especulativas.
6. Seguridad clinica: anemia y desarrollo ya no se clasifican como normal con reglas incompletas; las curvas 0-5 no se muestran en escolares.
7. Contenido 1.16.3: corrige los resumenes CRED prioritarios y conserva como pendiente la digitalizacion item por item y la validacion E2E contra DEV.

## No cubierto aun

- Validacion E2E en DEV/QLTY del recalculo por intervalo, bloqueo temprano, cita siguiente y limites normativos.
- Digitalizacion item por item de EDI, M-CHAT-R/F, salud mental, Huanca y habilidades, ademas de retirar las referencias textuales legadas de CRED-003 y CRED-005.
- Reglas automaticas de derivacion/interconsulta.
- Visita domiciliaria y seguimiento movil.
- Registro estructurado de acuerdos de consejeria y compromisos familiares.
- Curvas OMS 5-19 para IMC/edad y talla/edad.

El detalle actualizado y los criterios de liberacion estan en
`docs/clinical/cred/NTS-238-AUDIT.md`.
