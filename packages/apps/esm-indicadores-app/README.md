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

- El módulo valida `indicatorsApiPath` (`/ws/module/indicators/api` por defecto). Si responde 404 u otro error, entra en **modo demo** y usa la vista mock del front.
- Mantener el botón del módulo en el menú (`app-menu-item-slot`) para acceso sin depender de ese OMOD.
