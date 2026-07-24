/** Alumno vinculado al usuario demo de login (username: estudiante). */
export const DEMO_LOGIN_STUDENT_EMAIL = 'estudiante@escolar.pe';

export interface DemoAttendanceSeed {
  fecha: string;
  estado: 'P' | 'F' | 'T' | 'J';
  observacion?: string;
}

/** Asistencias del año escolar actual para el alumno demo (Primaria 5° A). */
export const DEMO_STUDENT_ATTENDANCES_2026: DemoAttendanceSeed[] = [
  { fecha: '2026-03-03', estado: 'P' },
  { fecha: '2026-03-04', estado: 'P' },
  { fecha: '2026-03-05', estado: 'T', observacion: 'Ingreso 8 minutos tarde' },
  { fecha: '2026-03-06', estado: 'P' },
  { fecha: '2026-03-09', estado: 'P' },
  { fecha: '2026-03-10', estado: 'F', observacion: 'Malestar estomacal' },
  { fecha: '2026-03-11', estado: 'J', observacion: 'Justificada por cita médica' },
  { fecha: '2026-03-12', estado: 'P' },
  { fecha: '2026-03-13', estado: 'P' },
  { fecha: '2026-04-01', estado: 'P' },
  { fecha: '2026-04-02', estado: 'P' },
  { fecha: '2026-04-03', estado: 'T', observacion: 'Tardanza por tráfico' },
  { fecha: '2026-04-06', estado: 'P' },
  { fecha: '2026-04-07', estado: 'P' },
  { fecha: '2026-04-08', estado: 'P' },
  { fecha: '2026-04-09', estado: 'F', observacion: 'Inasistencia sin justificar' },
  { fecha: '2026-04-10', estado: 'P' },
  { fecha: '2026-05-05', estado: 'P' },
  { fecha: '2026-05-06', estado: 'P' },
  { fecha: '2026-05-07', estado: 'T', observacion: 'Ingreso 12 minutos tarde' },
  { fecha: '2026-05-08', estado: 'P' },
  { fecha: '2026-05-09', estado: 'F', observacion: 'Malestar estomacal' },
  { fecha: '2026-05-12', estado: 'J', observacion: 'Justificada por cita médica' },
  { fecha: '2026-05-13', estado: 'P' },
  { fecha: '2026-05-14', estado: 'P' },
  { fecha: '2026-05-15', estado: 'P' },
  { fecha: '2026-06-01', estado: 'P' },
  { fecha: '2026-06-02', estado: 'T', observacion: 'Ingreso 10 minutos tarde' },
  { fecha: '2026-06-03', estado: 'P' },
  { fecha: '2026-06-04', estado: 'P' },
  { fecha: '2026-06-05', estado: 'F', observacion: 'Malestar general' },
  { fecha: '2026-06-08', estado: 'J', observacion: 'Justificada con constancia médica' },
  { fecha: '2026-06-09', estado: 'P' },
  { fecha: '2026-06-10', estado: 'P' },
  { fecha: '2026-06-11', estado: 'T', observacion: 'Tardanza por tráfico' },
  { fecha: '2026-06-12', estado: 'P' },
  { fecha: '2026-07-01', estado: 'P' },
  { fecha: '2026-07-02', estado: 'P' },
  { fecha: '2026-07-03', estado: 'P' },
  { fecha: '2026-07-07', estado: 'P' },
  { fecha: '2026-07-08', estado: 'T', observacion: 'Ingreso 5 minutos tarde' },
  { fecha: '2026-07-09', estado: 'P' },
  { fecha: '2026-07-10', estado: 'P' },
  { fecha: '2026-07-11', estado: 'P' },
  { fecha: '2026-07-14', estado: 'P' },
  { fecha: '2026-07-15', estado: 'P' },
  { fecha: '2026-07-16', estado: 'P' },
  { fecha: '2026-07-17', estado: 'P' },
  { fecha: '2026-07-18', estado: 'P' },
];
