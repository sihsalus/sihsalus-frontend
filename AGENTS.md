# Instrucciones para agentes

Estas instrucciones aplican a todo el repositorio.

## Antes de cambiar archivos

- Lee `CONTRIBUTING.md` completamente antes de editar cualquier archivo.
- Revisa `git status --short --branch` y conserva todos los cambios ajenos.
- Lee el README raíz, el README del paquete afectado y los contratos clínicos o
  técnicos aplicables.
- Crea o cambia de rama solo cuando la solicitud autorice preparar un PR y el
  árbol esté limpio o aislado. Para un PR nuevo usa una rama separada desde
  `origin/main`, salvo que el usuario o mantenedor indique otra base. Para un PR
  existente trabaja únicamente en su rama y no mezcles otros objetivos.
- No cambies de rama en un workspace compartido con cambios ajenos; usa un
  worktree aislado si está autorizado o pide coordinación.

## Al implementar y validar

- Mantén el cambio mínimo y coherente con el objetivo solicitado.
- No uses producción, PHI ni pacientes reales. No expongas secretos o
  credenciales en código, pruebas, logs, capturas o documentación.
- Sigue la matriz de impacto y validación de `CONTRIBUTING.md`.
- No presentes inferencias, inspección de código, typecheck o build como una
  prueba funcional que no ejecutaste.
- Conserva cambios y archivos no relacionados; no limpies ni restaures trabajo
  ajeno.

## Al preparar un pull request

- Usa `.github/pull_request_template.md` sin eliminar secciones; completa `N/A`
  con una razón concreta cuando corresponda.
- Incluye alcance, riesgos, consumidores, validaciones exactas y pendientes.
- Publica o actualiza la rama y el PR solo cuando la solicitud lo autorice.
- Abrir un PR no autoriza a fusionarlo. Nunca hagas merge, publiques un release
  ni despliegues sin una instrucción explícita del responsable del repositorio.
- Si falta acceso a una validación externa, agota primero las comprobaciones
  locales y marca solo esa validación como `BLOQUEADO`. Detén la implementación
  completa únicamente cuando falte una decisión o autoridad que pueda cambiar
  el resultado; pide solo el acceso o decisión necesarios.
