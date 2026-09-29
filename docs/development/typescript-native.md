# Compilador nativo de TypeScript

Los scripts `typescript` y los builds que emiten declaraciones usan TypeScript
7.0.2. Yarn 4.18.1 instala el compilador con el alias `@typescript/native` y
expone su ejecutable `tsc` en cada workspace que lo declara.

La API JavaScript sigue siendo TypeScript 6.0.3, mediante el paquete oficial
`@typescript/typescript6` 6.0.2 bajo el nombre `typescript`. Es necesaria para el
validador de exposición de errores, las pruebas que usan el AST y
`transpileModule`, TypeDoc, los loaders de TypeScript y el chequeo del servidor
de desarrollo de Rspack. Framework, Cohortes, carga rápida e Imágenes conservan
además la declaración requerida por sus herramientas y peers.
No retirar esa compatibilidad mientras existan esos consumidores. `tsc6` permite
comparar ambos compiladores explícitamente; no sustituye el chequeo nativo de CI.

Yarn 4.13.0 falla al parchear el paquete de compatibilidad. Con 4.18.1 la
instalación termina y el parche opcional no aplicable se informa como advertencia
`YN0066`. No se mantiene un parche propio ni se desactivan validaciones.

Las configuraciones eliminan `baseUrl`, `ignoreDeprecations` y la resolución
`node` antigua. Las aplicaciones usan `bundler`; las herramientas CommonJS usan
`NodeNext`, acorde al runtime Node 24. Se conservan las opciones estrictas y los
archivos incluidos en cada chequeo.

Los scripts de chequeo de las bibliotecas usan `--noEmit`: el build ya genera
sus declaraciones antes de revisar los consumidores. Se conservan ambos
chequeos de Styleguide, incluido el de su configuración de build, sin escribir
por segunda vez los artefactos.

## Medición reproducible

```sh
corepack enable
yarn install --immutable
yarn build --concurrency=2
yarn benchmark:typescript
```

El benchmark ejecuta ambos compiladores sobre el mismo código y configuración en
Consulta Externa, Stock y la biblioteca clínica compartida. Descarta una ronda de
calentamiento y toma la mediana de tres rondas alternadas, sin emisión,
incrementalidad ni caché Turbo. Si algún chequeo falla, termina con error y no
publica una mejora para ese módulo. Ejecutarlo sin otros builds o pruebas activos.
Las cifras representan el chequeo de tipos local; no miden navegación, bundle,
backend, tiempo total de CI ni despliegue.

Medición local del 29/09/2026, código `ecbf1c5c6`, macOS arm64, Node 24.15.0,
TypeScript 6.0.3 y 7.0.2. Todos los chequeos medidos terminaron correctamente:

| Módulo                        | TS 6, mediana | TS 7, mediana | Relación |
| ----------------------------- | ------------: | ------------: | -------: |
| Consulta Externa              |       2942 ms |        778 ms |    3,78× |
| Stock                         |       3095 ms |        892 ms |    3,47× |
| Biblioteca clínica compartida |       2073 ms |        502 ms |    4,13× |

## Validación de la migración

Además de `yarn verify:changed --base origin/main --head HEAD`, ejecutar
`yarn test:tooling`, `yarn typecheck:e2e`, `yarn assemble` y
`yarn openmrs --help`. Las pruebas de tooling comprueban que Yarn expone el
compilador nativo en apps, bibliotecas y CLI, y que rechaza errores reales de
tipado. Las pruebas existentes conservan la validación de la API anterior.

La instalación Linux y la imagen Docker requieren evidencia propia de CI; una
compilación local en macOS no valida esas plataformas. La aceptación clínica
sigue siendo independiente, con datos sintéticos en DEV/QLTY.

Referencias: [TypeScript 7](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/),
[compatibilidad con Yarn](https://github.com/microsoft/typescript-go/issues/4368),
[selección del ejecutable](https://github.com/yarnpkg/berry/issues/7215).
