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

## TODO backend/integración

- El módulo valida `reportesSqlApiPath` (`/services/reportes-sql` por defecto). Si la respuesta falla, entra en **modo demo** y usa la vista mock del front.
- Mantener el botón del módulo en el menú (`app-menu-item-slot`) para acceso sin depender del backend.

## Backend local FastAPI

- Para desarrollo local, `config/frontend.json` puede definir:

```json
{
  "@sihsalus/esm-indicadores-app": {
    "reportesSqlApiPath": "http://127.0.0.1:8000"
  }
}
```

- El frontend espera el backend reportes-sql con estas rutas base:
  - `/health`
  - `/indicadores`
  - `/resultados`
  - `/conceptos`

- Para producción o contenedores, la recomendación es que `reportesSqlApiPath` apunte al gateway y no al servicio interno directo.
- `indicatorsApiPath` está deprecado y ya no es consumido por la app.
