# Cobertura del buscador clínico del chart

[Contratos clínicos](README.md) · [Backlog](../backlog.md)

## Objetivo y estado

El buscador debe encontrar **todo dato clínico visible en el chart** para el
paciente y rol actuales, incluidos módulos opcionales instalados y visibles.
Ese alcance incluye el texto dentro de PDF y de imágenes adjuntas, confirmado
para la primera versión visible. La implementación inicial solo indexa problemas
y antecedentes; por eso `clinicalSearchEnabled`
permanece `false` en el esquema del chart. Este trabajo aún no constituye una
versión completa.

Cada coincidencia debe indicar su tipo, fecha cuando exista y destino dentro
del chart. Debe abrir el registro exacto sin perder el paciente. Un error, una
fuente sin permiso, un módulo ausente o una página sin cargar nunca deben
contabilizarse como «sin resultados». No guardar consultas ni contenido clínico
en logs, telemetría, almacenamiento local o URL.

## Inventario de cobertura

El orden y visibilidad reales proceden de `config/frontend.json` y de los
`routes.json`. Esta tabla agrupa los accesos configurados y sus datos clínicos.
**Pendiente** significa que faltan contrato de lectura, permiso, paginación,
destino exacto y pruebas para esa fuente. Los accesos administrativos sin dato
clínico quedan fuera de la búsqueda de contenido.

| Accesos del chart                                                       | Datos por indexar                                                                        | Estado                                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Resumen, Antecedentes                                                   | Nombre, tipo, estado y fecha de inicio de problemas y antecedentes en OpenMRS REST       | Proveedor y destino exacto implementados; aceptación pendiente |
| Signos vitales y biometría                                              | Observaciones y series temporales                                                        | Pendiente                                                      |
| Consulta externa, Consultas                                             | Visitas, encounters, diagnósticos, notas y formularios                                   | Pendiente                                                      |
| Alergias                                                                | Alergias e intolerancias                                                                 | Pendiente                                                      |
| Ficha familiar                                                          | Vínculos y evaluaciones clínicas familiares visibles                                     | Pendiente                                                      |
| Medicamentos, Órdenes                                                   | Prescripciones y órdenes, incluidos estados e historial                                  | Pendiente                                                      |
| Resultados, Imágenes                                                    | Resultados clínicos y estudios de imagen, incluido texto clínico visible en sus archivos | Pendiente: verificar contenido y destino exacto                |
| Procedimientos, Adjuntos                                                | Procedimientos, metadatos y texto dentro de PDF e imágenes adjuntas                      | Pendiente: lectura completa, extracción e índice autorizados   |
| Vacunación, Tamizajes                                                   | Inmunizaciones y evaluaciones                                                            | Pendiente                                                      |
| Programas, Seguimiento de casos, Pérdida de seguimiento, Interconsultas | Seguimiento y referencias clínicas                                                       | Pendiente                                                      |
| CRED, Salud materna, Odontología, Psicología, Terapia física            | Registros de especialidad y formularios asociados                                        | Pendiente                                                      |

## Contrato para cada proveedor

1. Identificar la fuente y reutilizar su hook o servicio canónico. Verificar
   endpoint, versión backend/content, paginación, anulados, duplicados y datos
   offline. Un FHIR `200` por sí solo no confirma cobertura.
2. Verificar el permiso de la sección **antes** de pedir datos y la identidad de
   cada resultado contra el UUID de la ruta. El backend sigue siendo autoritativo.
3. Definir qué texto es seguro y útil para buscar, con etiquetas en `en` y `es`.
   Preservar tildes, valores históricos y estado de cada registro. No mostrar
   errores técnicos ni registros ajenos en resultados o logs.
4. Distinguir `cargando`, `completo`, `sin coincidencias`, `falló`, `sin permiso`,
   `no instalado` y `sin conexión`. El conteo global solo puede llamarse completo
   cuando todas las fuentes visibles y autorizadas terminaron su lectura.
5. Enlazar al registro o sección exacta respetando permisos, ruta y paciente.
   Para adjuntos e imágenes, verificar si existe búsqueda de contenido; buscar
   solo metadatos no satisface el objetivo de «todo dato».
6. Probar con pacientes sintéticos en DEV/QLTY, roles clínico y restringido,
   español e inglés, paginación, errores parciales, cambio de paciente y modo
   offline. Conservar el flag desactivado hasta completar esa matriz.

El backlog transversal de permisos, auditoría y contratos backend aplica también
al buscador. La indexación no reemplaza esas tareas.

## Dependencia para buscar dentro de archivos

La integración actual de adjuntos usa `useAttachments` para leer una sola página
de metadatos. El recurso REST de Attachments devuelve páginas (`NeedsPaging`) y
ofrece los bytes del archivo por UUID; no entrega texto extraído en la respuesta
que consume el chart. La integración de imágenes lee metadatos de estudios DICOM.
Ninguna de esas lecturas acredita búsqueda en el contenido. Descargar todos los
archivos al navegador para extraerlos allí ampliaría la exposición de datos y
no resolvería el índice completo, la vigencia ni los permisos.

La capacidad backend/content que habilite esta cobertura debe demostrar:

1. Extracción de texto de PDF con capa de texto y OCR de PDF escaneados e
   imágenes adjuntas, con límites de tamaño, páginas, tiempo y formatos. Para
   estudios de imagen, acordar qué contenido textual visible se extrae de
   informes, metadatos y objetos compatibles; registrar lo no extraíble como
   cobertura incompleta, nunca como ausencia de coincidencias.
2. Asociación de cada fragmento con paciente, fuente, UUID del registro,
   versión y ubicación dentro del archivo cuando exista. Las altas,
   correcciones, anulaciones, purgas y cambios de paciente deben actualizar o
   retirar las entradas antiguas. La reindexación histórica debe exponer
   progreso y fallos por fuente.
3. Búsqueda paginada y acotada al paciente autenticado, con autorización del
   módulo y del registro verificada en servidor en **cada consulta y apertura**.
   El resultado debe distinguir completo, pendiente de indexar, no extraíble y
   fallo parcial; no mezclar pacientes, sesiones ni contenido de archivos sin
   permiso en resultados, cachés compartidas, logs o telemetría.
4. Destino que abra el adjunto o estudio exacto dentro del chart, con identidad
   y permiso comprobados de nuevo al abrirlo. El frontend solo mostrará
   fragmentos autorizados y no persistirá consultas ni texto clínico localmente.
5. Pruebas con archivos y pacientes **sintéticos**: PDF textual y escaneado,
   imagen con texto, múltiples páginas de adjuntos, caracteres en español,
   cambio de paciente/rol, archivo anulado o reasignado, fallo de extracción y
   reconstrucción del índice. Registrar versión del backend y limpieza.

Hasta que exista ese contrato implementado y validado en DEV/QLTY junto con las
demás fuentes de la tabla, el buscador de todo el chart no se habilita.
