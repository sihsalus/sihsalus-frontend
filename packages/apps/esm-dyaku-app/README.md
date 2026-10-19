# Consulta e importación de pacientes Dyaku

Esta aplicación consulta recursos FHIR `Patient` de una fuente configurada y
permite importar sus datos demográficos a OpenMRS. **No implementa el intercambio
IPS, consentimiento RENHICE, firma digital ni acredita un SIHCE.** La
compatibilidad del formato de un paciente no autoriza su importación.

Antes de usarla contra una fuente real, el responsable institucional debe
confirmar la autorización y finalidad de esa transferencia. El flujo de visor
temporal descrito por MINSA en [consentimiento
RENHICE](https://dyaku.minsa.gob.pe/guides/InformedConsent.html) es diferente:
no debe usarse este importador para persistir o replicar los documentos IPS
recibidos mediante ese flujo.

El contrato técnico, límites y validación están en
[src/dyaku-patients/README.md](src/dyaku-patients/README.md). Los cambios de
integridad no modifican rutas, permisos, backend ni configuración de entornos.
