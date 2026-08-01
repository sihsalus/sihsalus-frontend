# esm-patient-vitals-app

The vitals widget. It provides tabular and chart-based overviews of the vitals recorded for a patient as well as a form for recording vitals and biometrics. It also provides a vitals header that displays a summary of the most recently recorded vitals.

## Validación segura de valores clínicos

El formulario propio de signos vitales aplica dos capas distintas y no confunde una advertencia clínica con un error de formato:

1. Los rangos absolutos o personalizados configurados en OpenMRS se usan como referencia. Un valor fuera de ellos puede ser clínicamente real: se muestra junto con su unidad y rango, y exige pulsar **Confirmar y guardar** en un diálogo separado.
2. Solo se bloquean invariantes inequívocas: valores no finitos o negativos, SpO₂ fuera de 0–100 %, una presión arterial incompleta y una sistólica menor que la diastólica. La confirmación no puede omitir estos bloqueos.

No se codifican máximos fisiológicos locales para temperatura, presión, pulso o frecuencia respiratoria. Esos umbrales requieren aprobación de gobernanza clínica y deben residir en los metadatos de conceptos, no como números arbitrarios en el frontend.

### Alcance y brechas pendientes

- Esta protección cubre este workspace de SIHSALUS. Los formularios renderizados por Form Engine/HTML Form Entry, clientes API, importaciones y procesos offline deben implementar el mismo contrato antes de considerarlo una validación integral.
- El backend debe validar el contrato y registrar tanto el valor como la confirmación/auditoría correspondiente; una validación frontend es solo defensa en profundidad.
- La unidad mostrada debe coincidir con la unidad del concepto configurado. Un cambio de unidad requiere migración o conversión explícita.
- La obligatoriedad en triaje/emergencia debe definirse por el flujo clínico aprobado; el indicador visual por sí solo no constituye una regla de guardado.
- Cero se conserva como un valor medido, no como centinela de “sin dato”. La ausencia de medición se representa dejando el campo vacío.

La SpO₂ se modela como porcentaje y por definición no puede superar 100; la [FDA describe la SpO₂ como porcentaje y advierte que valores bajos pueden ser clínicamente reales](https://www.fda.gov/consumers/consumer-updates/pulse-oximeter-basics). Esta referencia justifica la restricción de unidad, no umbrales diagnósticos ni decisiones de tratamiento.
