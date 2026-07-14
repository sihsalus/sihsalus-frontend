# E2E clínico seguro

Las pruebas Playwright automatizadas solo pueden ejecutarse contra una instancia **sintética y no productiva**. Está prohibido apuntarlas a producción, a una copia con datos reales o a una cuenta administrativa.

El workflow actual es un **smoke del SPA ya desplegado en `E2E_BASE_URL`**. El paso `build:apps` comprueba que el
código del PR compila, pero ese artefacto no se publica ni es el que abre Playwright. Por tanto, este smoke no debe
presentarse como evidencia funcional del SHA del PR. Para ello hace falta un despliegue efímero (o un marcador de
digest verificable del artefacto desplegado) antes de convertir el E2E en check requerido.

## Entorno protegido de GitHub

El repositorio debe tener un environment denominado `e2e-nonprod` con:

- revisores obligatorios que aprueben el SHA exacto del workflow;
- acceso restringido a las ramas autorizadas;
- secretos `E2E_USERNAME` y `E2E_PASSWORD` de una cuenta sintética de mínimo privilegio;
- rotación periódica y auditoría de uso de esa cuenta.

La aprobación es necesaria porque el paso Playwright ejecuta código del PR con acceso temporal a esas credenciales. Instalación y compilación se ejecutan sin secretos.

Variables del environment:

| Variable                          | Contrato                                                  |
| --------------------------------- | --------------------------------------------------------- |
| `E2E_BASE_URL`                    | URL HTTPS del SPA sintético                               |
| `E2E_API_BASE_URL`                | URL HTTPS de OpenMRS sintético                            |
| `E2E_ALLOWED_HOSTS`               | Lista separada por comas de hostnames exactos autorizados |
| `E2E_TARGET_KIND`                 | Debe ser exactamente `synthetic-nonprod`                  |
| `E2E_LOGIN_DEFAULT_LOCATION_UUID` | UUID de una ubicación sintética accesible a la cuenta     |
| `E2E_PATIENT_UUID`                | UUID de un paciente odontológico exclusivamente sintético |
| `E2E_APPOINTMENTS_PATIENT_UUID`   | UUID de un paciente de citas exclusivamente sintético     |

El workflow falla antes de instalar dependencias si el destino no cumple estos controles. La ubicación configurada tampoco tiene fallback: una configuración incorrecta debe fallar de forma visible.

## Datos y privilegios

- Crear pacientes, visitas y encounters exclusivamente sintéticos y eliminables.
- Conceder solo los privilegios requeridos por los recorridos cubiertos; nunca usar `admin` ni un rol equivalente.
- Usar `E2E_PROVIDER_QUERY` para identificar un proveedor sintético cuando una suite modular lo requiera.
- Proporcionar pacientes de captura mediante `E2E_SCREENSHOT_FEMALE_PATIENT_UUID`, `E2E_SCREENSHOT_CHILD_PATIENT_UUID` o `E2E_PATIENT_UUIDS`; no registrar nombres ni UUIDs de pacientes reales en Git.
- Los reportes, capturas y trazas se conservan tres días y solo pueden contener datos sintéticos.

## Ejecución local

```bash
E2E_BASE_URL=https://e2e.example.invalid/openmrs/spa \
E2E_API_BASE_URL=https://e2e.example.invalid/openmrs \
E2E_LOGIN_DEFAULT_LOCATION_UUID=00000000-0000-4000-8000-000000000000 \
E2E_PATIENT_UUID=00000000-0000-4000-8000-000000000001 \
E2E_APPOINTMENTS_PATIENT_UUID=00000000-0000-4000-8000-000000000002 \
E2E_USERNAME=synthetic-e2e \
E2E_PASSWORD='...' \
yarn test:e2e
```

No guardar estas credenciales en archivos versionados ni en comandos compartidos. El workflow se activa manualmente o mediante la etiqueta `e2e`; cada nuevo commit requiere una nueva aprobación del environment.

## Acción operativa por credencial histórica

El repositorio contuvo anteriormente credenciales administrativas predeterminadas en scripts E2E. Aunque ya no están en el árbol actual, permanecen en el historial Git. La cuenta correspondiente debe considerarse expuesta: rotar o deshabilitarla en todos los entornos, revisar sus eventos de auditoría y no reutilizar la nueva clave en ningún secreto del repositorio.
