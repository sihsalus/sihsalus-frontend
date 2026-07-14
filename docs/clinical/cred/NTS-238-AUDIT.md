# Auditoria CRED frente a NTS 238

Fecha de revision: 2026-07-14

## Fuentes normativas

- NTS N. 238-MINSA/DGIESP-2025, aprobada por RM N. 682-2025/MINSA.
- NTS N. 213-MINSA/DGIESP-2024 para anemia, modificada por RM N. 429-2024/MINSA.
- PDF vigente conservado en
  `docs/clinical/test-peruano/pdf/current/nts-238-minsa-dgiesp-2025.pdf`.

Enlaces oficiales:

- https://www.gob.pe/institucion/minsa/informes-publicaciones/7857089-norma-tecnica-de-salud-para-el-control-de-crecimiento-y-desarrollo-del-nino-nts-n-238-minsa-dgiesp-2025
- https://www.gob.pe/institucion/minsa/normas-legales/7281593-682-2025-minsa
- https://www.gob.pe/institucion/minsa/normas-legales/5440166-251-2024-minsa
- https://www.gob.pe/institucion/minsa/normas-legales/5670414-429-2024-minsa

## Reglas verificadas

1. La poblacion CRED abarca desde el nacimiento hasta los 11 anos, 11 meses y 29 dias.
2. El calendario ideal contiene 27 controles: 3 neonatales, 7 durante el primer ano,
   4 durante el segundo ano de vida, 6 semestrales entre 2 y 4 anos y 7 anuales entre
   5 y 11 anos.
3. Las actividades se eligen por edad cronologica en la fecha real de atencion, no por
   el numero ni la fecha ideal del control. Si la primera consulta ocurre a los 6 meses,
   se registra como control real 1 y se realizan las actividades de 6 meses.
4. El riesgo identificado permite adelantar una prueba o intervencion, con sustento en
   la historia clinica.
5. Desarrollo: EDI a 1, 6, 9, 18, 30, 42 y 60 meses; vigilancia Huanca a 2, 3, 4,
   7, 12, 15, 21, 24 y 36 meses; lista de habilidades a 48 meses y anualmente de 6 a
   11 anos.
6. M-CHAT-R/F es universal a los 24 meses y puede aplicarse de 18 a 30 meses por riesgo.
7. Salud mental del cuidador corresponde a 1 y 12 meses y anualmente de 2 a 4 anos.
   El tamizaje del nino corresponde anualmente de 3 a 11 anos.
8. Descarte de parasitosis corresponde anualmente desde el ano de edad.
9. Vitamina A solo corresponde en zonas de riesgo: 100 000 UI a los 6 meses y 200 000 UI
   a 12, 18, 24, 30, 36, 42, 48 y 54 meses.
10. El examen fisico integral y las evaluaciones oral, visual, auditiva, neurologica,
    de cadera, cancer, metales y violencia forman parte de la evaluacion segun edad/riesgo.
11. La hemoglobina debe interpretarse con corte por edad y correccion por altitud cuando
    la residencia esta sobre 500 msnm. Entre 6 y 23 meses se controla al inicio, tercer mes
    y termino de la suplementacion; entre 24 y 59 meses, dos veces al ano; y entre 5 y 11
    anos, una vez al ano. Prematuros y ninos con bajo peso tienen un esquema particular.

## Estado del frontend

| Area | Estado | Evidencia o limite |
| --- | --- | --- |
| Seleccion por edad | Implementado | La fecha real de atencion alimenta `useCREDFormsForAgeGroup`; ya no se usa la fecha ideal atrasada. |
| Numero real de control | Implementado | Se calcula con controles registrados + 1 y se persiste en cada encuentro del control con `Número de control CRED` (`ce8b07e8-712f-406a-b44d-2fa69167f5ea`). |
| Encuentro nuevo | Implementado | El selector muestra historial, pero lanza formularios nuevos con `encounterUuid` vacio. |
| Matriz Anexo 18 | Implementado en frontend | Matriz central `cred-nts238-form-groups.ts`, con cortes de 42 y 54 meses e instrumentos vigentes. |
| Calendario | Implementado | 27 edades ideales con meses calendario y ventana neonatal; no usa aproximaciones de 365 dias. |
| Citas | Implementado | Solo se programan controles futuros y el recurso rechaza fechas pasadas. |
| Desarrollo vigente | Implementado con limites de contenido | Huanca, EDI, M-CHAT y habilidades sustituyen el acceso TEPSI como evaluaciones vigentes. |
| Codigo TEPSI simulado | Retirado | Se elimino el workspace sin persistencia; los identificadores legados quedan solo para lectura historica. |
| Anemia | Parcial seguro | El formulario 1.16.3 exige edad, altitud y clasificacion ajustada; el widget muestra Hb sin inventar diagnostico. Falta calcular Hb ajustada con conceptos especificos. |
| Crecimiento escolar | Bloqueado de forma segura | No se reutilizan curvas OMS 0-5 en escolares; faltan IMC/edad y talla/edad 5-19. |
| Tamizajes | Parcial seguro | El widget se presenta como historial, no como cumplimiento obligatorio por haber ocurrido alguna vez. |
| Persistencia DEV | Verificada | Se guardaron y editaron formularios CRED en un paciente sintetico; se conservaron fecha, visita, formulario y observaciones sin duplicar el encuentro editado. El concepto numerico de control y su lectura por encounter tambien se validaron. |

## Auditoria de contenido y conceptos

Se reviso el contenido publico `sihsalus/sihsalus-content` 1.16.3 en el merge commit
`1fe481da65b66e821f5064eed97a4339e8657fd4`. Los identificadores tecnicos de conceptos
de los formularios CRED-001 a CRED-028 resuelven en esa auditoria, pero esto no equivale
a conformidad clinica ni prueba su instalacion en DEV.

Estado luego de 1.16.3 y brechas que aun requieren terminologia o digitalizacion completa:

| Formulario | Brecha |
| --- | --- |
| CRED-001 anemia | Ya exige edad y altitud, cita NTS 213/RM 429 y elimina cortes fijos. Falta calcular y guardar factor de correccion y Hb ajustada. |
| CRED-003 y CRED-005 | Mantienen referencias textuales a NTS 137. |
| CRED-009 EDI | Exige edad y resumen auditable de los cinco ejes; no contiene cada item del instrumento oficial. |
| CRED-010 M-CHAT | Exige edad, puntaje y numeros de respuestas de riesgo; no contiene las 20 preguntas ni el seguimiento R/F. |
| CRED-011 salud mental | Identifica instrumento principal, puntaje, resultado, instrumentos adicionales y violencia; faltan grupos repetibles e items especificos de PHQ-9, AUDIT-C, PPSC y PSC-17. |
| CRED-015 crecimiento | Retira clasificaciones genericas ambiguas, calcula IMC y registra perimetro abdominal desde los 5 anos; faltan z-score y clasificaciones estructuradas por indicador. |
| CRED-026 Huanca | Exige las cinco areas y detalle de cada hito no logrado, pero no registra cada hito normativo. |
| CRED-027 habilidades | Exige edad, ausencias por area y factor de riesgo para decidir EDI/referencia, pero no registra cada habilidad de la lista por edad. |

Auditoria relacionada:
https://github.com/sihsalus/sihsalus-content/blob/1fe481da65b66e821f5064eed97a4339e8657fd4/docs/audits/2026-07-10-cred-nts238-forms.md

## Criterio de liberacion

No declarar CRED como totalmente conforme hasta completar lo siguiente:

1. Publicar la terminologia pendiente y completar los instrumentos que aun son resumenes auditables.
2. Confirmar en DEV los UUID/nombres publicados y la resolucion de todos los conceptos.
3. Probar E2E un control tardio: primer control a los 6 meses, formularios de 6 meses,
   control real 1 y encuentros nuevos sin modificar historia previa.
4. Probar la recurrencia de anemia, salud mental, parasitosis y tamizajes por edad/riesgo.
5. Incorporar referencias OMS 5-19 para IMC/edad y talla/edad antes de habilitar curvas escolares.
6. Validar la matriz y los formularios resumidos con el responsable clinico CRED del hospital.

El schema CRED duplicado en `esm-salud-materna-app` no tiene consumidores de runtime en
ese microfrontend. Se mantiene fuera de este cambio para no ampliar el contrato publico;
debe retirarse o apuntar a una configuracion compartida en una limpieza posterior.
