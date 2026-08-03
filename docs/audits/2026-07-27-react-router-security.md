# Decisión de seguridad de React Router — actualizada 2026-08-03

**Alcance:** frontend SIHSALUS para Hospital II-1 Santa Clotilde.

**Decisión:** fijar `react-router` y `react-router-dom` en `7.18.2`, conservar
el contrato peer `>=6.30.4 <8` y mantener el frontend en React 18 y modo SPA
declarativo. No habilitar APIs RSC inestables. Reevaluar la excepción temporal
de los escáneres a más tardar el **2026-08-31**.

## Motivo

- Los mantenedores publicaron `7.18.2` el 2026-07-28 con el backport oficial que
  endurece las rutas CSRF de RSC. La advisory del repositorio upstream declara
  afectado `>=7.12.0 <7.18.2` y corregido `>=7.18.2` para la línea 7.x; la línea
  8.x se modela aparte y queda corregida en `8.3.0`.
- La advisory global de GitHub y el feed que consume `npm audit` todavía
  combinan ambas líneas como `>=7.12.0 <8.3.0`. Por esa metadata desactualizada,
  marcan incorrectamente `7.18.2` como vulnerable. La corrección ya está
  propuesta en `github/advisory-database#8868`.
- `react-router-dom@7.18.2` depende exactamente de `react-router@7.18.2`; ambos
  admiten React 18 y Node 20 o superior. El repositorio usa React 18.3.1 y Node
  24 o superior, por lo que el parche no cambia el contrato de runtime.
- SIHSALUS usa `BrowserRouter`, `MemoryRouter`, `Routes` y `Route` en un SPA
  cliente. No tiene servidor React Router, imports RSC ni dependencias
  `react-server-dom-*`.
- Migrar a React Router 8 no es necesario para corregir esta advisory y sí
  requeriría una migración coordinada del contrato compartido. El backport 7.x
  evita introducir ese cambio mayor en un parche de seguridad.

Fuentes primarias:

- [Advisory del repositorio React Router](https://github.com/remix-run/react-router/security/advisories/GHSA-qwww-vcr4-c8h2)
- [Release oficial `react-router@7.18.2`](https://github.com/remix-run/react-router/releases/tag/react-router@7.18.2)
- [Backport oficial a v7](https://github.com/remix-run/react-router/pull/15353)
- [Corrección pendiente de la advisory global](https://github.com/github/advisory-database/pull/8868)
- [Advisory global todavía desactualizada](https://github.com/advisories/GHSA-qwww-vcr4-c8h2)

## Controles temporales

1. `yarn validate:react-router` exige exactamente `7.18.2` en resoluciones,
   dependencias directas y lockfile, manteniendo un único contrato peer.
2. El mismo control falla si aparece una API con nombre RSC, un import
   `react-router/unstable_rsc` o una dependencia `react-server-dom-*`.
3. CI ejecuta el control antes del audit. Solo después ignora el identificador
   npm `1124282`, que continúa reportando el rango global incorrecto; ninguna
   otra advisory queda exceptuada.
4. Trivy exceptúa únicamente `GHSA-qwww-vcr4-c8h2` para el PURL exacto
   `pkg:npm/react-router@7.18.2`. La excepción vence el **2026-08-31** y el guard
   rechaza que se amplíe el alcance, cambie la justificación o se omita el
   vencimiento.
5. Las pruebas negativas cubren versiones divergentes, peers incorrectos,
   dependencias RSC, flags retirados, excepciones adicionales y expiración.
6. Cuando GitHub publique el rango corregido, se deben eliminar en un cambio
   atómico `--ignore 1124282`, `.trivyignore.yaml` y la validación asociada a la
   excepción. La prohibición de RSC se conserva como contrato arquitectónico.

## Evidencia técnica

El backport `8ebd5df9932854547963e3255c8454e62430e05d` modifica
`packages/react-router/lib/rsc/server.rsc.ts`: si la verificación de origen
detecta un posible CSRF, transforma la solicitud en `GET` antes de consultar la
ruta e impide ejecutar la acción. La release `7.18.2` incorpora ese commit y
añade una prueba de integración que verifica que un `POST` cross-origin retorna
400 sin invocar la acción.

La excepción anterior para `7.18.1` queda reemplazada por el runtime parcheado.
La excepción que permanece no acepta código vulnerable: compensa únicamente la
metadata global desactualizada mientras se procesa su corrección.

## Riesgo residual y salida

El runtime queda corregido en la línea 7.x. El riesgo residual es operativo:
Dependabot, `npm audit` y Trivy pueden mantener el falso positivo hasta que
GitHub publique la corrección del rango. La excepción continúa exacta,
documentada y con vencimiento para impedir que se convierta en deuda permanente.

Responsable de retirar la excepción tras la corrección, o de revisarla antes del
2026-08-31: equipo frontend y seguridad SIHSALUS.
