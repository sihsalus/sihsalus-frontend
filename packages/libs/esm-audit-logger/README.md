# @sihsalus/esm-audit-logger

Libreria compartida para auditoria frontend de eventos sensibles y acceso a informacion clinica.

No es una bitacora legal por si sola. Cifra y reintenta eventos en el navegador,
pero el cumplimiento de la Directiva Administrativa 373-MINSA/OGTI-2025 requiere
un endpoint autenticado y un almacen server-side protegido, inmutable, retenido y
consultable solo por personal autorizado.

La cola local esta acotada. Si alcanza su capacidad, conserva los eventos mas
recientes, registra un error y emite `sihsalus:audit-queue-overflow`; aun asi existe
perdida y se requiere alerta operativa. El mutex evita duplicados solo dentro de una
pestana: el backend debe imponer unicidad por `event.id` y comprobar que usuario y
sesion del payload coincidan con la identidad autenticada de la peticion.

Si una fila local ya no puede descifrarse (por corrupcion o perdida/rotacion de la
clave del dispositivo), se purga porque nunca podria enviarse y se emite
`sihsalus:audit-entries-unreadable` con la cantidad y los identificadores tecnicos
aleatorios afectados. La senal no incluye payload, usuario, paciente ni sesion;
operaciones debe capturarla y alertar porque representa perdida de trazabilidad.

Los fallos HTTP se reintentan con backoff exponencial y jitter, sin superar 60
segundos de espera total entre intentos. Si una escritura nueva llega durante un
`flush`, el logger vuelve a leer la cola antes de cancelar el retry pendiente.

## Eventos instrumentados

- `UNHANDLED_ERROR`: error no controlado con contexto tecnico minimizado.
- `PATIENT_CHART_VIEW_SUCCEEDED`, `PATIENT_CHART_VIEW_FAILED` y
  `PATIENT_CHART_ACCESS_DENIED`: resultado diferenciado de la apertura de historia
  clinica con UUID validado/confirmado, modulo, usuario, sesion y
  ubicacion de sesion. La ubicacion de sesion no se presume UPSS y el payload no
  incluye nombres ni datos demograficos.

## TODO auditoria

- Definir el catalogo de eventos auditables por modulo: vista de paciente, busqueda, apertura de historia, creacion/edicion/eliminacion, descarga/impresion, cambios de permisos y errores de integracion.
- Integrar `useAuditLogger` en los demas flujos con PHI o acciones clinicas sensibles: busqueda y registro de paciente, CRED, salud materna, vacunacion, ordenes, dispensing, FUA, VIH, ward, emergency, billing y stock.
- Alinear el payload de auditoria con el backend definitivo: usuario, paciente, visita/consulta, encounter, modulo, accion, timestamp, resultado y contexto offline.
- Formalizar la politica operativa de persistencia offline y reintento: retencion, monitoreo de desborde y manejo de duplicados entre pestanas.
- Agregar pruebas de que los eventos sensibles se registran y de que no se filtra PHI innecesaria en payloads de auditoria.
- Documentar que eventos deben bloquear la accion si la auditoria falla y cuales pueden continuar con reintento posterior.
