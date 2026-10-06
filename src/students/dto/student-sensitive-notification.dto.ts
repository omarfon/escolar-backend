export interface StudentSensitiveNotificationContext {
  institucion: {
    nombre: string;
    siglas: string;
    anioEscolar: number;
    ugel?: string;
    dre?: string;
  };
  retencionDias: number;
  permisoConsulta: string;
  notificacionesActivas: boolean;
  camposSensibles: { campo: string; label: string }[];
}

export interface StudentSensitiveNotificationResponse {
  id: number;
  studentChangeLogId: number | null;
  studentId: number;
  studentNombre: string;
  studentCodigo: string;
  camposNotificados: string[];
  camposLabels: string[];
  correoDestino: string;
  correoEnviado: boolean;
  canal: string;
  actorNombre: string;
  actorRol: string;
  motivo: string;
  correlationId: string | null;
  ip: string;
  createdAt: string;
  fechaDisplay: string;
  horaDisplay: string;
}
