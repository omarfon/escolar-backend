export interface GradeChangeLogResponse {
  id: number;
  gradeId: number | null;
  studentId: number;
  studentCodigo: string;
  studentNombre: string;
  curso: string;
  componenteCodigo: string;
  bimestre: number;
  nivel: string;
  grado: string;
  seccion: string;
  accion: string;
  actorUserId: number | null;
  actorNombre: string;
  actorRol: string;
  motivo: string;
  cambios: Record<string, { anterior?: unknown; nuevo?: unknown }>;
  ip: string;
  correlationId: string | null;
  resultado: string;
  createdAt: string;
  fechaDisplay: string;
  horaDisplay: string;
}

export interface GradeChangeAuditContext {
  institucion: {
    nombre: string;
    siglas: string;
    anioEscolar: number;
    ugel?: string;
    dre?: string;
  };
  retencionDias: number;
  permisoConsulta: string;
  permisoExportacion: string;
}

export interface GradeAuditContext {
  req?: import('express').Request;
  motivo?: string;
  nivel?: string;
  grado?: string;
  seccion?: string;
}

export interface GradeAuditStudentMeta {
  studentCodigo: string;
  studentNombre: string;
}
