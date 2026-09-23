# SIH Salus Banco de Sangre

Microfrontend base para construir los flujos de Banco de Sangre. Incluye Inicio, Donantes, Selección del postulante, Extracción y aféresis, Laboratorio, Transferencias, Inventario y Transfusiones.

## Límites actuales

- Inicio, Donantes e Inventario consumen el contrato `BloodBankApi` con datos sintéticos.
- Las demás rutas son bases visuales; todavía no guardan información clínica.
- `useMockData` está habilitado por defecto. Desactivarlo requiere una API real compatible.
- Las pantallas se prueban dentro de la SPA de OpenMRS, con su sesión, navegación compartida y controles de privilegios. Los datos mock siguen disponibles mediante `useMockData`.

## Contratos de integración

- Ruta OpenMRS: `/blood-bank`.
- Tras el login estándar, `/home` selecciona el dashboard de Banco de Sangre si es el único autorizado para el usuario. La extensión `homepage-dashboard-slot` redirige `/home/blood-bank` a `/blood-bank` sin requerir `app:home` ni cambiar el ESM de login. El módulo debe estar incluido en el SPA y el rol necesita `app:home.bancoSangre`.
- Privilegio de entrada: `app:home.bancoSangre`, declarado en `src/routes.json` y centralizado para TypeScript en `src/access/blood-bank-privileges.ts`.
- Las secciones tienen privilegios propios en `src/access/blood-bank-privileges.ts`. `src/navigation/blood-bank-navigation.ts` los asocia a los enlaces y `src/blood-bank-app.component.tsx` protege el acceso por URL directa. Seguimiento de donante y de receptor tienen privilegios independientes; la antigua ruta `/laboratory/follow-up` redirige al seguimiento del donante.
- El rol y sus privilegios se crean y asignan en OpenMRS; las constantes TypeScript no los crean en el backend. Se requieren el privilegio de entrada y el de la sección. La API real también debe verificar autorización.
- Las pantallas están bajo `src/sections/`; `src/shared/` contiene componentes reutilizables y `src/api/` separa mocks y acceso futuro a datos reales.
- En OpenMRS, `src/root.component.tsx` registra `blood-bank-nav-slot` mediante `useLeftNav`. `src/navigation/blood-bank-nav.extension.tsx` aporta al slot los enlaces visibles según privilegios. La barra lateral compartida la dibuja `esm-primary-navigation-app`; el ESM no la duplica. El enlace global a Inicio sigue siendo responsabilidad de `esm-home-app`.
- Dependencia declarada: `webservices.rest >= 2.24.0`.
- Endpoints previstos cuando `useMockData=false`:
  - `GET /ws/rest/v1/bloodbank/dashboard`
  - `GET /ws/rest/v1/bloodbank/donors`
  - `GET /ws/rest/v1/bloodbank/inventory`

El backend continúa siendo la autoridad para autorización y persistencia. No se deben usar datos reales ni información identificable en mocks o pruebas.

## Desarrollo integrado con OpenMRS

Después de preparar el SPA según el README principal:

```bash
SIHSALUS_DEV_APPS=esm-blood-bank-app yarn start
```

El usuario de pruebas necesita el privilegio `app:home.bancoSangre`.
Tras cambiar `src/routes.json`, vuelve a ejecutar `yarn assemble` y reinicia `yarn start` para registrar el nuevo slot. Prueba la barra compartida en `http://localhost:8080/openmrs/spa/blood-bank` con un usuario de pruebas autorizado.

El cliente HMR de la versión local de Rspack falla al cargar este ESM (`setLogLevel`). Por ahora, `rspack.config.js` desactiva solo ese cliente para Banco de Sangre: el servidor recompila los cambios, pero debes recargar el navegador manualmente. Reinicia `yarn start` después de cambiar esta configuración.

## Verificación

```bash
corepack yarn workspace @sihsalus/esm-blood-bank-app lint
corepack yarn workspace @sihsalus/esm-blood-bank-app typescript
corepack yarn workspace @sihsalus/esm-blood-bank-app test
corepack yarn workspace @sihsalus/esm-blood-bank-app build
```
