# Runbook: despliegue y go-live del frontend

**Última actualización:** 2026-10-13. Complementa el gate clínico
([issue #670](https://github.com/sihsalus/sihsalus-frontend/issues/670)); no lo reemplaza.

## 1. Revisión, publicación y despliegue

Un mantenedor revisa el diff final, sus decisiones, riesgos y evidencia, y
aprueba el PR/SHA y sus efectos de publicación. El [procedimiento de contribución](../../CONTRIBUTING.md#human-review-of-assisted-work)
exige aprobación separada para aplicar el resultado a un entorno.

Después del merge, CI y `release.yml` construyen y analizan la imagen inmutable,
y pueden actualizar `latest`/`next`. El resumen registra SHA y digest para
revisión; el release no envía señales de despliegue al distro.

La [revisión humana del distro](https://github.com/sihsalus/sihsalus/blob/main/docs/operations/human-review.md)
gobierna la siguiente operación:

- Para hosts con selección persistente de release, preparar los wrappers y
  [manifiestos](https://github.com/sihsalus/sihsalus/blob/main/docs/operations/release-manifests.md),
  evidencia y rollback antes de solicitar aprobación del checksum y nodo.
- La ruta individual `Deploy Frontend` solo admite ejecución manual con SHA y
  digest completos. Verifica las protecciones nativas de GitHub y espera la
  aprobación del job de cada environment. No tiene cron ni disparadores por tags.
  Los hosts con manifiestos rechazan esta ruta; no retirar su marcador.

Un agente no puede aprobar esos jobs con las credenciales del mantenedor,
considerar “yolo” como revisión ni presentar CI como aceptación clínica.

## 2. Verificación de un despliegue

DEV y QLTY no requieren OpenVPN. Comprobar HTTPS y SSH mediante `gidis-dev` y
`gidis-qlty` cuando la operación esté autorizada; verificar MAC y UUID del nodo
con el procedimiento existente.

```sh
curl -sk https://gidis-hsc-dev.inf.pucp.edu.pe/openmrs/spa/build-info.json
curl -sk https://gidis-hsc-qlty.inf.pucp.edu.pe/openmrs/spa/build-info.json
gh run list --workflow=release.yml --limit 3
gh run list -R sihsalus/sihsalus --limit 5
```

Seguir el [checklist vigente](https://github.com/sihsalus/sihsalus/blob/main/docs/operations/deploy-checklist.md):
identidad, imágenes, Initializer, salud, autenticación y aceptación clínica se
registran por separado. Comparar la revisión con el artefacto aprobado, no con
un `latest` que pueda haber cambiado después de la decisión.

## 3. Recuperación

Revisar y conservar antes del despliegue el manifiesto anterior, sus imágenes,
el respaldo y la señal que autoriza su recuperación. El rollback de manifiestos
usa la misma herramienta y selección completa; no restaura automáticamente la
base de datos ni revierte migraciones.

El script individual conserva su rollback acotado al frontend. No usarlo para
recuperar una instalación administrada por manifiestos. Seguir el procedimiento
nativo aprobado y registrar el resultado, incluso si la recuperación falla.

## 4. Fallos operativos

Ante falta de disco, errores SSH o un arranque fallido, registrar la evidencia
sin secretos y revisar el estado antes de reintentar. Una autorización de
frontend no permite borrar volúmenes, podar imágenes retenidas, desactivar
protecciones ni cambiar permisos o red para forzar el resultado. Preparar el
remedio concreto y solicitar aprobación cuando exceda el alcance revisado.
No hay reintentos de despliegue por cron.

## 5. Gate E2E autenticado (pendiente de primera ejecución)

El workflow `e2e.yml` tiene un preflight que exige 7 variables/secretos.
Configuración (una sola vez, con datos EXCLUSIVAMENTE sintéticos):

```sh
# Variables (Settings → Actions → Variables, o gh):
gh variable set E2E_BASE_URL --body "https://gidis-hsc-qlty.inf.pucp.edu.pe/openmrs/spa"
gh variable set E2E_API_BASE_URL --body "https://gidis-hsc-qlty.inf.pucp.edu.pe/openmrs"
gh variable set E2E_LOGIN_DEFAULT_LOCATION_UUID --body "<uuid UPSS de prueba>"
gh variable set E2E_PATIENT_UUID --body "<uuid paciente sintético>"
gh variable set E2E_APPOINTMENTS_PATIENT_UUID --body "<uuid paciente sintético con citas>"

# Secretos (cuenta E2E dedicada de privilegio mínimo, jamás personal):
gh secret set E2E_USER_ADMIN_USERNAME
gh secret set E2E_USER_ADMIN_PASSWORD
```

Ejecución: etiquetar un PR con `e2e`, o `gh workflow run e2e.yml`. La corrida
crea datos sintéticos en el ambiente apuntado — coordinarla, no lanzarla
contra un ambiente en validación clínica activa.

## 6. Checklist condensado de go-live (48 h)

- **Día 0:** congelar main (solo hotfixes) · fijar sha/digest candidato ·
  configurar variables E2E y correr el gate una vez contra QLTY ·
  registrar digest anterior para rollback.
- **Día 1:** matriz manual por rol del issue #670 sobre el MISMO digest ·
  en consulta externa probar explícitamente antecedentes (crear sin
  seleccionar → error visible; editar → muestra el nombre; texto libre →
  aparece en la lista; borrar en los 3 módulos) · ensayar el rollback una vez ·
  aceptar formalmente por escrito los P0 que no se cierran (auditoría
  server-side, TLS PROD), con responsable y plazo.
- **Día 2 (go-live):** desplegar en horario de baja carga · `df -h` previo en
  el host · una persona monitoreando red/consola la primera hora · canal
  directo de reporte del personal · FUA en papel como respaldo normativo.

**Criterio de NO-GO:** un P0 en login/UPSS, registro, citas/colas,
visita/encounter o SOAP/odontograma detectado por la matriz. Retrasar cuesta
menos que operar a ciegas.
