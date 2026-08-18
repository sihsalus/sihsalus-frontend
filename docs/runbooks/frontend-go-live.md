# Runbook: despliegue y go-live del frontend

**Última actualización:** 2026-08-17. Complementa al gate clínico
([issue #670](https://github.com/sihsalus/sihsalus-frontend/issues/670)) y a
`docs/audits/2026-07-27-production-readiness.md`; no los reemplaza.

## 1. Cadena de despliegue (cómo llega un merge a un ambiente)

```text
merge a main ──► CI (ci.yml) ──► release.yml (workflow_run)
                                   │  imagen inmutable + Trivy + promoción
                                   │  tag frontend-release-<sha40>
                                   ▼
                 sihsalus/sihsalus · workflow "Deploy Frontend"
                   ├─ dispara por: tag push, repository_dispatch
                   │  (frontend-published) y cron de drift cada ~5 min
                   ├─ resolve: verifica sha40 + digest sha256 contra GHCR
                   ├─ Deploy DEV ──► Deploy QLTY (SSH + deploy key;
                   │  guards de MAC/node-id del host; auto-rollback si falla)
                   └─ verificación externa: build-info.json == sha esperado
```

Notas operativas verificadas el 2026-08-17:

- Los pushes rápidos consecutivos **cancelan por supersesión** los CI de main
  intermedios; sus releases quedan `skipped`. Solo importa el CI del tip.
- El cron de drift puede **retrasarse bastante** bajo carga de GitHub; el
  estado converge solo, no relanzar en pánico.
- La concurrencia del deploy es un lock único (`deploy-frontend-non-production`):
  un rerun encolado detrás de un cron activo es redundante — cancelarlo para
  no reiniciar el contenedor dos veces con la misma imagen.

## 2. Verificación de un despliegue

```sh
# ¿Qué sirve cada ambiente? (comparar gitSha con el tip esperado)
curl -sk https://gidis-hsc-dev.inf.pucp.edu.pe/openmrs/spa/build-info.json
curl -sk https://gidis-hsc-qlty.inf.pucp.edu.pe/openmrs/spa/build-info.json

# Estado del pipeline
gh run list --workflow=release.yml --limit 3            # en sihsalus-frontend
gh run list -R sihsalus/sihsalus --limit 5              # Deploy Frontend
```

## 3. Rollback

El deploy remoto restaura la configuración anterior **automáticamente** si el
despliegue falla (verificado en vivo el 2026-08-17: QLTY siguió sirviendo la
imagen previa durante horas de fallos, sin corte).

Rollback manual a un SHA anterior conocido:

```sh
gh workflow run "Deploy Frontend" -R sihsalus/sihsalus \
  -f sha=<sha40-anterior> [-f digest=sha256:<64hex>]
```

Registrar SIEMPRE el sha/digest previo antes de promover uno nuevo
(criterio de salida del issue #670).

## 4. Incidentes conocidos y su tratamiento

### 4.1 Disco lleno en el host (2026-08-17, QLTY)

**Síntoma:** `failed to register layer: … no space left on device` en el job
Deploy; el cron reintenta en loop y falla igual. El servicio NO se cae
(rollback automático), pero el ambiente queda congelado en la imagen vieja.

**Diagnóstico y limpieza segura** (en el host, por SSH):

```sh
df -h / && docker system df
docker builder prune -f     # cache de builds: el culpable aquel día (98%→77%)
docker image prune -f       # solo capas huérfanas
# NUNCA docker system prune -a global en un host clínico (política del
# distro: scripts/deploy/deploy-frontend.sh ya poda scoped el frontend).
```

Tras liberar espacio no hay que hacer nada más: el cron de drift redespliega
solo. Prevención: chequeo de disco pre-deploy en el script remoto (propuesto
al distro) y prune periódico del builder como tarea operativa.

### 4.2 Timeout SSH desde los runners (2026-08-17, QLTY)

**Síntoma:** `ssh: connect to host … port 22: Connection timed out` repetido
desde el runner, con el host sano (SSH directo funciona y DEV conecta en el
mismo run). Causa probable: baneo puntual (fail2ban activo en el host) o
perímetro de red; cada run usa una IP de runner distinta.

**Tratamiento:** reintentar el run (IP nueva). Si falla en serie:
`sudo fail2ban-client status sshd` en el host y evaluar
`sudo fail2ban-client unban --all`.

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
