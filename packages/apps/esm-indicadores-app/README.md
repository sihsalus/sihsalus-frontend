# esm-indicadores-app

App para tableros e indicadores de gestión.

Terminología de dominio: visita = consulta, encounter = atención, appointment = cita.

## Desarrollo local

```bash
# Desde la raíz del monorepo
yarn install --immutable

# Levantar el microfrontend en modo desarrollo (se registra en el shell de OpenMRS)
yarn --cwd packages/apps/esm-indicadores-app start
```

- El módulo usa `reportesSqlApiPath: "/services/reportes-sql"` a través del mismo gateway que la SPA. `openmrsFetch` antepone la base OpenMRS (`/openmrs` normalmente); el backend debe usar `BASE_PATH=/openmrs/services/reportes-sql` y el proxy debe conservar ese prefijo y la cookie de sesión. No incluir `/openmrs` dos veces en la configuración del frontend.
- Verificación desde la raíz: `yarn workspace @sihsalus/esm-indicadores-app test`, `typescript`, `lint` y `build`; después de crear los commits, ejecutar `yarn verify:changed --base origin/main --head HEAD`.

## Marco normativo

- Ley N.° 26842, Ley General de Salud (Perú).

## Límites funcionales

- Construye vistas de indicadores, métricas y resúmenes analíticos.
- Consume datos agregados para monitoreo y toma de decisiones.
- No captura ni modifica registros clínicos fuente de OpenMRS.
- Crea y versiona definiciones, configura metas y solicita cálculos persistidos en la base de indicadores mediante el backend autorizado.

## Integraciones

- APIs de indicadores y datos agregados.
- Componentes de dashboard y configuración de filtros.
- Traducciones y estilos propios del tablero analítico.

## Backend e integración

- El módulo valida `reportesSqlApiPath` (`/services/reportes-sql` por defecto) y opera en modo **fail-closed**.
- Los datos demo solo se habilitan explícitamente con `enableDemoData: true` y se limitan a consultas que fallen por red o HTTP 5xx.
- Las respuestas HTTP 4xx nunca usan datos demo. Las escrituras siempre se ejecutan contra `reportes-sql` y nunca tienen fallback mock.
- En producción, `enableDemoData` debe permanecer en `false`.
- Mantener el botón del módulo en el menú (`app-menu-item-slot`) para acceso sin depender del backend.

Estado histórico QLTY 2026-07-04:

- La configuración versionada usaba `http://127.0.0.1:8000`, una URL que apuntaba al localhost del navegador y no al host QLTY.
- Ese override fue retirado; la aplicación usa ahora `/services/reportes-sql` por defecto.
- La ruta publica `/services/reportes-sql/health` responde `404` y `/openmrs/services/reportes-sql/health` responde `502`.
- QLTY requiere una ruta `reportesSqlApiPath` operativa. Una ruta no disponible se muestra como error y no habilita el modo demo automáticamente.

## Backend Express / TypeScript

- El frontend espera el backend reportes-sql con estas rutas base:
  - `/health`
  - `/indicadores`
  - `/resultados`
  - `/conceptos`
  - `/metas`

- Para detalles de configuración local con este backend, ver el `README.md` de `reportes-sql`.
- Para producción o contenedores, la recomendación es que `reportesSqlApiPath` apunte al gateway y no al servicio interno directo.
- `indicatorsApiPath` está deprecado y ya no es consumido por la app.

## Contrato de integración y aceptación pendiente

El acceso conserva el privilegio central `app:indicadores`. El backend revalida
la sesión OpenMRS y ese privilegio; para escrituras exige además el privilegio
institucional configurado en `OPENMRS_REQUIRED_PRIVILEGE`. Este cambio no crea
roles ni asigna permisos. Una sesión vencida se rechaza para liberar el estado
de carga, sin sustituir la respuesta por datos de demostración.

Las páginas de indicadores, resultados y metas tienen rutas propias; detalle,
creación y edición admiten enlaces directos. Las traducciones de formulario,
errores y estados vacíos están en español e inglés. Las listas auxiliares
recorren páginas y rechazan respuestas incompletas en lugar de mostrarlas como
un catálogo completo. Las series agregadas consumen `versiones: number[]`, como
las entrega reportes-sql; las series mensuales conservan `version_id/version_num`.

Esta integración incorpora el trabajo funcional de Anderson anterior al commit
local de depuración `01ed97268` de `indicators-review`. No incorpora sus cambios
de configuración local ni el bypass de permisos. El backend coordinado debe
contener el contrato de sesión, catálogo, versiones, metas, resultados canónicos
e históricos y recálculo anual descrito en su README.

Pendiente antes de habilitarlo: probar el gateway y la sesión real en DEV/QLTY,
aprobar y configurar el permiso de escritura en content/distribución, comprobar
los conceptos y tipos de atención instalados, y validar definiciones, metas y
resultados esperados con Anderson y los usuarios de gestión. Las sumas de meses
no equivalen a pacientes únicos de un trimestre/año. La aceptación institucional
y la instalación conservando datos siguen en
[backlog #36](https://github.com/sihsalus/sihsalus-frontend.tasktree/issues/36).
