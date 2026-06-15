# esm-home-app

App de inicio y punto de entrada del portal.

Terminología de dominio: visita = consulta, encounter = atención, appointment = cita.

## Marco normativo
- Ley N.° 29733, Ley de Protección de Datos Personales (Perú).

## Límites funcionales
- Presenta la página principal y el redireccionamiento inicial del usuario.
- Organiza accesos rápidos, navegación lateral y contenidos de bienvenida.
- No gestiona procesos clínicos ni operativos especializados.
- No reemplaza los módulos funcionales del dominio; solo actúa como landing del producto.
- No debe implementar lógica de negocio de búsqueda, admisión, colas, citas ni historia clínica; debe delegar a los módulos dueños del flujo.

## Integraciones
- Rutas raíz, redirecciones y menú lateral.
- Configuración compartida del shell y módulos visibles por rol.
- Componentes de dashboard y layout global.

## Contratos de navegación
- Los accesos rápidos deben lanzar rutas/workspaces registrados por otros módulos, no duplicar su comportamiento.
- El acceso a búsqueda de paciente debe comportarse igual que la lupa del top bar: abrir el panel y cerrar sin dejar la página en blanco.
- Los textos de navegación deben usar traducciones visibles para usuario final. Keys como `caseMonitoring` no deben aparecer en la UI.
- El menú lateral debe usar nombres operativos: por ejemplo `Colas de atención`, `Servicios de emergencia`, `Monitoreo y seguimiento de casos`.

## Riesgos conocidos
- Un acceso rápido mal cableado puede dejar rutas huérfanas o paneles abiertos sin dueño.
- Cambios en navegación pueden romper sidebars del patient chart si reutilizan slots o nombres de dashboard sin validar.
- Este módulo suele ocultar problemas de registro en otros microfrontends porque es el primer punto de entrada del usuario.
