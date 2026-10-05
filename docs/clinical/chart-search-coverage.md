# Cobertura del buscador clínico del chart

[Contratos clínicos](README.md) · [Backlog](../backlog.md)

## Objetivo y estado

El buscador debe encontrar **todo dato clínico visible en el chart** para el
paciente y rol actuales, incluidos módulos opcionales instalados y visibles.
Ese alcance fue confirmado para la primera versión visible. La implementación
inicial solo indexa problemas y antecedentes; por eso `clinicalSearchEnabled`
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

| Accesos del chart                                                       | Datos por indexar                                                                  | Estado                                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Resumen, Antecedentes                                                   | Nombre, tipo, estado y fecha de inicio de problemas y antecedentes en OpenMRS REST | Proveedor y destino exacto implementados; aceptación pendiente |
| Signos vitales y biometría                                              | Observaciones y series temporales                                                  | Pendiente                                                      |
| Consulta externa, Consultas                                             | Visitas, encounters, diagnósticos, notas y formularios                             | Pendiente                                                      |
| Alergias                                                                | Alergias e intolerancias                                                           | Pendiente                                                      |
| Ficha familiar                                                          | Vínculos y evaluaciones clínicas familiares visibles                               | Pendiente                                                      |
| Medicamentos, Órdenes                                                   | Prescripciones y órdenes, incluidos estados e historial                            | Pendiente                                                      |
| Resultados, Imágenes                                                    | Resultados clínicos y estudios de imagen                                           | Pendiente                                                      |
| Procedimientos, Adjuntos                                                | Procedimientos y contenido de adjuntos visibles                                    | Pendiente; extracción por verificar                            |
| Vacunación, Tamizajes                                                   | Inmunizaciones y evaluaciones                                                      | Pendiente                                                      |
| Programas, Seguimiento de casos, Pérdida de seguimiento, Interconsultas | Seguimiento y referencias clínicas                                                 | Pendiente                                                      |
| CRED, Salud materna, Odontología, Psicología, Terapia física            | Registros de especialidad y formularios asociados                                  | Pendiente                                                      |

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
