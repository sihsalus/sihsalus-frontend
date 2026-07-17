# esm-indicadores-app

App para tableros e indicadores de gestión.

Terminología de dominio: visita = consulta, encounter = atención, appointment = cita.

## Marco normativo
- Ley N.° 26842, Ley General de Salud (Perú).

## Límites funcionales
- Construye vistas de indicadores, métricas y resúmenes analíticos.
- Consume datos agregados para monitoreo y toma de decisiones.
- No captura datos clínicos ni ejecuta workflows transaccionales.
- No modifica registros fuente; solo visualiza y organiza indicadores.

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

## Backend local FastAPI

- El frontend espera el backend reportes-sql con estas rutas base:
  - `/health`
  - `/indicadores`
  - `/resultados`
  - `/conceptos`

- Para detalles de configuración local con este backend, ver el `README.md` de `reportes-sql`.
- Para producción o contenedores, la recomendación es que `reportesSqlApiPath` apunte al gateway y no al servicio interno directo.
- `indicatorsApiPath` está deprecado y ya no es consumido por la app.
