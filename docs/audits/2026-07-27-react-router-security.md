# Decisión de seguridad de React Router — 2026-07-27

**Alcance:** frontend SIHSALUS para Hospital II-1 Santa Clotilde.

**Decisión:** usar `react-router` y `react-router-dom` `7.18.1` mientras el
frontend permanezca en React 18 y en modo SPA declarativo. No habilitar APIs RSC
inestables. Reevaluar esta decisión a más tardar el **2026-08-31**.

## Motivo

- React Router `7.18.0` corrige las vulnerabilidades de navegación que afectaban
  a la versión 6.30.4. La `7.18.1` es el último parche compatible con React 18.
- La advisory
  [GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2)
  clasifica como alto un bypass CSRF en `react-router >=7.12.0 <8.3.0`, pero
  especifica que solo afecta aplicaciones que usan las APIs RSC inestables.
- SIHSALUS usa `BrowserRouter`, `MemoryRouter`, `Routes` y `Route` en un SPA
  cliente. No tiene servidor React Router, imports RSC ni dependencias
  `react-server-dom-*`.
- React Router 8.3.0 requiere Node 22.22+, React/React DOM 19.2.7+, es ESM-only y
  elimina `react-router-dom`. El repositorio ya cumple Node, pero todavía usa
  React 18.3.1 y varios microfrontends comparten ese contrato. Actualizar solo el
  router a v8 dejaría el runtime fuera de soporte.

Fuentes primarias:

- [Guía oficial de migración v7 a v8](https://reactrouter.com/upgrading/v7)
- [Changelog oficial de React Router](https://reactrouter.com/changelog)
- [Advisory oficial de GitHub](https://github.com/advisories/GHSA-qwww-vcr4-c8h2)

## Controles compensatorios

1. `yarn validate:react-router` exige exactamente `7.18.1` en todas las
   resoluciones directas y un único contrato peer compartido.
2. El mismo control falla si aparece una API con nombre RSC, un import
   `react-router/unstable_rsc` o una dependencia `react-server-dom-*`.
3. CI ejecuta el control antes del audit. Solo después ignora el identificador
   npm `1124282`; ninguna otra advisory queda exceptuada.
4. Las pruebas cubren enlace, fecha, filtros de consulta y navegación
   atrás/adelante en Citas, además de las rutas existentes del monorepo.
5. Si se introduce RSC, se elimina inmediatamente la excepción y se bloquea la
   entrega hasta usar una versión corregida.

## Riesgo residual y salida

La excepción es de **aplicabilidad**, no una afirmación de que el paquete no
contenga código vulnerable. El riesgo reaparece si un futuro cambio habilita
RSC o un servidor React Router; el guard de CI está diseñado para impedirlo.

La salida definitiva es migrar el runtime completo a React/React DOM 19.2.7 o
superior, sustituir todos los imports de `react-router-dom`, validar Module
Federation y ejecutar la matriz clínica autenticada sobre React Router 8.3.0 o
superior. Responsable: equipo frontend y seguridad SIHSALUS.
