# Identidad en la consulta e importación Dyaku

## Alcance

El módulo consulta `Patient` por HTTP FHIR y permite importar datos demográficos
mediante el REST e IdGen existentes de OpenMRS. El lote procesa como máximo la
primera página solicitada; no representa una sincronización de todo el padrón.
No implementa IPS, acreditación SIHCE, consentimiento RENHICE ni firma digital.
La autorización institucional para importar desde la fuente configurada debe
verificarse por separado; no se realizó ninguna importación remota al desarrollar
esta corrección.

## Contrato de identidad

- Se acepta un único DNI de exactamente ocho dígitos, sin recortar, quitar
  caracteres ni inferir un dígito verificador. Esta restricción corresponde al
  tipo DNI de SIHSALUS content (`^[0-9]{8}$`), no a una validación de RENIEC.
- Debe estar identificado por el sistema legado
  `urn:oid:2.16.840.1.113883.3.9143.2.1.5`, o por el tipo oficial
  `https://www.gob.pe/minsa/RENHICE/fhir/CodeSystem/IdspersonaPeru` con código `1`.
  Un código `DNI` sin sistema, otro documento o el primer identificador arbitrario
  no bastan. Identificadores DNI contradictorios bloquean la importación.
- La referencia del tipo oficial es la [guía MINSA
  PacientePe](https://dyaku.minsa.gob.pe/guides/StructureDefinition-PacientePe.html),
  versión de desarrollo `0.1`, publicada el 19 de junio de 2026. Reconocer ese
  código no significa validar todo el perfil ni su vigencia legal.
- La búsqueda local usa `identifier` (exacto por defecto en REST), red fresca y
  rechazo de errores de autenticación; verifica el tipo configurado en la respuesta. Solo una lista vacía válida confirma ausencia.
  Errores, respuestas incompletas, paginación pendiente, pacientes anulados,
  coincidencias parciales, otro tipo de documento o múltiples resultados bloquean
  la escritura y requieren revisión. No se elige el primer resultado.
- Los botones de la tabla resuelven al paciente por el ID estable de la fila,
  también después de ordenar. Una fila con ID ambiguo no ofrece importación.
- Todos los registros con un DNI o ID de origen repetido en el lote se bloquean
  antes de escribir. Un bloqueo temporal en memoria evita procesar concurrentemente
  el mismo DNI en esta instancia del navegador; no conserva datos entre sesiones.
  La unicidad entre clientes sigue siendo responsabilidad del backend.

## Persistencia y conservación de datos

Al crear se exige nombre, apellido, sexo y fecha de nacimiento completa válida.
Solo después de validar identidad y metadatos se solicita un HCE a IdGen.
Una respuesta inválida de IdGen impide crear al paciente. Si luego falla la
creación, el identificador podría haberse consumido: no se reutiliza ni se intenta
revertir desde el frontend.

Al actualizar no se envía la colección de identificadores ni se solicita otro HCE.
Se envían únicamente los campos demográficos presentes y válidos en el origen;
no se envían `null`, nombres vacíos, sexo por defecto ni listas de atributos vacías
para reemplazar los datos ausentes. Una identidad ya existente sin nuevos campos
no necesita un POST. Las diferencias entre valores presentes continúan siguiendo
la actualización demográfica del importador existente; no se añade resolución
clínica de conflictos, fusión de pacientes ni promociones de personas.

El tipo de identificador se consulta antes de crear. `NOT_USED` omite ubicación;
`REQUIRED` usa únicamente el UUID configurado si una consulta confirma que existe
y está activo. Una política desconocida o una ubicación no verificada bloquean
la creación; nunca se selecciona `locations[0]` ni una ubicación de respaldo.
Los UUID siguen perteneciendo a `config-schema`.

El guardado solo se informa como confirmado cuando REST devuelve éxito y UUID
válido (el mismo en una actualización). Una respuesta fallida o perdida no prueba
que el servidor haya descartado la escritura. No hay reintentos automáticos:
se pide revisar el registro local, y cualquier nuevo intento repite la búsqueda.
Los errores visibles son mensajes controlados traducidos a español e inglés;
no incluyen identificadores de pacientes, DNI, nombres, URLs ni errores crudos.

## Validación

Las pruebas usan datos sintéticos y simulan REST/FHIR: DNI sin modificación,
tipos explícitos, búsquedas 401/403/500, ambigüedad, paginación, respuestas
inválidas, conservación de identificadores y campos ausentes, ubicación,
respuestas de IdGen/guardado, duplicados de lote, concurrencia y errores visibles.

```sh
yarn workspace @sihsalus/esm-dyaku-app test
yarn workspace @sihsalus/esm-dyaku-app lint
yarn workspace @sihsalus/esm-dyaku-app typescript
yarn build --filter=@sihsalus/esm-dyaku-app... --concurrency=2
```

Pendiente antes de desplegar: revisión humana del cambio y pruebas con datos
sintéticos en DEV/QLTY que confirmen las representaciones REST y la conservación
de datos de OpenMRS. Pruebas unitarias y compilación no acreditan interoperabilidad
RENHICE ni autorización para transferir datos desde un servidor real.
