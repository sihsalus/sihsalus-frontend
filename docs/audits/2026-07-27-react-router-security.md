# Decisión de seguridad de React Router — actualizada 2026-09-02

**Alcance:** frontend SIHSALUS para Hospital II-1 Santa Clotilde.

**Decisión:** fijar `react-router` y `react-router-dom` en `7.18.2`, conservar
el contrato peer `>=6.30.4 <8` y mantener el frontend en React 18 y modo SPA
declarativo. No habilitar APIs RSC inestables. Retirar las excepciones
temporales de npm audit y Trivy porque la advisory oficial ya reconoce el
backport corregido de la línea 7.x.

## Motivo

- Los mantenedores publicaron `7.18.2` el 2026-07-28 con el backport oficial que
  endurece las rutas CSRF de RSC. La advisory del repositorio upstream declara
  afectado `>=7.12.0 <7.18.2` y corregido `>=7.18.2` para la línea 7.x; la línea
  8.x se modela aparte y queda corregida en `8.3.0`.
- La advisory global de GitHub fue corregida el 2026-08-07 y ahora modela por
  separado las líneas 7.x y 8.x. Declara afectado `>=7.12.0 <7.18.2` y corregido
  `>=7.18.2` para 7.x, por lo que el runtime fijado ya no requiere una excepción.
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
- [Advisory global corregida](https://github.com/advisories/GHSA-qwww-vcr4-c8h2)

## Remediaciones adicionales detectadas al retirar excepciones

La ejecución de `yarn npm audit --all --recursive --severity high` sin ignores
detectó dependencias transitivas nuevas que también debían corregirse. El mismo
cambio fija versiones compatibles y añade una prueba para impedir regresiones:

- `browserslist` queda resuelto en `4.28.8` (mínimo seguro `4.28.7`) para cerrar
  [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) y
  [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g).
- `fast-uri` queda resuelto en `3.1.6`, la versión corregida compatible con
  `ajv@8`, para cerrar
  [GHSA-5jgf-p345-68v8](https://github.com/advisories/GHSA-5jgf-p345-68v8),
  [GHSA-f65p-4m7j-42xc](https://github.com/advisories/GHSA-f65p-4m7j-42xc),
  [GHSA-fph4-wmhf-6fwf](https://github.com/advisories/GHSA-fph4-wmhf-6fwf) y
  [GHSA-jqff-g426-hqxp](https://github.com/advisories/GHSA-jqff-g426-hqxp).

## Controles vigentes

1. `yarn validate:react-router` exige exactamente `7.18.2` en resoluciones,
   dependencias directas y lockfile, manteniendo un único contrato peer.
2. El mismo control falla si aparece una API con nombre RSC, un import
   `react-router/unstable_rsc` o una dependencia `react-server-dom-*`.
3. CI ejecuta el control antes de `npm audit`, que revisa todos los workspaces y
   dependencias transitivas sin identificadores ignorados.
4. Trivy analiza las imágenes inmutables sin archivo de excepciones antes de
   promover alias mutables.
5. Las pruebas negativas continúan cubriendo versiones divergentes, peers
   incorrectos, dependencias RSC y flags retirados.

## Evidencia técnica

El backport `8ebd5df9932854547963e3255c8454e62430e05d` modifica
`packages/react-router/lib/rsc/server.rsc.ts`: si la verificación de origen
detecta un posible CSRF, transforma la solicitud en `GET` antes de consultar la
ruta e impide ejecutar la acción. La release `7.18.2` incorpora ese commit y
añade una prueba de integración que verifica que un `POST` cross-origin retorna
400 sin invocar la acción.

La excepción anterior para `7.18.1` quedó reemplazada por el runtime parcheado.
Tras la corrección de la metadata global, se eliminaron atómicamente el ignore
de npm, el archivo `.trivyignore.yaml` y la validación temporal asociada.

## Riesgo residual y salida

El runtime está corregido en la línea 7.x y los escáneres vuelven a operar sin
excepciones. El riesgo residual consiste en una futura divergencia de versiones
o en introducir APIs RSC; ambos casos quedan bloqueados por
`yarn validate:react-router`.

Responsable de revisar futuras advisories y mantener el contrato: equipo
frontend y seguridad SIHSALUS.
