export interface DateFilterContext {
  dateRange: Date[];
  setDateRange: (dateRange: Date[]) => void;
  dateFilterMode: FuaDateFilterMode;
  setDateFilterMode: (dateFilterMode: FuaDateFilterMode) => void;
}

export type FuaDateFilterMode = 'none' | 'created' | 'updated' | 'both';

// FUA status lifecycle
export type FuaEstado = 'PENDIENTE' | 'EN_PROCESO' | 'ENVIADO_SETI_SIS' | 'COMPLETADO' | 'RECHAZADO' | 'CANCELADO';

export type SeguroTipo = 'SIS' | 'ESSALUD' | 'PARTICULAR' | 'OTRO';

export type TipoDiagnostico = 'PRINCIPAL' | 'SECUNDARIO';

export type CondicionDiagnostico = 'NUEVO' | 'REPETICION';

// ─── FUA domain types ─────────────────────────────────────────────────────────

export interface FuaPaciente {
  nombres: string;
  apellidos: string;
  tipoDocumento: 'DNI' | 'CE' | 'PASAPORTE' | 'DIE' | 'CNV';
  numeroDocumento: string;
  fechaNacimiento: string; // ISO date
  sexo: 'M' | 'F';
  telefono?: string;
  direccion?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
}

export interface FuaSeguro {
  tipo: SeguroTipo;
  numeroAfiliacion?: string;
  regimenSIS?: string;
  ipress?: string;
}

export interface FuaEncuentro {
  encounterUuid: string;
  visitUuid?: string;
  encounterType: string;
  fechaAtencion: string; // ISO datetime
  medicoUuid: string;
  medicoNombre?: string;
  establecimientoUuid?: string;
}

export interface FuaDiagnostico {
  cie10Code: string;
  cie10Display: string;
  tipoDiagnostico: TipoDiagnostico;
  condicion: CondicionDiagnostico;
}

export interface FuaProcedimiento {
  codigoProcedimiento: string;
  descripcion: string;
  cantidad: number;
}

export interface FuaPrescripcion {
  medicamento: string;
  dosis: string;
  frecuencia: string;
  duracion: string;
  cantidad: number;
}

export interface FuaReferencia {
  motivoReferencia: string;
  establecimientoDestino: string;
}

export interface FuaPayload {
  paciente: FuaPaciente;
  seguro: FuaSeguro;
  encuentro: FuaEncuentro;
  diagnosticos: FuaDiagnostico[];
  procedimientos: FuaProcedimiento[];
  prescripciones: FuaPrescripcion[];
  referencia?: FuaReferencia;
}

export interface FuaRequest {
  id: string;
  uuid: string;
  estado: FuaEstado;
  patientUuid: string;
  visitUuid?: string;
  encounterUuid?: string;
  payload?: FuaPayload | string;
  createdAt: string;
  updatedAt?: string;
  submittedAt?: string;
  createdBy?: string;
}
