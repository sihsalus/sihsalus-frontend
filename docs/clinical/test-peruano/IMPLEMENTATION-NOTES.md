# Notas para una futura implementacion

Este documento no autoriza cambios funcionales. Resume restricciones para disenar el
widget del TPED historico sin perder la semantica clinica de la fuente.

## Estado del frontend

Al 2026-07-10 existe una primera implementacion de referencia en
`esm-crecimiento-desarrollo-app`:

- Definicion versionada `TPED-NTS087-2010` con 12 lineas y 88 hitos.
- Matriz accesible de 17 columnas de edad, con continuidad de celdas vacias.
- Foco automatico segun edad cronologica y selector manual de columna.
- Panel de detalle con modalidad de evidencia, fuente y estado del concepto.
- Extension `tped-reference-widget` en la pestana Desarrollo de Control de Nino Sano.

Esta implementacion no contiene payload, workspace de edicion, score, clasificacion ni
llamadas de escritura. Los 88 `conceptUuid` permanecen en `null` hasta completar la
auditoria descrita en `CONCEPT-AUDIT.md`.

## Enfoque recomendado

La arquitectura del odontograma es una referencia util para interaccion y persistencia:
un componente visual complejo respaldado por datos estructurados. Sin embargo, la ficha
del TPED no debe implementarse como una imagen con coordenadas clicables.

Separar cuatro capas:

1. **Definicion versionada del instrumento:** edades, lineas A-L, hitos, condicion de
   evidencia, material, tecnica, respuesta esperada y procedencia normativa.
2. **Motor de evaluacion:** seleccion de banda de edad, herencia de espacios en blanco,
   captura del ultimo hito logrado y clasificacion del perfil.
3. **Persistencia clinica:** respuestas, evidencia, factores de riesgo, resultado derivado,
   version del instrumento, profesional y timestamps.
4. **Presentacion:** matriz navegable, detalle de cada hito, pictograma auxiliar y perfil
   trazado. La imagen oficial solo sirve para validacion visual.

## Datos minimos por evaluacion

- Paciente, encuentro y profesional responsable.
- Fecha/hora de evaluacion.
- Edad cronologica calculada en dias y meses, y banda de evaluacion aplicada.
- Version explicita del instrumento, por ejemplo `TPED-NTS087-2010`.
- Respuestas a factores de riesgo con `si`, `no`, `desconocido` y detalle cuando aplique.
- Resultado por cada linea A-L.
- Para cada hito explorado: `logrado`, `no_logrado`, `no_evaluable`; fuente `observado`,
  `referido` u `observado_referido`; observacion clinica opcional.
- Clasificacion del perfil y motivo reproducible.
- Estado `borrador`, `final` o `anulado`, con historial de cambios.

No guardar solamente pixeles, coordenadas o la linea dibujada. El perfil debe poder
reconstruirse desde las respuestas clinicas.

## Identidad de los hitos

Usar los codigos impresos por la norma (`A1`, `A3`, `B1`, etc.) como identificadores
humanos, acompañados por un UUID/concepto estable. No usar el texto visible como clave:
las correcciones ortograficas o de redaccion no deben romper datos historicos.

Cada definicion debe conservar:

- Codigo normativo.
- Edad de adquisicion representada.
- Linea de comportamiento.
- Texto del hito y respuesta esperada.
- Condicion: observado, referido u ambos.
- Material y tecnica descritos.
- Pagina fuente.
- Concepto clinico enlazado, si existe.

Antes de programar, se debe comparar la lista completa del Anexo 9 contra los conceptos
registrados. Un concepto con etiqueta parecida no es suficiente: debe coincidir el hito,
edad y modalidad de observacion.

## Reglas de edad

La fuente historica define una frontera particular: hasta 1 mes y 28 dias se conserva el
mes anterior; con 1 mes y 29 dias se pasa al siguiente mes. Esta regla debe centralizarse
y probarse, no repartirse entre componentes.

Bandas despues de 12 meses:

| Edad cronologica | Columna TPED |
| --- | --- |
| 13-14 meses | 12 meses |
| 15-17 meses | 15 meses |
| 18-20 meses | 18 meses |
| 21-23 meses | 21 meses |
| 24-29 meses | 24 meses |
| 30 meses | 30 meses |

Definir con el equipo clinico que ocurrira con prematuridad, edad corregida y pacientes
mayores de 30 meses. El Anexo 9 archivado no justifica inventar esas reglas.

## Calculo del perfil

Para cada linea A-L:

1. Comenzar por la columna inmediatamente anterior a la banda cronologica.
2. Explorar hacia la derecha.
3. Registrar el hito mas alto obtenido.
4. Aplicar la herencia del hito anterior en celdas vacias.
5. Comparar la posicion final con la edad cronologica.

La clasificacion historica es cualitativa: normal, trastorno, adelanto o riesgo para
trastorno. No hay en la guia una formula para sumar los numeros pequenos de la lamina ni
un porcentaje global; no implementar un score sin otra fuente oficial y validacion clinica.

## Interfaz

- Mantener visibles la edad cronologica y la banda realmente aplicada.
- Permitir recorrer las doce lineas por teclado y lector de pantalla.
- Mostrar texto completo, condicion, material y tecnica en un panel de detalle.
- Distinguir visualmente logrado, no logrado, no evaluado y no evaluable.
- Distinguir observado de referido; no ocultarlo en una nota libre.
- Trazar el perfil desde los datos y ofrecer una vista tabular/imprimible equivalente.
- No obligar a interpretar un pictograma: el texto del hito es la fuente primaria.
- Advertir si se intenta finalizar con lineas incompletas o respuestas de riesgo pendientes.
- Evitar que una respuesta posterior borre silenciosamente evidencia previa.

## Convivencia con la norma vigente

El TPED y el flujo NTS 238 deben ser instrumentos distintos en dominio y almacenamiento.
No mapear automaticamente una respuesta del TPED a Huanca o EDI: tienen estructura,
edades y finalidad diferentes.

La seleccion del TPED debe requerir configuracion institucional. En reportes e historia
clinica debe aparecer nombre y version completos para que nunca se interprete como
cumplimiento automatico de la NTS 238.

## Pruebas clinicas minimas

- Fronteras de edad: 28/29 dias y cada cambio de banda posterior a 12 meses.
- Herencia de celdas vacias.
- Hito observado, referido y de doble modalidad.
- Perfil normal, a la izquierda, a la derecha y normal con factor de riesgo.
- Lineas incompletas, no evaluables y evaluacion interrumpida.
- Correccion de una evaluacion final sin perder auditoria.
- Render responsive, teclado, lector de pantalla e impresion.
- Comparacion visual y semantica de todos los hitos contra las paginas 94-118 del Anexo 9.

La aceptacion final debe incluir enfermeria CRED, pediatria o neurologia pediatrica,
seguridad del paciente, informatica clinica y el responsable institucional de normativa.
