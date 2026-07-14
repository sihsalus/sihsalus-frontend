# Contrato de nacionalidad del paciente

## Modelo canónico

La nacionalidad es un atributo codificado de persona en OpenMRS. No es texto libre ni el país emisor del documento.

- Tipo de atributo: `9b3df0a1-0c58-4f55-9868-9c38f1db1007`
- Formato: `org.openmrs.Concept`
- Conjunto de respuestas: `7869ef7a-be6c-4108-9ee5-9cc7470e0b2d`
- Concepto Perú: `e0370dea-d480-4721-a438-97a77d6c3349`

Los formularios deben enviar a la API REST el UUID del concepto seleccionado. Los códigos ISO como `PE`, `CO` o `US` no son valores válidos para este atributo.

Ese contrato corresponde a la API REST. Internamente, OpenMRS convierte el UUID recibido y almacena en
`person_attribute.value` el `concept_id` numérico del concepto. Por tanto:

- el frontend y otros clientes REST deben enviar UUIDs;
- una migración SQL nunca debe escribir UUIDs en `person_attribute.value`;
- los `concept_id` no deben copiarse entre entornos, porque son identificadores locales de cada base de datos.

## Reglas de captura

- El catálogo visible se obtiene del conjunto de conceptos desplegado en OpenMRS.
- Un DNI completo y válido en formato (ocho dígitos) puede establecer y bloquear automáticamente el concepto Perú.
- Si un DNI completo no tiene una nacionalidad explícita, registro general y emergencia bloquean el envío hasta que
  el catálogo cargue sin error y confirme que contiene el concepto Perú. La comprobación ocurre también antes de
  consumir un identificador o crear el paciente, por lo que enviar el formulario con Enter no omite el control.
- Una nacionalidad explícita ya registrada no se sobrescribe automáticamente al agregar un DNI.
- Toda nacionalidad explícita debe seguir siendo un UUID perteneciente al catálogo desplegado; no basta con que tenga
  forma de UUID. Un valor preexistente tampoco puede guardarse mientras el catálogo carga o no está disponible.
- Una fila de DNI vacía no permite inferir nacionalidad.
- CE, pasaporte y DIE no permiten inferir nacionalidad; el operador debe declararla.
- Una nacionalidad ya registrada no se elimina por la presencia de otro documento.
- Un paciente no identificado no recibe una nacionalidad inferida.
- `Otro país` no se guarda salvo que exista un concepto formal dentro del conjunto configurado.
- El país emisor del documento, si se necesita, debe modelarse como un dato separado.

## Brecha conocida del catálogo desplegado

La auditoría del 14 de julio de 2026 sobre los bundles
`06_SIHSALUS_geografia_concepts_2026-07-10-02.zip` y
`56_SIHSALUS_geografia_mappings_2026-07-10-02.zip` encontró 165 miembros activos en el conjunto `Países`.
Perú está presente una sola vez, pero el catálogo no contiene países reales como República Dominicana,
Filipinas e Irán. También conserva denominaciones que requieren curaduría, por ejemplo `Inglaterra` separada de
`Islas del Reino Unido de Gran Bretaña e Irlanda del Norte`.

Como referencia normativa, el [CodeSystem PaisesCS de RENHICE/MINSA](https://dyaku.minsa.gob.pe/guides/CodeSystem-PaisesCS.html)
declara 248 códigos basados en ISO 3166 alfa-3. Esa fuente también debe pasar control terminológico antes de importarse;
no corresponde copiar etiquetas o reemplazar UUIDs existentes de forma automática.

La corrección pertenece a contenido/OCL, no al formulario:

1. comparar el set actual con el CodeSystem normativo mediante código alfa-3;
2. preservar los UUID de conceptos existentes y corregir etiquetas mediante versiones auditables;
3. crear los conceptos ausentes y retirar duplicados solo con un mapeo aprobado;
4. publicar un nuevo bundle versionado y probar pertenencia, unicidad y conteo antes del despliegue;
5. verificar en OpenMRS que todos los miembros activos son seleccionables y persisten como concepto codificado.

El frontend debe seguir consumiendo el set desplegado y fallar de forma visible y cerrada si no puede cargarlo; no
debe hardcodear una lista paralela de países.

## Auditoría previa de datos históricos

La siguiente consulta es únicamente de lectura. Debe ejecutarse primero en un entorno controlado y después de confirmar el esquema de la instancia:

```sql
SELECT
  pa.person_attribute_id,
  pa.person_id,
  pa.value AS stored_value,
  c.concept_id AS resolved_concept_id,
  c.uuid AS resolved_concept_uuid,
  c.retired AS resolved_concept_retired,
  CASE
    WHEN c.concept_id IS NOT NULL THEN 'VALID_CONCEPT_REFERENCE'
    ELSE 'LEGACY_OR_INVALID_VALUE'
  END AS value_status,
  pa.date_created,
  pa.date_changed
FROM person_attribute pa
JOIN person_attribute_type pat
  ON pat.person_attribute_type_id = pa.person_attribute_type_id
LEFT JOIN concept c
  ON c.concept_id = CASE
    WHEN pa.value REGEXP '^[0-9]+$' THEN CAST(pa.value AS UNSIGNED)
    ELSE NULL
  END
WHERE pat.uuid = '9b3df0a1-0c58-4f55-9868-9c38f1db1007'
  AND pa.voided = 0
ORDER BY pa.value, pa.person_id;
```

También debe obtenerse un resumen por valor:

```sql
SELECT pa.value, COUNT(*) AS patients
FROM person_attribute pa
JOIN person_attribute_type pat
  ON pat.person_attribute_type_id = pa.person_attribute_type_id
WHERE pat.uuid = '9b3df0a1-0c58-4f55-9868-9c38f1db1007'
  AND pa.voided = 0
GROUP BY pa.value
ORDER BY patients DESC, pa.value;
```

## Correspondencias conocidas para saneamiento

Estas correspondencias provienen del catálogo OCL de SIHSALUS y deben verificarse contra el diccionario desplegado antes de migrar. Los UUID identifican el concepto objetivo; la migración debe resolver el `concept_id` local correspondiente y guardar ese número:

| Valor legado | Concepto | UUID de concepto |
|---|---|---|
| `PE` | Perú | `e0370dea-d480-4721-a438-97a77d6c3349` |
| `CO` | Colombia | `b4c6023d-4e90-4803-a0cf-b089994a9ba1` |
| `EC` | Ecuador | `f9632879-8b9f-49a3-a049-1ec5347ee1fd` |
| `BR` | Brasil | `c5a98d41-2984-4f92-b731-a83cde65f84d` |
| `BO` | Estado Plurinacional de Bolivia | `9016afdf-94ca-4f3d-b1df-234e131771e2` |
| `CL` | Chile | `e48b90b8-b0ab-4954-a723-9f9319a216ca` |
| `VE` | República Bolivariana de Venezuela | `0a0cfd1b-9e57-47dc-aa3f-3e0bfeb4d4f3` |
| `AR` | Argentina | `e7c09b81-1dee-49f7-980f-0d923f6dfeb3` |
| `US` | Estados Unidos de América | `cb760cd0-e4dd-49cb-86c3-c3d4bde3b230` |

`OTHER`, UUID desconocidos y cualquier valor que no tenga correspondencia inequívoca requieren revisión manual. No deben convertirse automáticamente.

## Migración segura

1. Respaldar la base de datos y conservar el resultado completo de la auditoría.
2. Confirmar que cada UUID objetivo existe, no está retirado y pertenece al conjunto de países en la instancia desplegada.
3. Resolver cada UUID objetivo a su `concept_id` en la misma instancia; no reutilizar IDs numéricos de otro entorno.
4. Implementar la transformación como una migración versionada del contenido/backend, no como una actualización manual desde el frontend.
5. Guardar en `person_attribute.value` el `concept_id` resuelto, no el UUID.
6. Registrar por cada cambio el identificador del atributo, valor anterior, valor nuevo, fecha y responsable de la migración.
7. No modificar valores ambiguos; generar una cola de revisión administrativa.
8. Verificar después de la migración que la API REST devuelve `value.uuid` y `value.display` para nacionalidad.
9. Comparar conteos antes y después y confirmar que no se crearon atributos duplicados activos por persona.

La migración histórica debe aprobarse y ejecutarse dentro del procedimiento operativo de datos clínicos de la institución.
