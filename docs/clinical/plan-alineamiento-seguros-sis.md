# Plan de alineamiento: capa de financiador/seguros (SIS)

**Estado:** propuesta para discusión del equipo.
**Fecha:** 2026-07-17.
**Base:** auditoría exhaustiva de frontend, content package/OCL, módulos backend
(FUA, identitylookup) y normativa vigente (referencias al final).

---

## 1. Diagnóstico (lo que hay hoy)

### 1.1 Tres modelos de datos desconectados

| Capa | Qué es | Quién ESCRIBE | Quién LEE |
|---|---|---|---|
| **Persona** | `insuranceType` `56188294-…` (coded, set `6b932638-…`), `insuranceCode` `374b130f-…` (texto), estado acreditación `9b3df0a1-…1005`, checkedAt `…1006` + 16 atributos SETISIS | Registro de pacientes, registro rápido de emergencia | Nadie más |
| **Visita** | `Financiador` `3a988e33-…` (coded), `Número de Seguro` `aac48226-…`, `Estado de Acreditación SIS` `5e13e902-…`, fecha/resultado consulta SIS, contrato/afiliación FUA | **NADIE** | Billing (`usePatientPaymentInfo`), banner del paciente, tags de factura |
| **Obs** | Concepto `161631AAAA…` (CIEL Insurance/payer) | Formulario de consulta externa (form-engine) | Widget "Financiador" de atención ambulatoria |

Consecuencias directas:

- **Billing y el banner muestran siempre vacío**: leen atributos de visita que
  ningún flujo escribe.
- El seguro capturado en registro/emergencia **no llega** a la visita, al FUA
  ni a facturación.
- `care-logbook` detecta SIS con un **regex de texto** (`/sis|seguro integral/i`)
  sobre identificadores.
- El visit attribute `Financiador` apunta al concepto `355ee63a-…`, **que no
  existe** en el content ni en OCL.

### 1.2 Cuatro taxonomías divergentes de financiador

1. Registro: concept set `6b932638-…` (SIS, Particular/Sin seguro, EsSalud,
   Privado, SIS Gratuito/Semicontributivo/Emprendedor, FOSPOLI).
2. Emergencia: **6 conceptos hardcodeados** en config (sin FOSPOLI, sin
   Particular como concepto del set).
3. FUA (types frontend): `'SIS' | 'ESSALUD' | 'PARTICULAR' | 'OTRO'`.
4. Atención ambulatoria: clasificación por **string de display**.

Contra la tipología oficial IAFAS/RIAFAS de SUSALUD **faltan**: EPS, SOAT/AFOCAT,
prepagas, autoseguros, Sanidades FFAA/PNP. Además el set mezcla el financiador
(SIS) con sus planes (SIS Gratuito/Emprendedor/…) en el mismo nivel.

### 1.3 SIS: modelo completo, tubería vacía

- El content define **20 person attributes + 9 visit attributes + 2 identifier
  types** para SETISIS (régimen, plan, contrato DISA-formato-correlativo,
  fechas de afiliación/caducidad, EESS de adscripción, etc.).
- **No existe ningún cliente SETISIS** en ningún repo: nada llena esos campos.
- El lookup del frontend es un **stub que solo corre en `spaEnv==='development'`**
  y que además **no rellena `insuranceType`** — tras "consultar SIS", el campo
  Financiador queda vacío.
- El módulo `identitylookup` cubre solo identidad RENIEC/DNI (mock/apisperu).

### 1.4 FUA: sin gating, sin retry, con riesgo financiero

- La tabla de FUA lista **todas** las visitas y permite generar FUA para
  cualquiera; `sisInsuranceConceptUuid` existe en config pero **nunca se usa**.
- El OMOD vuelca genéricamente todos los atributos/obs al microservicio
  generador; **cero validación de afiliación** server-side.
- Llamadas síncronas sin reintentos; token `fuagentoken: fuagenerator`
  hardcodeado; endpoint default del frontend apunta a un **servidor dev**
  (`gidis-hsc-dev.inf.pucp.edu.pe`).
- Normativamente el FUA tiene **carácter de declaración jurada** y un error en
  los datos de afiliación es causal de **rechazo de pago** → cada FUA generado
  sobre datos de seguro vacíos/incorrectos es riesgo financiero directo.

### 1.5 Offline

- El registro de pacientes entra a la cola offline genérica ✔, pero el lookup
  SIS se deshabilita sin red, el registro de emergencia está `offline: false`,
  y FUA no tiene ningún soporte offline.
- La normativa **asume** conectividad intermitente: FUA físico (papel) es un
  formato plenamente válido, ARFSIS WEB opera fuera de línea con sincronización
  diferida, y el plazo de digitación es contractual (convenio con el SIS).

---

## 2. Principio rector del rediseño

> **El financiador es un dato de LA ATENCIÓN (visita), derivado de la afiliación
> de LA PERSONA, verificado en un MOMENTO con un MÉTODO por un USUARIO.**

Tres capas con contrato explícito:

```text
PERSONA  (afiliación conocida)          VISITA  (financiador de ESTA atención)      FUA
├─ IAFAS (coded, set canónico)          ├─ Financiador (coded, mismo set)  ────────► gating +
├─ Plan/Régimen SIS (coded)             ├─ Número de seguro/contrato                 payload
├─ Código de afiliación                 ├─ Estado de acreditación (coded)
├─ Vigencia (afiliación/caducidad)      ├─ Fecha+hora de verificación
└─ Última verificación (cuándo/cómo)    └─ Método (manual-web | setisis | siteds)
         │                                        ▲
         └── se COPIA al iniciar la visita ───────┘   (editable por Admisión, auditado)
```

Reglas:

- La captura es **diferible y no bloqueante** en emergencia (Ley 27604: la
  atención no se condiciona a trámite alguno). Se completa retroactivamente
  antes del FUA.
- "Sin seguro" es un **estado transitorio** (D.U. 017-2019: afiliación SIS de
  oficio) — el flujo debe dejar el pendiente visible, no normalizarlo.
- Toda verificación queda trazada: estado + fecha/hora + método + usuario. Los
  visit attributes para esto **ya existen en el content** (`Fecha y Hora de
  Consulta SIS`, `Resultado de Consulta SIS`, `Estado de Acreditación SIS`).

---

## 3. Plan de acción por fases

### Fase 0 — Decisión de equipo (la discusión, 1 sesión)

Resolver y congelar:

1. **Catálogo canónico**: ¿extender el set `6b932638-…` existente o crear un set
   nuevo "Financiador (IAFAS)"? **Recomendación: extenderlo** (ya lo usan
   registro y 2 formularios) y separar plan SIS como sub-pregunta (la
   sub-pregunta `Plan de atención SIS` `b76a9a24-…` ya existe).
2. **Contrato visita**: confirmar que el visit attribute `Financiador`
   `3a988e33-…` es la fuente de verdad para billing/FUA/banner, y a qué
   concepto apunta (hoy roto).
3. **Plazo de digitación FUA** del convenio SIS vigente del hospital (la
   directiva nacional lo delega al convenio; no existe un "X días" nacional).

### Fase 1 — Catálogo canónico (content + OCL, ~1 PR)

- Extender el set `6b932638-…` a la tipología IAFAS: añadir **EPS, SOAT/AFOCAT,
  Prepaga, Autoseguro, Sanidad FFAA, Sanidad PNP**; los planes SIS salen del
  primer nivel y quedan solo como respuestas de `Plan de atención SIS`
  (mapeados a la codificación FUA: `2`/`3` subsidiado, `E` temporal,
  `9` Independiente, `R` Emprendedor-NRUS, `8` Microempresas).
- Reparar el visit attribute `Financiador` `3a988e33-…`: repuntear su config al
  set canónico (hoy apunta a `355ee63a-…`, inexistente).
- Nueva versión OCL + zips + suscripción (mismo procedimiento que
  content #158).

### Fase 2 — Escribir el dato donde se lee (frontend, 2-3 PRs)

- **Helper compartido** en `esm-patient-common-lib`:
  `resolveVisitFinanciador(patient)` — lee los person attributes vigentes y los
  copia a los visit attributes al **iniciar la visita** (start-visit form del
  chart, `getOrCreateEmergencyVisit`, admisión por colas). Un solo punto de
  verdad para la copia persona→visita.
- **Emergencia**: dropdown desde el set canónico vía concept (eliminar los 6
  hardcodeados), campo diferible y editable después del triaje.
- **Atención ambulatoria**: el widget Financiador lee el visit attribute; la
  obs `161631` queda deprecada (o espejo temporal durante una versión).
- **Care-logbook**: eliminar el regex; leer el visit attribute.
- Billing y banner empiezan a mostrar datos reales **sin tocarlos** (ya leen
  `3a988e33-…`).

### Fase 3 — Verificación SIS interina por link manual (1 PR)

Mientras no haya convenio/servicio SETISIS:

- Botón **"Verificar SIS"** (registro, admisión, emergencia post-triaje) que:
  1. Copia el DNI al portapapeles y abre
     `https://cel.sis.gob.pe/SisConsultaEnLinea` en pestaña nueva.
  2. Muestra un mini-formulario de resultado: estado (vigente/no vigente),
     plan SIS, EESS de adscripción, código de afiliado.
  3. Al guardar escribe: atributos SETISIS de persona + `insuranceType=SIS`
     (**gap actual: el stub no lo escribe**) + estado de acreditación +
     `checkedAt` + **método = "manual-web"** + usuario.
- El stub `lookupSisInsuranceByDni` queda detrás del mismo contrato para el
  swap futuro a servicio real **sin tocar UI**. Nota: no existe API pública del
  SIS para IPRESS — la integración real requiere convenio con SIS/OGTI; el
  respaldo multi-IAFAS es `app1.susalud.gob.pe/registro` (padrón SUSALUD
  validado contra RENIEC).

### Fase 4 — Offline-first (1-2 PRs + decisión)

- La captura del financiador y el registro del resultado de verificación
  **funcionan sin red**: sin conexión, el estado queda **"Acreditación
  pendiente"** (concepto `…2053`, ya existe) y la visita entra a una **lista de
  trabajo "acreditaciones pendientes"** para Admisión cuando vuelva la red.
- FUA sin red: no generar; la visita queda en estado **Pendiente** (ya existe
  en `fua_estado`) y el respaldo operativo es el **FUA físico + digitación
  diferida** (mecanismo normativo estándar, no excepción).
- Decisión aparte (mayor): habilitar `offline: true` en el registro rápido de
  emergencia.

### Fase 5 — FUA con gating y endurecimiento (1 PR frontend + 1 PR módulo)

- **Solo visitas con Financiador=SIS** aparecen como candidatas a FUA (cablear
  el `sisInsuranceConceptUuid` que hoy está declarado y sin uso, leyendo el
  visit attribute).
- **Advertir/bloquear** la generación si la acreditación está "no vigente" o
  "no consultada" (declaración jurada; error de afiliación = rechazo de pago).
  Con override explícito y auditado para casos de contingencia (FUA papel).
- Sacar el endpoint dev del default de `fuaGeneratorEndpoint`; token del
  microservicio a variable de entorno (hoy hardcodeado en el OMOD).
- Módulo FUA: reintentos automáticos con backoff para el estado Pendiente
  (hoy el "reintento" es manual).

### Fase 6 — RBAC y auditoría (transversal)

- Editar financiador de la visita: solo Admisión (`app:home.admision`) y
  Digitadores FUA; cada cambio con usuario+fecha (los visit attributes de
  OpenMRS ya auditan creator/dateCreated — verificar que la UI no los
  sobreescriba silenciosamente).
- Emergencia: puede **capturar** financiador pero la **verificación** es tarea
  de Admisión (cola de pendientes de Fase 4).

---

## 4. Qué NO hace este plan (limitaciones explícitas)

- **No integra SETISIS/ACE**: no hay API pública documentada del SIS para
  IPRESS; requiere convenio con SIS/OGTI. El plan deja el contrato listo para
  el swap.
- **No implementa FUA digital con firma digital + biometría** (exigencia de la
  Directiva 002-2024 para el formato digital); seguimos en el modelo
  físico/digitación.
- **No resuelve SITEDS** (EPS/privados): fuera de alcance hasta que haya
  convenio con alguna IAFAS privada.
- El plazo exacto de digitación diferida debe confirmarse contra el **convenio
  SIS del hospital** (no existe plazo nacional en la directiva).

## 5. Referencias normativas

| Norma | Qué aporta |
|---|---|
| Ley 29344 (TUO D.S. 020-2014-SA) + D.S. 008-2010-SA | Marco AUS, IAFAS/IPRESS, regímenes |
| D.Leg. 1158 / RIAFAS SUSALUD | Tipología oficial de IAFAS (catálogo canónico) |
| D.U. 017-2019 y D.U. 046-2021 | Afiliación SIS de oficio ("sin seguro" es transitorio) |
| Directiva 002-2024-SIS/GREP-V.02 (R.J. 000178-2024-SIS/J) | FUA vigente: físico y digital, declaración jurada, FUA a la historia clínica, digitación según convenio |
| Directiva 004-2023-SIS/OGTI (R.J. 064-2023-SIS/J) | Gestión de digitación → BD SIS |
| Res. 121-2019 y 072-2021-SUSALUD/S (SITEDS) | Acreditación electrónica IAFAS↔IPRESS |
| Res. 010-2021-SUSALUD/S (RAAUS/SETI-AF) | Padrón nominal de afiliados, validado contra RENIEC |
| NTS 139-MINSA/2018/DGAIN (R.M. 214-2018) | La filiación de la HC **debe** incluir los datos del seguro; el FUA se archiva en la HC |
| Ley 27604 + NT 042-MINSA | Emergencia no se condiciona a trámite/seguro → captura diferible |
| Ley 30024 / D.S. 020-2025-SA / R.M. 164-2025 (RENHICE) | Acreditación futura del HCE e interoperabilidad |

Verificación en línea (interina): `https://cel.sis.gob.pe/SisConsultaEnLinea`
(oficial; devuelve plan y EESS de adscripción). Respaldo:
`https://app1.susalud.gob.pe/registro/`.
