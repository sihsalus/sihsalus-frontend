# esm-patient-vitals-app

The vitals widget. It provides tabular and chart-based overviews of the vitals recorded for a patient as well as a form for recording vitals and biometrics. It also provides a vitals header that displays a summary of the most recently recorded vitals.

## Validación segura de valores clínicos

El formulario propio de signos vitales aplica dos capas distintas:

1. Los rangos absolutos y personalizados configurados en los conceptos OpenMRS se usan como rangos de referencia. Un valor fuera de ellos genera una advertencia y requiere una segunda confirmación, porque un valor extremo puede ser clínicamente real.
2. Los límites de seguridad de entrada bloquean valores incompatibles con la unidad o claramente imposibles. Una segunda confirmación no permite omitir este bloqueo.

Los límites de seguridad son deliberadamente amplios y no representan normalidad, diagnóstico ni umbrales de tratamiento:

| Campo | Unidad asumida | Límite de entrada inclusivo |
| --- | --- | --- |
| Temperatura | °C | 1–60 |
| Presión arterial sistólica | mmHg | 0–500 |
| Presión arterial diastólica | mmHg | 0–500 |
| Pulso | latidos/min | 0–500 |
| Frecuencia respiratoria | respiraciones/min | 0–300 |
| SpO₂ | % | 0–100 |

Supuestos de diseño:

- Las unidades son las de los conceptos clínicos base configurados por SIHSALUS. Un cambio de unidad exige conversión explícita; no se deben reinterpretar estos números silenciosamente.
- Se acepta cero en presión, pulso, frecuencia respiratoria y SpO₂ porque puede expresar ausencia de señal o actividad en un contexto de reanimación. Temperatura no usa cero como valor centinela: si no existe una medición se deja vacía; el mínimo 1 °C conserva un margen amplio por debajo de casos publicados de hipotermia inducida.
- Se conservan extremos raros: por ejemplo, una hipotermia profunda o una PA superior al rango absoluto local se puede registrar tras advertencia mientras permanezca dentro de la envolvente de seguridad.
- Los metadatos de conceptos pueden hacer más sensible la advertencia, pero no ampliar estos límites duros.
- Esta validación frontend es defensa en profundidad. El backend debe aplicar el mismo contrato para cubrir API, importaciones y otros clientes.

La SpO₂ se modela como porcentaje y por definición no puede superar 100; la [FDA describe la SpO₂ como porcentaje y advierte que valores bajos pueden ser clínicamente reales](https://www.fda.gov/consumers/consumer-updates/pulse-oximeter-basics). El límite amplio de temperatura evita descartar hipotermias excepcionales; existen reportes de supervivencia con temperaturas centrales de 4.2 °C bajo hipotermia inducida ([PubMed 32482520](https://pubmed.ncbi.nlm.nih.gov/32482520/)). Los máximos 500 para presión/pulso y 300 para frecuencia respiratoria son envolventes locales conservadoras contra errores de unidad o dígito, no límites clínicos: por eso valores superiores a los absolutos usuales de OpenMRS, como PA 300/180 o pulso 250, siguen siendo confirmables. Estos topes deben someterse a la gobernanza clínica local antes de estrecharse.
