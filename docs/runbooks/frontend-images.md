# Imágenes del frontend

[Documentación](../README.md) · [Inicio](../../README.md)

## Estado de las recetas

[Dockerfile](../../Dockerfile) define los targets de construcción y runtime;
[`.dockerignore`](../../.dockerignore) excluye dependencias, artefactos y entornos
locales del contexto. [Nginx](../../config/nginx.spa.conf) conserva el fallback SPA y
las políticas de caché. [Compose](../../docker-compose.yml) mantiene el entorno
local. Estos archivos siguen activos y deben cambiar junto con sus consumidores.
Esta guía describe el contrato; la evidencia de construcción corresponde al SHA
y al workflow registrados en cada PR.

La receta usa BuildKit y la sintaxis estable `docker/dockerfile:1.20` para
copiar los manifiestos de todos los workspaces conservando sus rutas. Yarn
instala antes de copiar el código y los assets: los cambios de implementación
pueden reutilizar la capa de dependencias; los cambios de manifiestos, lockfile
o parches de `.yarn` la invalidan. No mantener una lista manual de paquetes ni
un script adicional para preparar este contexto. Ver
[`COPY --parents`](https://docs.docker.com/reference/dockerfile/#copy---parents).

Dentro del builder, `YARN_NM_MODE=hardlinks-local` conserva la deduplicación
entre paquetes del proyecto sin incluir el almacén global de hardlinks de Yarn
en las capas. El caché de descargas sigue siendo un mount de BuildKit. Este
ajuste no modifica el modo de instalación de los entornos de desarrollo.
Los modos disponibles están documentados en
[`nmMode`](https://yarnpkg.com/configuration/yarnrc#nmMode).

Consultar el [estado de configuración](../development/tooling-status.md) y el
[runbook de go-live](frontend-go-live.md). Un PR o una compilación local no
autoriza publicación, promoción, rollback ni acceso a un servidor.

## Contrato de las imágenes y procedimientos

La imagen publicada en GHCR usa el target `secure-init`: ensambla el SPA en `/spa` y termina. No contiene un servidor HTTP. El despliegue de `sihsalus-distro-referenceapplication` la ejecuta como init container con un volumen compartido que luego sirve Nginx.

Los targets `init` y `secure-init` reciben sus dependencias desde
`init-dependencies`, que excluye el compilador nativo de TypeScript y sus paquetes
por plataforma antes de copiarlos a la imagen final. El builder conserva ese
compilador para desarrollo y validaciones. La API JavaScript de TypeScript y los
bundlers siguen disponibles para ensamblar el app shell al iniciar el contenedor.
No se deben eliminar binarios después de copiarlos al target final: seguirían
presentes en las capas anteriores. Los cambios en este límite requieren validar
el ensamblado y analizar la nueva imagen; las alertas del digest anterior no
demuestran el estado de la nueva imagen ni se cierran manualmente como sustituto
del análisis.

Para validar una corrección en un entorno de pruebas autorizado, el workflow
`SPA Image` admite `workflow_dispatch` con `publish_candidate=true` y
`candidate_base=<SHA completo de la base>`. Solo acepta ramas distintas de
`main` y `pre-release`. Verifica los paquetes afectados y sus consumidores,
construye `secure-init` y analiza su digest con Trivy. La etiqueta resultante es
`candidate-<SHA completo>`; solo se debe desplegar el digest de una ejecución
terminada con éxito. El workflow no promueve etiquetas de release ni dispara
despliegues. La elección del entorno y su rollback siguen siendo responsabilidad
del despliegue autorizado en la distribución.

Para fijar un despliegue a la imagen publicada por `main`, resuelve primero su digest y úsalo en la configuración del repositorio de infraestructura:

```bash
# 1) Traer la etiqueta latest y resolver el digest exacto
docker pull ghcr.io/sihsalus/sihsalus-frontend:latest
IMAGE_REF=$(docker inspect --format '{{ index .RepoDigests 0 }}' ghcr.io/sihsalus/sihsalus-frontend:latest)
echo "$IMAGE_REF"

# Configurar IMAGE_REF en la distribución; ya incluye @sha256:...
```

Para una imagen local que sí sirva el SPA con Nginx:

```bash
docker build --target spa-nginx -t sihsalus-frontend:local .
docker run --rm --name sihsalus-frontend --network sihsalus-network -p 8080:80 sihsalus-frontend:local
```

La red usada en el ejemplo debe contener o resolver un servicio `backend` en el puerto `8080`; es el upstream configurado en `config/nginx.spa.conf`. Nginx / reverse proxy y el volumen de producción se administran en el repositorio de infraestructura.
