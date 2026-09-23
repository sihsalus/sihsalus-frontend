# Imágenes del frontend

[Documentación](../README.md) · [Inicio](../../README.md)

## Estado de las recetas

En esta rama se eliminaron `Dockerfile`, `.dockerignore`, `nginx.spa.conf` y
`docker-compose.yml`. Los workflows todavía consumen los targets descritos
abajo, por lo que la construcción no está disponible hasta resolver esa
migración. Esta guía conserva el contrato de las imágenes; no acredita una
imagen construida, publicada o desplegada con la limpieza.

Consultar el [estado de configuración](../development/tooling-status.md) y el
[runbook de go-live](frontend-go-live.md). Un PR o una compilación local no
autoriza publicación, promoción, rollback ni acceso a un servidor.

## Contrato de las imágenes y procedimientos

La imagen publicada en GHCR usa el target `secure-init`: ensambla el SPA en `/spa` y termina. No contiene un servidor HTTP. El despliegue de `sihsalus-distro-referenceapplication` la ejecuta como init container con un volumen compartido que luego sirve Nginx.

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

La red usada en el ejemplo debe contener o resolver un servicio `backend` en el puerto `8080`; es el upstream configurado en `nginx.spa.conf`, actualmente eliminado. Nginx / reverse proxy y el volumen de producción se administran en el repositorio de infraestructura.
