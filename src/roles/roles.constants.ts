export interface PermissionDef {
  codigo: string;
  label: string;
}

export interface SectionDef {
  modulo: string;
  icono: string;
  permisos: PermissionDef[];
}

export const PERMISSION_SECTIONS: SectionDef[] = [
  {
    modulo: 'Dashboard',
    icono: 'dashboard',
    permisos: [
      { codigo: 'dashboard.ver', label: 'Ver panel principal' },
      { codigo: 'dashboard.kpis', label: 'Ver KPIs y estadisticas' },
      { codigo: 'dashboard.reportes', label: 'Ver reportes resumidos' },
    ],
  },
  {
    modulo: 'Matricula',
    icono: 'how_to_reg',
    permisos: [
      { codigo: 'matricula.ver', label: 'Ver lista de matriculas' },
      { codigo: 'matricula.crear', label: 'Registrar nueva matricula' },
      { codigo: 'matricula.editar', label: 'Editar matricula existente' },
      { codigo: 'matricula.anular', label: 'Anular / eliminar matricula' },
      { codigo: 'matricula.vacantes', label: 'Gestionar vacantes' },
      { codigo: 'matricula.exportar', label: 'Exportar datos' },
      { codigo: 'matricula.aprobar', label: 'Aprobar matricula por continuidad' },
    ],
  },
  {
    modulo: 'Asistencia',
    icono: 'fact_check',
    permisos: [
      { codigo: 'asistencia.ver', label: 'Ver registros de asistencia' },
      { codigo: 'asistencia.registrar', label: 'Registrar asistencia' },
      { codigo: 'asistencia.editar', label: 'Corregir asistencia' },
      { codigo: 'asistencia.reportes', label: 'Ver reportes de asistencia' },
      { codigo: 'asistencia.exportar', label: 'Exportar asistencia' },
    ],
  },
  {
    modulo: 'Evaluacion',
    icono: 'grading',
    permisos: [
      { codigo: 'evaluacion.ver', label: 'Ver notas y calificaciones' },
      { codigo: 'evaluacion.registrar', label: 'Registrar notas' },
      { codigo: 'evaluacion.editar', label: 'Editar notas existentes' },
      { codigo: 'evaluacion.aprobar', label: 'Aprobar/cerrar periodo' },
      { codigo: 'evaluacion.reportes', label: 'Ver reportes de notas' },
      { codigo: 'evaluacion.exportar', label: 'Exportar notas' },
    ],
  },
  {
    modulo: 'Tesoreria',
    icono: 'payments',
    permisos: [
      { codigo: 'tesoreria.ver', label: 'Ver pagos y deudas' },
      { codigo: 'tesoreria.registrar', label: 'Registrar pagos' },
      { codigo: 'tesoreria.editar', label: 'Editar / anular pagos' },
      { codigo: 'tesoreria.conceptos', label: 'Gestionar conceptos de pago' },
      { codigo: 'tesoreria.reportes', label: 'Ver reportes financieros' },
      { codigo: 'tesoreria.exportar', label: 'Exportar reportes' },
    ],
  },
  {
    modulo: 'Estudiantes',
    icono: 'groups',
    permisos: [
      { codigo: 'estudiantes.ver', label: 'Ver lista de estudiantes' },
      { codigo: 'estudiantes.crear', label: 'Registrar estudiante' },
      { codigo: 'estudiantes.editar', label: 'Editar datos de estudiante' },
      { codigo: 'estudiantes.eliminar', label: 'Eliminar estudiante' },
      { codigo: 'estudiantes.expediente', label: 'Ver expediente completo' },
      { codigo: 'estudiantes.exportar', label: 'Exportar padron' },
    ],
  },
  {
    modulo: 'Docentes',
    icono: 'school',
    permisos: [
      { codigo: 'docentes.ver', label: 'Ver lista de docentes' },
      { codigo: 'docentes.crear', label: 'Registrar docente' },
      { codigo: 'docentes.editar', label: 'Editar datos de docente' },
      { codigo: 'docentes.horario', label: 'Ver y asignar horarios' },
    ],
  },
  {
    modulo: 'Horarios',
    icono: 'schedule',
    permisos: [
      { codigo: 'horarios.ver', label: 'Ver horarios' },
      { codigo: 'horarios.crear', label: 'Crear / editar horarios' },
      { codigo: 'horarios.publicar', label: 'Publicar horarios' },
    ],
  },
  {
    modulo: 'Comunicados',
    icono: 'campaign',
    permisos: [
      { codigo: 'comunicados.ver', label: 'Ver comunicados y mensajes' },
      { codigo: 'comunicados.enviar', label: 'Enviar comunicados' },
      { codigo: 'comunicados.eliminar', label: 'Eliminar comunicados' },
    ],
  },
  {
    modulo: 'Biblioteca',
    icono: 'menu_book',
    permisos: [
      { codigo: 'biblioteca.ver', label: 'Ver catalogo' },
      { codigo: 'biblioteca.gestionar', label: 'Gestionar libros y prestamos' },
    ],
  },
  {
    modulo: 'Administracion',
    icono: 'admin_panel_settings',
    permisos: [
      { codigo: 'admin.usuarios', label: 'Gestionar usuarios' },
      { codigo: 'admin.roles', label: 'Gestionar roles y permisos' },
      { codigo: 'admin.institucional', label: 'Configuracion institucional' },
      { codigo: 'admin.reportes', label: 'Reportes administrativos' },
    ],
  },
];

export const ALL_PERMISSION_CODES = PERMISSION_SECTIONS.flatMap((s) =>
  s.permisos.map((p) => p.codigo),
);

export const ROLE_DEFINITIONS = [
  {
    codigo: 'ADMIN',
    label: 'Administrador',
    descripcion: 'Acceso total al sistema sin restricciones',
    color: 'bg-indigo-600',
    esAdmin: true,
    orden: 0,
    permisos: ALL_PERMISSION_CODES,
  },
  {
    codigo: 'DIRECTOR',
    label: 'Director',
    descripcion: 'Acceso completo excepto configuracion de sistema',
    color: 'bg-blue-600',
    esAdmin: false,
    orden: 1,
    permisos: ALL_PERMISSION_CODES.filter((p) => !p.startsWith('admin.')),
  },
  {
    codigo: 'DOCENTE',
    label: 'Docente',
    descripcion: 'Gestion academica: asistencia, notas y horarios',
    color: 'bg-teal-500',
    esAdmin: false,
    orden: 2,
    permisos: [
      'dashboard.ver', 'asistencia.ver', 'asistencia.registrar', 'asistencia.editar',
      'evaluacion.ver', 'evaluacion.registrar', 'evaluacion.editar', 'evaluacion.reportes',
      'horarios.ver', 'comunicados.ver', 'comunicados.enviar', 'estudiantes.ver', 'estudiantes.expediente',
    ],
  },
  {
    codigo: 'SECRETARIA',
    label: 'Secretaria',
    descripcion: 'Matriculas, estudiantes y comunicaciones',
    color: 'bg-pink-500',
    esAdmin: false,
    orden: 3,
    permisos: [
      'dashboard.ver', 'matricula.ver', 'matricula.crear', 'matricula.editar', 'matricula.vacantes', 'matricula.exportar',
      'estudiantes.ver', 'estudiantes.crear', 'estudiantes.editar', 'estudiantes.expediente',
      'asistencia.ver', 'asistencia.reportes', 'comunicados.ver', 'comunicados.enviar',
    ],
  },
  {
    codigo: 'TESORERO',
    label: 'Tesorero',
    descripcion: 'Control de pagos, deudas y reportes financieros',
    color: 'bg-amber-500',
    esAdmin: false,
    orden: 4,
    permisos: [
      'dashboard.ver', 'tesoreria.ver', 'tesoreria.registrar', 'tesoreria.editar', 'tesoreria.conceptos',
      'tesoreria.reportes', 'tesoreria.exportar', 'estudiantes.ver',
    ],
  },
  {
    codigo: 'PADRE',
    label: 'Padre / Madre',
    descripcion: 'Consulta de notas, asistencia y comunicados de su hijo',
    color: 'bg-orange-500',
    esAdmin: false,
    orden: 5,
    permisos: ['dashboard.ver', 'asistencia.ver', 'evaluacion.ver', 'comunicados.ver', 'tesoreria.ver'],
  },
  {
    codigo: 'ESTUDIANTE',
    label: 'Estudiante',
    descripcion: 'Acceso a sus propias notas, horario y comunicados',
    color: 'bg-green-500',
    esAdmin: false,
    orden: 6,
    permisos: ['dashboard.ver', 'asistencia.ver', 'evaluacion.ver', 'horarios.ver', 'comunicados.ver', 'biblioteca.ver'],
  },
  {
    codigo: 'BIBLIOTECARIO',
    label: 'Bibliotecario',
    descripcion: 'Gestion del catalogo y prestamos de biblioteca',
    color: 'bg-purple-500',
    esAdmin: false,
    orden: 7,
    permisos: ['dashboard.ver', 'biblioteca.ver', 'biblioteca.gestionar', 'comunicados.ver'],
  },
] as const;
