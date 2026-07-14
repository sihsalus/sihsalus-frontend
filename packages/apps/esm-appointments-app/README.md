# esm-appointments-app

App para la gestión de citas y agenda del paciente.

Terminología de dominio: visita = consulta, encounter = atención, appointment = cita.

## Marco normativo
- Ley N.° 26842, Ley General de Salud (Perú).

## Límites funcionales
- Crea, consulta, reprograma y cancela citas.
- Organiza vistas de calendario, carga de trabajo y citas del paciente.
- No gestiona admisión, registro demográfico ni atención clínica directa.
- No administra reglas generales del hospital fuera del ciclo de citas.

## Integraciones
- APIs de agenda, citas y paciente.
- Componentes de calendario, formularios y estado compartido.
- Integración con el flujo de búsqueda de paciente cuando aplica.

## Privilegios sensibles
- La fecha de emisión de una cita es de solo lectura por defecto.
- Editarla requiere el privilegio `app:appointments.issueDate.edit`; los usuarios sin ese privilegio conservan la fecha original también en el payload enviado.
