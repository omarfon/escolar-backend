import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Student, RepresentanteData } from '../students/entities/student.entity';
import { StudentDocument } from '../students/entities/student-document.entity';
import { StudentAcademicHistory } from '../students/entities/student-academic-history.entity';
import { Course } from '../courses/entities/course.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import { Grade } from '../grades/entities/grade.entity';
import { Attendance } from '../attendances/entities/attendance.entity';
import { AttendanceJustification } from '../attendances/entities/attendance-justification.entity';
import { AttendanceAlertSettings } from '../attendances/entities/attendance-alert-settings.entity';
import { Task } from '../tasks/entities/task.entity';
import { Announcement } from '../announcements/entities/announcement.entity';
import { Institution } from '../institution/entities/institution.entity';
import { Campus } from '../institution/entities/campus.entity';
import { EducationLevel } from '../institution/entities/education-level.entity';
import { GradeLevel } from '../institution/entities/grade-level.entity';
import { GradeSection } from '../institution/entities/grade-section.entity';
import { User, UserEstado, UserRole } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { Permission } from '../roles/entities/permission.entity';
import { RolePermission } from '../roles/entities/role-permission.entity';
import { PERMISSION_SECTIONS, ROLE_DEFINITIONS } from '../roles/roles.constants';
import { In } from 'typeorm';
import { WaitlistEntry } from '../waitlist/entities/waitlist-entry.entity';
import { ActasService } from '../actas/actas.service';
import { EvaluationActa } from '../actas/entities/evaluation-acta.entity';
import { SchoolEvent } from '../events/entities/school-event.entity';
import { TeacherResource } from '../resources/entities/teacher-resource.entity';
import { ParentStudent } from '../parents/entities/parent-student.entity';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';
import { ConductIncident } from '../conduct-incidents/entities/conduct-incident.entity';
import { Classroom } from '../classrooms/entities/classroom.entity';
import {
  defaultAforoForNivel,
  gradoInstitucionalToMatricula,
} from '../classrooms/classrooms.util';

@Injectable()
export class DatabaseSeedService implements OnModuleInit {
  constructor(
    private readonly dataSource: DataSource,
    private readonly actasService: ActasService,
  ) {}

  private studentId = 5;

  async onModuleInit(): Promise<void> {
    await this.seedStudents();
    await this.seedExpedientes();
    await this.ensureStudentRepresentatives();
    await this.ensureConductIncidents();
    await this.seedCourses();
    await this.seedSchedules();
    await this.seedGrades();
    await this.seedAttendances();
    await this.seedJustifications();
    await this.seedAttendanceAlertSettings();
    await this.seedTasks();
    await this.seedAnnouncements();
    await this.seedInstitution();
    await this.seedEducationLevels();
    await this.seedClassrooms();
    await this.seedRoles();
    await this.seedUsers();
    await this.seedWaitlist();
    await this.seedActas();
    await this.seedEvents();
    await this.seedResources();
    await this.seedParentStudents();
    await this.seedAuditLogs();
  }

  private async seedWaitlist() {
    const repo = this.dataSource.getRepository(WaitlistEntry);
    if (await repo.count()) return;

    const entries = [
      { nombres: 'Alejandro', apellidos: 'Garcia Lopez', dni: '72345678', email: 'a.garcia.espera@escolar.pe', telefono: '987111001', nivel: 'Primaria', grado: '1°', prioridad: 'alta' as const, estado: 'en_espera' as const, fechaSolicitud: new Date('2026-06-01') },
      { nombres: 'Camila', apellidos: 'Rodriguez Vega', dni: '72345679', email: 'c.rodriguez.espera@escolar.pe', telefono: '987111002', nivel: 'Primaria', grado: '1°', prioridad: 'alta' as const, estado: 'en_espera' as const, fechaSolicitud: new Date('2026-06-02') },
      { nombres: 'Diego', apellidos: 'Mendoza Quispe', dni: '72345680', email: 'd.mendoza.espera@escolar.pe', telefono: '987111003', nivel: 'Secundaria', grado: '2°', prioridad: 'media' as const, estado: 'notificado' as const, notificadoAt: new Date('2026-06-10'), fechaSolicitud: new Date('2026-06-03') },
      { nombres: 'Valentina', apellidos: 'Torres Garcia', dni: '72345681', email: 'v.torres.espera@escolar.pe', telefono: '987111004', nivel: 'Primaria', grado: '2°', prioridad: 'media' as const, estado: 'en_espera' as const, fechaSolicitud: new Date('2026-06-04') },
      { nombres: 'Roberto', apellidos: 'Herrera Cruz', dni: '72345682', email: 'r.herrera.espera@escolar.pe', telefono: '987111005', nivel: 'Secundaria', grado: '1°', prioridad: 'baja' as const, estado: 'en_espera' as const, fechaSolicitud: new Date('2026-06-05') },
      { nombres: 'Sofia', apellidos: 'Diaz Morales', dni: '72345683', email: 's.diaz.espera@escolar.pe', telefono: '987111006', nivel: 'Inicial', grado: '1°', prioridad: 'alta' as const, estado: 'en_espera' as const, fechaSolicitud: new Date('2026-06-06') },
      { nombres: 'Mateo', apellidos: 'Lopez Torres', dni: '72345684', email: 'm.lopez.espera@escolar.pe', telefono: '987111007', nivel: 'Primaria', grado: '5°', prioridad: 'media' as const, estado: 'en_espera' as const, fechaSolicitud: new Date('2026-06-07') },
      { nombres: 'Luna', apellidos: 'Ramos Quispe', dni: '72345687', email: 'l.ramos.espera@escolar.pe', telefono: '987111010', nivel: 'Primaria', grado: '1°', prioridad: 'media' as const, estado: 'asignado' as const, asignadoAt: new Date('2026-06-12'), fechaSolicitud: new Date('2026-06-10') },
    ];

    for (const entry of entries) {
      await repo.save(repo.create(entry));
    }
  }

  private async seedRoles() {
    const roleRepo = this.dataSource.getRepository(Role);
    const permRepo = this.dataSource.getRepository(Permission);
    const rpRepo = this.dataSource.getRepository(RolePermission);

    let orden = 0;
    for (const section of PERMISSION_SECTIONS) {
      for (const p of section.permisos) {
        const exists = await permRepo.findOneBy({ codigo: p.codigo });
        if (!exists) {
          await permRepo.save(
            permRepo.create({
              codigo: p.codigo,
              label: p.label,
              modulo: section.modulo,
              icono: section.icono,
              orden: orden++,
            }),
          );
        }
      }
    }

    for (const def of ROLE_DEFINITIONS) {
      let role = await roleRepo.findOneBy({ codigo: def.codigo });
      if (!role) {
        role = await roleRepo.save(
          roleRepo.create({
            codigo: def.codigo,
            label: def.label,
            descripcion: def.descripcion,
            color: def.color,
            esAdmin: def.esAdmin,
            orden: def.orden,
          }),
        );
      }

      const rpCount = await rpRepo.count({ where: { roleId: role.id } });
      if (rpCount === 0) {
        const perms = await permRepo.find({
          where: { codigo: In([...def.permisos]) },
        });
        for (const perm of perms) {
          await rpRepo.save(
            rpRepo.create({ roleId: role.id, permissionId: perm.id }),
          );
        }
      } else {
        await this.syncRolePermissions(role.id, def.permisos, permRepo, rpRepo);
      }
    }
  }

  private async syncRolePermissions(
    roleId: number,
    permisosCodigos: readonly string[],
    permRepo: ReturnType<DataSource['getRepository']>,
    rpRepo: ReturnType<DataSource['getRepository']>,
  ) {
    const perms = await permRepo.find({
      where: { codigo: In([...permisosCodigos]) },
    });
    for (const perm of perms) {
      const exists = await rpRepo.findOne({
        where: { roleId, permissionId: perm.id },
      });
      if (!exists) {
        await rpRepo.save(rpRepo.create({ roleId, permissionId: perm.id }));
      }
    }
  }

  private async seedStudents() {
    const repo = this.dataSource.getRepository(Student);
    if (await repo.count()) {
      const existing = await repo.findOneBy({ email: 'estudiante@escolar.pe' });
      if (existing) this.studentId = existing.id;
      await this.seedDemoStudents(repo);
      return;
    }
    const saved = await repo.save({
      nombre: 'Juan',
      apellido: 'Perez',
      email: 'estudiante@escolar.pe',
      nivel: 'Primaria',
      grado: '5°',
      seccion: 'A',
      activo: true,
      codigo: '2026-001',
      dni: '71234567',
      fechaNac: '2012-05-14',
      sexo: 'M',
      direccion: 'Av. Los Heroes 234, SJM',
      grupoSanguineo: 'O+',
      alergias: 'Ninguna',
      anioIngreso: '2018',
      estadoMatricula: 'activo',
      conductaNota: 'A',
      padre: {
        nombres: 'Carlos',
        apellidos: 'Perez',
        dni: '40123456',
        telefono: '987001001',
        email: 'cperez@gmail.com',
        trabajo: 'Ingeniero',
      },
      madre: {
        nombres: 'Rosa',
        apellidos: 'Mamani',
        dni: '40123457',
        telefono: '987001002',
        email: 'rmamani@gmail.com',
        trabajo: 'Enfermera',
      },
      apoderado: {
        nombres: '',
        apellidos: '',
        dni: '',
        telefono: '',
        email: '',
        trabajo: '',
      },
    });
    this.studentId = saved.id;
    await this.seedDemoStudents(repo);
  }

  private async seedDemoStudents(repo: import('typeorm').Repository<Student>) {
    const demo = [
      { nombre: 'Lucia', apellido: 'Torres Vega', email: 'l.torres@estudiante.pe', nivel: 'Primaria', grado: '5°', seccion: 'A', activo: true },
      { nombre: 'Carlos', apellido: 'Mendoza Ruiz', email: 'c.mendoza@estudiante.pe', nivel: 'Primaria', grado: '5°', seccion: 'A', activo: true },
      { nombre: 'Ana', apellido: 'Garcia Lima', email: 'a.garcia@estudiante.pe', nivel: 'Primaria', grado: '5°', seccion: 'B', activo: true },
      { nombre: 'Jose', apellido: 'Paredes Cano', email: 'j.paredes@estudiante.pe', nivel: 'Primaria', grado: '5°', seccion: 'B', activo: true },
      { nombre: 'Maria', apellido: 'Quispe Rojas', email: 'm.quispe@estudiante.pe', nivel: 'Primaria', grado: '4°', seccion: 'A', activo: true },
      { nombre: 'Luis', apellido: 'Castillo Vera', email: 'l.castillo@estudiante.pe', nivel: 'Primaria', grado: '4°', seccion: 'A', activo: true },
      { nombre: 'Sofia', apellido: 'Ramos Cruz', email: 's.ramos@estudiante.pe', nivel: 'Secundaria', grado: '2°', seccion: 'A', activo: true },
      { nombre: 'Diego', apellido: 'Fernandez Mar', email: 'd.fernandez@estudiante.pe', nivel: 'Secundaria', grado: '2°', seccion: 'B', activo: true },
    ];

    const existentes = await repo.find({ select: { email: true } });
    const emails = new Set(existentes.map((s) => s.email));
    for (const student of demo) {
      if (emails.has(student.email)) continue;
      try {
        await repo.save(repo.create(student));
      } catch {
        // Ignorar duplicados residuales
      }
    }
  }

  private async seedExpedientes() {
    const studentRepo = this.dataSource.getRepository(Student);
    const docRepo = this.dataSource.getRepository(StudentDocument);
    const historyRepo = this.dataSource.getRepository(StudentAcademicHistory);

    const students = await studentRepo.find();
    if (!students.length) return;

    const enrichments: Record<
      string,
      Partial<Student> & {
        historial?: Array<{
          anio: string;
          grado: string;
          seccion: string;
          promedio: number;
          estado: string;
        }>;
        documentos?: Array<{
          tipo: string;
          numero: string;
          estado: 'entregado' | 'pendiente' | 'vencido';
          fechaEntrega: string;
        }>;
      }
    > = {
      'estudiante@escolar.pe': {
        dni: '71234567',
        fechaNac: '2012-05-14',
        sexo: 'M',
        direccion: 'Av. Los Heroes 234, SJM',
        codigo: '2026-001',
        historial: [
          { anio: '2025', grado: '4° Primaria', seccion: 'A', promedio: 15.2, estado: 'Promovido' },
          { anio: '2024', grado: '3° Primaria', seccion: 'B', promedio: 14.8, estado: 'Promovido' },
        ],
        documentos: [
          { tipo: 'DNI del alumno', numero: '71234567', estado: 'entregado', fechaEntrega: '10/03/2025' },
          { tipo: 'Partida de Nacimiento', numero: '2012-00123', estado: 'entregado', fechaEntrega: '10/03/2025' },
          { tipo: 'Ficha de Matrícula (FUT)', numero: 'FUT-2026-001', estado: 'entregado', fechaEntrega: '15/03/2025' },
          { tipo: 'Certificado de Estudios', numero: 'CERT-2025-001', estado: 'pendiente', fechaEntrega: '' },
        ],
      },
      'c.mendoza@estudiante.pe': {
        dni: '72345678',
        fechaNac: '2012-08-22',
        sexo: 'M',
        direccion: 'Jr. Las Flores 456, SJM',
        codigo: '2026-002',
        conductaNota: 'AD',
        historial: [
          { anio: '2025', grado: '4° Primaria', seccion: 'A', promedio: 16.1, estado: 'Promovido' },
        ],
        documentos: [
          { tipo: 'DNI del alumno', numero: '72345678', estado: 'entregado', fechaEntrega: '12/03/2025' },
          { tipo: 'Ficha de Matrícula (FUT)', numero: 'FUT-2026-002', estado: 'entregado', fechaEntrega: '12/03/2025' },
        ],
      },
      'a.garcia@estudiante.pe': {
        dni: '73456789',
        fechaNac: '2011-03-10',
        sexo: 'F',
        direccion: 'Calle Tupac Amaru 789, SJM',
        codigo: '2026-003',
        alergias: 'Polen',
        condicionesSalud: 'Rinitis',
        historial: [
          { anio: '2025', grado: '4° Primaria', seccion: 'B', promedio: 15.5, estado: 'Promovido' },
        ],
        documentos: [
          { tipo: 'DNI del alumno', numero: '73456789', estado: 'entregado', fechaEntrega: '11/03/2025' },
          { tipo: 'Ficha de Salud', numero: '', estado: 'pendiente', fechaEntrega: '' },
        ],
      },
    };

    for (const student of students) {
      const extra = enrichments[student.email];
      const needsUpdate =
        extra &&
        (!student.dni ||
          !student.codigo ||
          (extra.dni && student.dni !== extra.dni));

      if (needsUpdate && extra) {
        Object.assign(student, {
          dni: extra.dni ?? student.dni,
          fechaNac: extra.fechaNac ?? student.fechaNac,
          sexo: extra.sexo ?? student.sexo,
          direccion: extra.direccion ?? student.direccion,
          codigo: extra.codigo ?? student.codigo,
          alergias: extra.alergias ?? student.alergias,
          condicionesSalud: extra.condicionesSalud ?? student.condicionesSalud,
          conductaNota: extra.conductaNota ?? student.conductaNota,
          anioIngreso: student.anioIngreso || '2020',
          estadoMatricula: student.estadoMatricula || 'activo',
        });
        await studentRepo.save(student);
      } else if (!student.codigo) {
        student.codigo = `2026-${String(student.id).padStart(3, '0')}`;
        student.anioIngreso = student.anioIngreso || '2020';
        student.estadoMatricula = student.estadoMatricula || 'activo';
        student.conductaNota = student.conductaNota || 'AD';
        await studentRepo.save(student);
      }

      const docCount = await docRepo.count({ where: { studentId: student.id } });
      if (!docCount) {
        const docs =
          extra?.documentos ??
          [
            { tipo: 'DNI del alumno', numero: '', estado: 'pendiente' as const, fechaEntrega: '' },
            { tipo: 'Ficha de Matrícula (FUT)', numero: '', estado: 'pendiente' as const, fechaEntrega: '' },
          ];
        await docRepo.save(
          docs.map((doc) =>
            docRepo.create({
              studentId: student.id,
              tipo: doc.tipo,
              numero: doc.numero,
              estado: doc.estado,
              fechaEntrega: doc.fechaEntrega,
            }),
          ),
        );
      }

      const histCount = await historyRepo.count({ where: { studentId: student.id } });
      if (!histCount && extra?.historial?.length) {
        await historyRepo.save(
          extra.historial.map((row) =>
            historyRepo.create({ studentId: student.id, ...row }),
          ),
        );
      }
    }
  }

  private rep(
    nombres: string,
    apellidos: string,
    dni: string,
    telefono: string,
    email: string,
    trabajo: string,
  ): RepresentanteData {
    return { nombres, apellidos, dni, telefono, email, trabajo };
  }

  private isRepEmpty(rep?: RepresentanteData | null): boolean {
    return !rep?.nombres?.trim();
  }

  private mergeRepresentante(
    current: RepresentanteData,
    full: RepresentanteData,
  ): RepresentanteData {
    return {
      nombres: current.nombres?.trim() || full.nombres,
      apellidos: current.apellidos?.trim() || full.apellidos,
      dni: current.dni?.trim() || full.dni,
      telefono: current.telefono?.trim() || full.telefono,
      email: current.email?.trim() || full.email,
      trabajo: current.trabajo?.trim() || full.trabajo,
    };
  }

  private representativeCatalog(): Record<
    string,
    { padre: RepresentanteData; madre: RepresentanteData; apoderado?: RepresentanteData }
  > {
    return {
      'estudiante@escolar.pe': {
        padre: this.rep('Carlos', 'Perez Mamani', '40123456', '987001001', 'cperez@gmail.com', 'Ingeniero Civil'),
        madre: this.rep('Rosa', 'Mamani Quispe', '40123457', '987001002', 'rmamani@gmail.com', 'Enfermera'),
        apoderado: this.rep('Rosa', 'Mamani Quispe', '40123457', '987001002', 'rmamani@gmail.com', 'Enfermera'),
      },
      'l.torres@estudiante.pe': {
        padre: this.rep('Roberto', 'Torres Vega', '40234561', '987102201', 'r.torres@gmail.com', 'Contador'),
        madre: this.rep('Elena', 'Vega Salazar', '40234562', '987102202', 'e.vega@gmail.com', 'Docente'),
        apoderado: this.rep('Roberto', 'Torres Vega', '40234561', '987102201', 'r.torres@gmail.com', 'Contador'),
      },
      'c.mendoza@estudiante.pe': {
        padre: this.rep('Fernando', 'Mendoza Ruiz', '40345671', '987103301', 'f.mendoza@gmail.com', 'Tecnico Electricista'),
        madre: this.rep('Lucia', 'Ruiz Paredes', '40345672', '987103302', 'l.ruiz@gmail.com', 'Administrativa'),
        apoderado: this.rep('Lucia', 'Ruiz Paredes', '40345672', '987103302', 'l.ruiz@gmail.com', 'Administrativa'),
      },
      'a.garcia@estudiante.pe': {
        padre: this.rep('Antonio', 'Garcia Lima', '40456781', '987104401', 'a.garcia.padre@gmail.com', 'Comerciante'),
        madre: this.rep('Carmen', 'Lima Torres', '40456782', '987104402', 'c.lima@gmail.com', 'Ama de casa'),
        apoderado: this.rep('Carmen', 'Lima Torres', '40456782', '987104402', 'c.lima@gmail.com', 'Ama de casa'),
      },
      'j.paredes@estudiante.pe': {
        padre: this.rep('Miguel', 'Paredes Cano', '40567891', '987105501', 'm.paredes@gmail.com', 'Chofer'),
        madre: this.rep('Rosa', 'Cano Mendoza', '40567892', '987105502', 'r.cano@gmail.com', 'Vendedora'),
        apoderado: this.rep('Miguel', 'Paredes Cano', '40567891', '987105501', 'm.paredes@gmail.com', 'Chofer'),
      },
      'm.quispe@estudiante.pe': {
        padre: this.rep('Julio', 'Quispe Rojas', '40678901', '987106601', 'j.quispe@gmail.com', 'Agricultor'),
        madre: this.rep('Ana', 'Rojas Huanca', '40678902', '987106602', 'a.rojas@gmail.com', 'Cocinera'),
        apoderado: this.rep('Ana', 'Rojas Huanca', '40678902', '987106602', 'a.rojas@gmail.com', 'Cocinera'),
      },
      'l.castillo@estudiante.pe': {
        padre: this.rep('Jorge', 'Castillo Vera', '40789012', '987107701', 'j.castillo@gmail.com', 'Mecanico'),
        madre: this.rep('Teresa', 'Vera Quispe', '40789013', '987107702', 't.vera@gmail.com', 'Secretaria'),
        apoderado: this.rep('Teresa', 'Vera Quispe', '40789013', '987107702', 't.vera@gmail.com', 'Secretaria'),
      },
      's.ramos@estudiante.pe': {
        padre: this.rep('Hector', 'Ramos Cruz', '40890123', '987108801', 'h.ramos@gmail.com', 'Policia'),
        madre: this.rep('Claudia', 'Cruz Mamani', '40890124', '987108802', 'c.cruz@gmail.com', 'Enfermera'),
        apoderado: this.rep('Hector', 'Ramos Cruz', '40890123', '987108801', 'h.ramos@gmail.com', 'Policia'),
      },
      'd.fernandez@estudiante.pe': {
        padre: this.rep('Pablo', 'Fernandez Mar', '40901234', '987109901', 'p.fernandez@gmail.com', 'Abogado'),
        madre: this.rep('Isabel', 'Mar Lopez', '40901235', '987109902', 'i.mar@gmail.com', 'Psicologa'),
        apoderado: this.rep('Isabel', 'Mar Lopez', '40901235', '987109902', 'i.mar@gmail.com', 'Psicologa'),
      },
      'alumno.80123456@estudiante.pe': {
        padre: this.rep('Pedro', 'Morales Lopez', '40123456', '987654321', 'pedro.morales@email.com', 'Comerciante'),
        madre: this.rep('Lucia', 'Lopez Diaz', '40123457', '987654322', 'lucia.lopez@email.com', 'Contadora'),
        apoderado: this.rep('Pedro', 'Morales Lopez', '40123456', '987654321', 'pedro.morales@email.com', 'Comerciante'),
      },
      'alumno.80234567@estudiante.pe': {
        padre: this.rep('Miguel', 'Chavez Rojas', '40234567', '976543211', 'm.chavez@email.com', 'Arquitecto'),
        madre: this.rep('Elena', 'Diaz Rojas', '40234568', '976543210', 'elena.diaz@email.com', 'Docente'),
        apoderado: this.rep('Elena', 'Diaz Rojas', '40234568', '976543210', 'elena.diaz@email.com', 'Docente'),
      },
      'm.salazar@estudiante.pe': {
        padre: this.rep('Ricardo', 'Salazar Rios', '40345678', '987201101', 'r.salazar@gmail.com', 'Ingeniero'),
        madre: this.rep('Patricia', 'Rios Vega', '40345679', '987201102', 'p.rios@gmail.com', 'Nutricionista'),
        apoderado: this.rep('Patricia', 'Rios Vega', '40345679', '987201102', 'p.rios@gmail.com', 'Nutricionista'),
      },
      'c.vega@estudiante.pe': {
        padre: this.rep('Jorge', 'Vega Ortiz', '40456789', '987202201', 'j.vega@gmail.com', 'Empresario'),
        madre: this.rep('Lucia', 'Ortiz Mamani', '40456790', '987202202', 'l.ortiz@gmail.com', 'Diseñadora'),
        apoderado: this.rep('Jorge', 'Vega Ortiz', '40456789', '987202201', 'j.vega@gmail.com', 'Empresario'),
      },
      'alumno.80345678@estudiante.pe': {
        padre: this.rep('Carlos', 'Vega Ramos', '40567890', '987111222', 'c.vega.ramos@gmail.com', 'Tecnico Industrial'),
        madre: this.rep('Sofia', 'Ramos Quispe', '40567891', '987111223', 's.ramos.ap@gmail.com', 'Enfermera'),
        apoderado: this.rep('Carlos', 'Vega Ramos', '40567890', '987111222', 'c.vega.ramos@gmail.com', 'Tecnico Industrial'),
      },
      'alumno.80456789@estudiante.pe': {
        padre: this.rep('Andres', 'Rojas Mendez', '40678901', '987222331', 'a.rojas@gmail.com', 'Contador'),
        madre: this.rep('Patricia', 'Mendez Solis', '40678902', '987222333', 'patricia.mendez@email.com', 'Abogada'),
        apoderado: this.rep('Patricia', 'Mendez Solis', '40678902', '987222333', 'patricia.mendez@email.com', 'Abogada'),
      },
    };
  }

  private shouldReplaceRep(current?: RepresentanteData | null): boolean {
    return this.isRepEmpty(current) || !current?.dni?.trim();
  }

  private shouldRefreshRep(
    current: RepresentanteData | undefined,
    catalog: RepresentanteData,
    related: RepresentanteData[] = [],
  ): boolean {
    if (this.shouldReplaceRep(current)) return true;
    if (!current?.nombres?.trim() || !catalog.nombres?.trim()) return false;

    if (
      current.nombres === catalog.nombres &&
      catalog.dni?.trim() &&
      current.dni?.trim() &&
      current.dni !== catalog.dni
    ) {
      return true;
    }

    const duplicatedWithRelated = related.some(
      (rep) => rep?.nombres?.trim() && rep.nombres === current.nombres,
    );
    if (duplicatedWithRelated && current.nombres !== catalog.nombres) {
      return true;
    }

    return false;
  }

  private async ensureStudentRepresentatives(): Promise<void> {
    const repo = this.dataSource.getRepository(Student);
    const catalog = this.representativeCatalog();
    const students = await repo.find();

    for (const student of students) {
      const data = catalog[student.email];
      if (!data) continue;

      let changed = false;
      const apoderadoBase = data.apoderado ?? data.padre;
      const nextPadre = this.shouldRefreshRep(student.padre, data.padre, [
        student.madre,
        student.apoderado,
      ])
        ? { ...data.padre }
        : this.mergeRepresentante(student.padre, data.padre);
      const nextMadre = this.shouldRefreshRep(student.madre, data.madre, [
        student.padre,
        student.apoderado,
      ])
        ? { ...data.madre }
        : this.mergeRepresentante(student.madre, data.madre);
      const nextApoderado = this.shouldRefreshRep(student.apoderado, apoderadoBase, [
        student.padre,
        student.madre,
      ])
        ? { ...apoderadoBase }
        : this.mergeRepresentante(student.apoderado, apoderadoBase);

      if (JSON.stringify(student.padre) !== JSON.stringify(nextPadre)) {
        student.padre = nextPadre;
        changed = true;
      }
      if (JSON.stringify(student.madre) !== JSON.stringify(nextMadre)) {
        student.madre = nextMadre;
        changed = true;
      }
      if (JSON.stringify(student.apoderado) !== JSON.stringify(nextApoderado)) {
        student.apoderado = nextApoderado;
        changed = true;
      }

      if (changed) {
        await repo.save(student);
      }
    }
  }

  private async ensureConductIncidents(): Promise<void> {
    const repo = this.dataSource.getRepository(ConductIncident);
    const MIN = 20;
    const existing = await repo.count();
    if (existing >= MIN) return;

    const studentRepo = this.dataSource.getRepository(Student);
    const students = await studentRepo.find({
      where: { activo: true },
      order: { id: 'ASC' },
    });
    if (!students.length) return;

    const tipos = [
      'falta_leve',
      'falta_grave',
      'falta_muy_grave',
      'reconocimiento',
    ] as const;
    const estados = ['pendiente', 'en_proceso', 'resuelto'] as const;
    const lugares = [
      'Salón de clase',
      'Patio',
      'Pasadizo',
      'Laboratorio',
      'Biblioteca',
      'Comedor',
      'Cancha deportiva',
    ];
    const docentes = [
      'Prof. Ana Condori',
      'Prof. Roberto Alvarado',
      'Prof. María Vargas',
      'Prof. Carlos Ramos',
      'Dir. Juan Pérez',
    ];
    const descripciones: Record<(typeof tipos)[number], string[]> = {
      falta_leve: [
        'Llegada tarde al salón sin justificación',
        'Uso de celular durante clase',
        'No presentó tareas asignadas',
        'Interrupciones frecuentes durante la clase',
      ],
      falta_grave: [
        'Falta de respeto verbal hacia un compañero',
        'Destrucción de material escolar ajeno',
        'Abandono del aula sin permiso del docente',
        'Copiado durante evaluación',
      ],
      falta_muy_grave: [
        'Agresión física a un estudiante',
        'Intimidación y acoso a un compañero',
        'Daños graves a la infraestructura escolar',
        'Falta de respeto grave al personal docente',
      ],
      reconocimiento: [
        'Excelente desempeño académico y disciplinario',
        'Apoyo destacado a compañeros en dificultades',
        'Representación destacada de la institución',
        'Liderazgo positivo en actividades escolares',
      ],
    };
    const medidas: Record<(typeof tipos)[number], string[]> = {
      falta_leve: [
        'Llamada de atención verbal',
        'Anotación en anecdotario',
        'Citación al padre de familia',
      ],
      falta_grave: [
        'Suspensión de 1 día',
        'Carta de compromiso firmada',
        'Derivación a psicología',
      ],
      falta_muy_grave: [
        'Suspensión de 3 días',
        'Intervención del CONEI',
        'Proceso disciplinario formal',
      ],
      reconocimiento: [
        'Diploma de reconocimiento',
        'Mención en acto cívico',
        'Carta de felicitación',
      ],
    };
    const fechas = [
      '2026-04-02',
      '2026-04-07',
      '2026-04-14',
      '2026-04-22',
      '2026-05-05',
      '2026-05-12',
      '2026-05-19',
      '2026-05-28',
      '2026-06-03',
      '2026-06-10',
    ];

    const entries: Partial<ConductIncident>[] = [];
    let seq = existing;
    while (seq < MIN) {
      const student = students[seq % students.length];
      const i = seq;
      const tipo = tipos[(student.id * 3 + i * 7) % tipos.length];
      const estado = estados[(student.id + i) % estados.length];
      entries.push({
        studentId: student.id,
        tipo,
        descripcion:
          descripciones[tipo][(student.id + i) % descripciones[tipo].length],
        fecha: fechas[(student.id + i) % fechas.length],
        lugar: lugares[(student.id * 2 + i) % lugares.length],
        reportadoPor: docentes[(student.id + i) % docentes.length],
        estado,
        medida: medidas[tipo][(student.id + i) % medidas[tipo].length],
        notificadoPadre: (student.id + i) % 3 !== 0,
        observaciones: '',
      });
      seq++;
    }

    await repo.save(entries.map((entry) => repo.create(entry)));
  }

  private async seedCourses() {
    const repo = this.dataSource.getRepository(Course);
    if (await repo.count()) return;
    await repo.save([
      { nombre: 'Matemática', area: 'Matemática', nivel: 'Primaria', grado: '5°', seccion: 'A', docente: 'J. Pérez' },
      { nombre: 'Comprensión Lectora', area: 'Comunicación', nivel: 'Primaria', grado: '5°', seccion: 'A', docente: 'R. Mendoza' },
      { nombre: 'Ciencia y Tecnología', area: 'C y T', nivel: 'Primaria', grado: '5°', seccion: 'A', docente: 'C. Torres' },
    ]);
  }

  private async seedSchedules() {
    const repo = this.dataSource.getRepository(Schedule);
    if (await repo.count()) return;
    await repo.save([
      { studentId: this.studentId, nivel: 'Primaria', grado: '5°', seccion: 'A', dia: 0, horaInicio: '07:45', horaFin: '08:30', curso: 'Matemática', docente: 'J. Pérez' },
      { studentId: this.studentId, nivel: 'Primaria', grado: '5°', seccion: 'A', dia: 0, horaInicio: '08:30', horaFin: '09:15', curso: 'Matemática', docente: 'J. Pérez' },
      { studentId: this.studentId, nivel: 'Primaria', grado: '5°', seccion: 'A', dia: 1, horaInicio: '07:45', horaFin: '08:30', curso: 'Inglés', docente: 'P. Sánchez' },
    ]);
  }

  private async seedGrades() {
    const repo = this.dataSource.getRepository(Grade);
    if (await repo.count()) return;

    const studentRepo = this.dataSource.getRepository(Student);
    const students = await studentRepo.find({ where: { activo: true } });
    const cursos = [
      'Matemática',
      'Comprensión Lectora',
      'Ciencia y Tecnología',
      'Comunicación',
    ];

    const records: Partial<Grade>[] = [];
    for (const student of students) {
      for (const curso of cursos) {
        for (let bim = 1; bim <= 2; bim++) {
          const base =
            10 + ((student.id * 7 + curso.length * 3 + bim * 5) % 9);
          const mes = bim === 1 ? '03' : '06';
          records.push(
            {
              studentId: student.id,
              curso,
              tipo: 'daily',
              bimestre: bim,
              nota: Math.min(20, base),
              fechaEvaluacion: `2026-${mes}-05`,
              descripcion: 'Control diario',
            },
            {
              studentId: student.id,
              curso,
              tipo: 'partial',
              bimestre: bim,
              nota: Math.min(20, base + 1),
              fechaEvaluacion: `2026-${mes}-15`,
              descripcion: 'Examen parcial',
            },
            {
              studentId: student.id,
              curso,
              tipo: 'final',
              bimestre: bim,
              nota: Math.min(20, base + 2),
              fechaEvaluacion: `2026-${mes}-28`,
              descripcion: 'Final bimestral',
            },
          );
        }
      }
    }

    await repo.save(records);
  }

  private async seedAttendances() {
    const repo = this.dataSource.getRepository(Attendance);
    if (await repo.count()) return;

    const studentRepo = this.dataSource.getRepository(Student);
    const students = await studentRepo.find({ where: { activo: true } });
    const junDates = [
      '2026-06-02',
      '2026-06-03',
      '2026-06-05',
      '2026-06-09',
      '2026-06-10',
      '2026-06-12',
      '2026-06-15',
      '2026-06-16',
    ];

    const records: Partial<Attendance>[] = [];
    students.forEach((student, i) => {
      junDates.forEach((fecha, j) => {
        let estado: 'P' | 'F' | 'T' | 'J' = 'P';
        if ((i + j) % 7 === 0) estado = 'F';
        else if ((i + j) % 5 === 0) estado = 'T';
        else if ((i + j) % 11 === 0) estado = 'J';

        records.push({
          studentId: student.id,
          fecha,
          estado,
          observacion:
            estado === 'F'
              ? 'Inasistencia sin justificar'
              : estado === 'J'
                ? 'Enfermedad'
                : undefined,
        });
      });
    });

    await repo.save(records);
  }

  private async seedJustifications() {
    const repo = this.dataSource.getRepository(AttendanceJustification);
    if (await repo.count()) return;

    const attRepo = this.dataSource.getRepository(Attendance);
    const justified = await attRepo.find({
      where: { estado: 'J' },
      take: 3,
      order: { fecha: 'DESC' },
    });
    if (!justified.length) return;

    const grouped = new Map<number, typeof justified>();
    for (const att of justified) {
      const list = grouped.get(att.studentId) ?? [];
      list.push(att);
      grouped.set(att.studentId, list);
    }

    for (const [studentId, items] of grouped) {
      await repo.save(
        repo.create({
          studentId,
          cantidad: items.length,
          motivo: 'Enfermedad',
          observacion: 'Certificado médico presentado',
          attendanceIds: items.map((a) => a.id),
          fechas: items.map((a) => a.fecha),
          registradoPor: 'Administración',
        }),
      );
    }
  }

  private async seedAttendanceAlertSettings() {
    const repo = this.dataSource.getRepository(AttendanceAlertSettings);
    if (await repo.count()) return;
    await repo.save(
      repo.create({
        diasAlertaAusentismo: 2,
        diasAlertaCritica: 5,
      }),
    );
  }

  private async seedTasks() {
    const repo = this.dataSource.getRepository(Task);
    if (await repo.count()) return;
    await repo.save([
      {
        studentId: this.studentId,
        titulo: 'Resolver guía de fracciones',
        curso: 'Matemática',
        fechaEntrega: '2026-06-24',
        estado: 'PENDING',
        prioridad: 'alta',
      },
      {
        studentId: this.studentId,
        titulo: 'Resumen de lectura semanal',
        curso: 'Comunicación',
        fechaEntrega: '2026-06-25',
        estado: 'PENDING',
        prioridad: 'media',
      },
      {
        studentId: this.studentId,
        titulo: 'Tarea: Problemas con fracciones',
        curso: 'Matemática',
        fechaEntrega: '2026-06-24',
        estado: 'PENDING',
        prioridad: 'media',
      },
      {
        studentId: this.studentId,
        titulo: 'Informe de experimento — plantas',
        curso: 'Ciencia y Tecnología',
        fechaEntrega: '2026-06-20',
        estado: 'OVERDUE',
        prioridad: 'alta',
      },
      {
        studentId: this.studentId,
        titulo: 'Ejercicios de comprensión lectora',
        curso: 'Comprensión Lectora',
        fechaEntrega: '2026-06-18',
        estado: 'SUBMITTED',
        prioridad: 'baja',
      },
      {
        studentId: this.studentId,
        titulo: 'Evaluación Bimestral — Matemática',
        curso: 'Matemática',
        fechaEntrega: '2026-06-28',
        estado: 'PENDING',
        prioridad: 'alta',
      },
    ]);
  }

  private async seedAnnouncements() {
    const repo = this.dataSource.getRepository(Announcement);
    if (await repo.count()) return;
    await repo.save([
      {
        titulo: 'Calendario de evaluaciones — 2° Bimestre',
        cuerpo: 'Revisa las fechas de evaluación de cada curso para esta semana.',
        tipo: 'academico',
        destinatarios: 'alumnos',
        prioridad: 'media',
        fechaPublicacion: '2026-06-05',
        fechaVencimiento: '2026-06-30',
        habilitado: true,
      },
      {
        titulo: 'Olimpiadas escolares — Convocatoria',
        cuerpo: 'Inscripciones abiertas hasta el 20 de junio.',
        tipo: 'evento',
        destinatarios: 'alumnos',
        prioridad: 'alta',
        fechaPublicacion: '2026-06-13',
        fechaVencimiento: '2026-06-20',
        habilitado: true,
      },
    ]);
  }

  private async seedInstitution() {
    const instRepo = this.dataSource.getRepository(Institution);
    const campusRepo = this.dataSource.getRepository(Campus);

    if (!(await instRepo.count())) {
      await instRepo.save({
        nombre: 'I.E.P. San Martin de Porres',
        siglas: 'IEP SMP',
        ruc: '20512345678',
        codigoModular: '0654321',
        tipoGestion: 'privada',
        ugel: 'UGEL 01',
        dre: 'DRELM',
        resolucion: 'RD N 1234-2005',
        direccion: 'Av. Los Heroes 123',
        distrito: 'San Juan de Miraflores',
        provincia: 'Lima',
        region: 'Lima',
        codigoPostal: '15800',
        telefono: '01-5551234',
        telefono2: '',
        email: 'info@sanmartin.edu.pe',
        web: 'https://www.sanmartin.edu.pe',
        facebook: '',
        director: 'Juan Carlos Perez Torres',
        subdirector: 'Maria Elena Quispe Huanca',
        administrador: 'Carlos Mamani Flores',
        anio: '2026',
        sistemaEval: 'numerico',
        tipoPeriodo: 'bimestre',
        notaMinima: 11,
        niveles: [],
        periodos: [
          { numero: 1, nombre: '1 Bimestre', tipo: 'bimestre', inicio: '2026-03-10', fin: '2026-05-09', actual: false },
          { numero: 2, nombre: '2 Bimestre', tipo: 'bimestre', inicio: '2026-05-12', fin: '2026-07-25', actual: true },
          { numero: 3, nombre: '3 Bimestre', tipo: 'bimestre', inicio: '2026-08-11', fin: '2026-10-17', actual: false },
          { numero: 4, nombre: '4 Bimestre', tipo: 'bimestre', inicio: '2026-10-20', fin: '2026-12-19', actual: false },
        ],
        config: { moneda: 'PEN', timezone: 'America/Lima', formatoFecha: 'DD/MM/YYYY' },
        modulos: [
          { key: 'matricula', label: 'Matricula', desc: 'Gestion de matriculas y vacantes', icon: 'how_to_reg', activo: true },
          { key: 'asistencia', label: 'Asistencia', desc: 'Registro diario de asistencia', icon: 'fact_check', activo: true },
          { key: 'evaluacion', label: 'Evaluacion', desc: 'Notas y calificaciones', icon: 'grading', activo: true },
          { key: 'tesoreria', label: 'Tesoreria', desc: 'Pagos y control de deudas', icon: 'payments', activo: true },
          { key: 'biblioteca', label: 'Biblioteca', desc: 'Prestamos y catalogo', icon: 'menu_book', activo: false },
          { key: 'transporte', label: 'Transporte', desc: 'Rutas y asignacion de buses', icon: 'directions_bus', activo: false },
          { key: 'horarios', label: 'Horarios', desc: 'Programacion de horarios', icon: 'schedule', activo: true },
          { key: 'comunicados', label: 'Comunicados', desc: 'Mensajeria y notificaciones', icon: 'campaign', activo: true },
        ],
      });
    }

    if (!(await campusRepo.count())) {
      await campusRepo.save([
        {
          nombre: 'Sede Central',
          codigo: 'SEDE-01',
          direccion: 'Av. Los Heroes 123',
          distrito: 'San Juan de Miraflores',
          provincia: 'Lima',
          region: 'Lima',
          telefono: '01-5551234',
          email: 'central@sanmartin.edu.pe',
          director: 'Juan Carlos Perez Torres',
          niveles: ['Primaria', 'Secundaria'],
          turnos: ['Manana', 'Tarde'],
          estado: 'activo',
        },
        {
          nombre: 'Sede Inicial',
          codigo: 'SEDE-02',
          direccion: 'Jr. Las Flores 456',
          distrito: 'San Juan de Miraflores',
          provincia: 'Lima',
          region: 'Lima',
          telefono: '01-5554321',
          email: 'inicial@sanmartin.edu.pe',
          director: 'Rosa Gutierrez Lima',
          niveles: ['Inicial'],
          turnos: ['Manana'],
          estado: 'activo',
        },
      ]);
    }
  }

  private async seedEducationLevels() {
    const nivelRepo = this.dataSource.getRepository(EducationLevel);
    if (await nivelRepo.count()) return;

    const instRepo = this.dataSource.getRepository(Institution);
    const institution = await instRepo.findOne({ where: {}, order: { id: 'ASC' } });
    const rawNiveles = institution?.niveles as Array<{
      nombre: string;
      activo: boolean;
      grados: { nombre: string; secciones: string[] | string }[];
    }> | undefined;

    const estructura = rawNiveles?.length
      ? rawNiveles.map((nivel) => ({
          nombre: nivel.nombre,
          activo: nivel.activo,
          grados: nivel.grados.map((grado) => ({
            nombre: grado.nombre,
            secciones: Array.isArray(grado.secciones)
              ? grado.secciones
              : String(grado.secciones ?? '').split(/[\s,]+/).filter(Boolean),
          })),
        }))
      : [
      {
        nombre: 'Inicial', activo: true, grados: [
          { nombre: '3 anos', secciones: ['Anaranjado'] },
          { nombre: '4 anos', secciones: ['Verde'] },
          { nombre: '5 anos', secciones: ['Azul'] },
        ],
      },
      {
        nombre: 'Primaria', activo: true, grados: [
          { nombre: '1 Grado', secciones: ['A', 'B'] },
          { nombre: '2 Grado', secciones: ['A', 'B'] },
          { nombre: '3 Grado', secciones: ['A', 'B'] },
          { nombre: '4 Grado', secciones: ['A'] },
          { nombre: '5 Grado', secciones: ['A'] },
          { nombre: '6 Grado', secciones: ['A'] },
        ],
      },
      {
        nombre: 'Secundaria', activo: true, grados: [
          { nombre: '1 Ano', secciones: ['A', 'B'] },
          { nombre: '2 Ano', secciones: ['A', 'B'] },
          { nombre: '3 Ano', secciones: ['A'] },
          { nombre: '4 Ano', secciones: ['A'] },
          { nombre: '5 Ano', secciones: ['A'] },
        ],
      },
    ];

    for (const [ni, nivelData] of estructura.entries()) {
      const nivel = await nivelRepo.save(
        nivelRepo.create({ nombre: nivelData.nombre, activo: nivelData.activo, orden: ni }),
      );
      const gradoRepo = this.dataSource.getRepository(GradeLevel);
      const seccionRepo = this.dataSource.getRepository(GradeSection);

      for (const [gi, gradoData] of nivelData.grados.entries()) {
        const grado = await gradoRepo.save(
          gradoRepo.create({ nivelId: nivel.id, nombre: gradoData.nombre, orden: gi }),
        );
        for (const seccionNombre of gradoData.secciones) {
          await seccionRepo.save(
            seccionRepo.create({ gradoId: grado.id, nombre: seccionNombre }),
          );
        }
      }
    }
  }

  private async seedClassrooms(): Promise<void> {
    const repo = this.dataSource.getRepository(Classroom);
    const anioEscolar = 2026;
    const existing = await repo.count({ where: { anioEscolar } });
    if (existing > 0) return;

    const nivelRepo = this.dataSource.getRepository(EducationLevel);
    const gradoRepo = this.dataSource.getRepository(GradeLevel);
    const seccionRepo = this.dataSource.getRepository(GradeSection);
    const niveles = await nivelRepo.find({ where: { activo: true }, order: { orden: 'ASC' } });

    for (const nivel of niveles) {
      const grados = await gradoRepo.find({
        where: { nivelId: nivel.id },
        order: { orden: 'ASC' },
      });
      for (const grado of grados) {
        const gradoMat = gradoInstitucionalToMatricula(nivel.nombre, grado.nombre);
        const secciones = await seccionRepo.find({ where: { gradoId: grado.id } });
        for (const seccion of secciones) {
          await repo.save(
            repo.create({
              anioEscolar,
              nivel: nivel.nombre,
              grado: gradoMat,
              seccion: seccion.nombre.trim().toUpperCase(),
              aforo: defaultAforoForNivel(nivel.nombre),
              activo: true,
            }),
          );
        }
      }
    }
  }

  private async seedUsers() {
    const repo = this.dataSource.getRepository(User);

    const usuarios = [
      { nombres: 'Carlos', apellidos: 'Mendoza Torres', dni: '45123678', email: 'admin@escolar.pe', username: 'admin', telefono: '987001001', rol: 'ADMIN', sede: 'Sede Central', estado: 'activo', cargo: 'Administrador del Sistema', password: 'admin123', ultimoAcceso: new Date('2026-06-15T08:30:00') },
      { nombres: 'Ana', apellidos: 'Garcia Lopez', dni: '45234789', email: 'director@escolar.pe', username: 'director', telefono: '987002002', rol: 'DIRECTOR', sede: 'Sede Central', estado: 'activo', cargo: 'Directora General', password: 'admin123', ultimoAcceso: new Date('2026-06-15T07:55:00') },
      { nombres: 'Luis', apellidos: 'Ramirez Silva', dni: '45345890', email: 'docente@escolar.pe', username: 'docente', telefono: '987003003', rol: 'DOCENTE', sede: 'Sede Central', estado: 'activo', cargo: 'Docente de Matematicas', password: 'admin123', ultimoAcceso: new Date('2026-06-15T09:10:00') },
      { nombres: 'Maria', apellidos: 'Flores Quispe', dni: '45456902', email: 'm.flores@escolar.pe', username: 'm.flores', telefono: '987004004', rol: 'DOCENTE', sede: 'Sede Central', estado: 'activo', cargo: 'Docente de Comunicacion', password: 'admin123', ultimoAcceso: new Date('2026-06-14T16:45:00') },
      { nombres: 'Juan', apellidos: 'Perez Mamani', dni: '45567012', email: 'estudiante@escolar.pe', username: 'estudiante', telefono: '987005005', rol: 'ESTUDIANTE', sede: 'Sede Central', estado: 'activo', cargo: 'Estudiante', password: 'admin123', ultimoAcceso: new Date('2026-06-15T08:00:00') },
      { nombres: 'Rosa', apellidos: 'Huanca Castro', dni: '45678123', email: 'r.huanca@escolar.pe', username: 'r.huanca', telefono: '987006006', rol: 'SECRETARIA', sede: 'Sede Central', estado: 'activo', cargo: 'Secretaria Academica', password: 'admin123', ultimoAcceso: new Date('2026-06-15T09:00:00') },
      { nombres: 'Pedro', apellidos: 'Vargas Condori', dni: '45789234', email: 'p.vargas@escolar.pe', username: 'p.vargas', telefono: '987007007', rol: 'TESORERO', sede: 'Sede Central', estado: 'activo', cargo: 'Tesorero', password: 'admin123', ultimoAcceso: new Date('2026-06-15T10:20:00') },
      { nombres: 'Elena', apellidos: 'Quispe Puma', dni: '45890346', email: 'e.quispe@escolar.pe', username: 'e.quispe', telefono: '987008008', rol: 'DOCENTE', sede: 'Sede Central', estado: 'activo', cargo: 'Docente de Ciencias', password: 'admin123', ultimoAcceso: new Date('2026-06-13T14:30:00') },
      { nombres: 'Roberto', apellidos: 'Ccapa Lima', dni: '45901459', email: 'r.ccapa@escolar.pe', username: 'r.ccapa', telefono: '987009009', rol: 'DOCENTE', sede: 'Sede Central', estado: 'activo', cargo: 'Docente de Historia', password: 'admin123', ultimoAcceso: new Date('2026-06-15T08:45:00') },
      { nombres: 'Luz', apellidos: 'Ticona Apaza', dni: '46012567', email: 'l.ticona@escolar.pe', username: 'l.ticona', telefono: '987010010', rol: 'BIBLIOTECARIO', sede: 'Sede Central', estado: 'activo', cargo: 'Bibliotecaria', password: 'admin123', ultimoAcceso: new Date('2026-06-15T09:30:00') },
      { nombres: 'Jorge', apellidos: 'Mamani Choque', dni: '46123678', email: 'j.mamani@escolar.pe', username: 'j.mamani', telefono: '987011011', rol: 'DOCENTE', sede: 'Sede Central', estado: 'inactivo', cargo: 'Docente de Educacion Fisica', password: 'admin123', ultimoAcceso: new Date('2026-05-01T11:00:00') },
      { nombres: 'Carmen', apellidos: 'Lazo Ramos', dni: '46234789', email: 'c.lazo@escolar.pe', username: 'c.lazo', telefono: '987012012', rol: 'DOCENTE', sede: 'Sede Inicial', estado: 'activo', cargo: 'Docente de Arte', password: 'admin123', ultimoAcceso: new Date('2026-06-15T07:50:00') },
      { nombres: 'Miguel', apellidos: 'Pauca Suni', dni: '46345890', email: 'm.pauca@escolar.pe', username: 'm.pauca', telefono: '987013013', rol: 'DOCENTE', sede: 'Sede Central', estado: 'activo', cargo: 'Docente de Ingles', password: 'admin123', ultimoAcceso: new Date('2026-06-14T17:10:00') },
      { nombres: 'Sandra', apellidos: 'Coaquira Catari', dni: '46456901', email: 's.coaquira@escolar.pe', username: 's.coaquira', telefono: '987014014', rol: 'SECRETARIA', sede: 'Sede Inicial', estado: 'activo', cargo: 'Secretaria Sede Inicial', password: 'admin123', ultimoAcceso: new Date('2026-06-15T08:55:00') },
      { nombres: 'Victor', apellidos: 'Calisaya Huanca', dni: '46567012', email: 'v.calisaya@escolar.pe', username: 'v.calisaya', telefono: '987015015', rol: 'DOCENTE', sede: 'Sede Central', estado: 'bloqueado', cargo: 'Docente de Tecnologia', password: 'admin123', ultimoAcceso: new Date('2026-04-20T12:00:00') },
      { nombres: 'Maria', apellidos: 'Lopez Quispe', dni: '46678123', email: 'padre@escolar.pe', username: 'padre', telefono: '987016016', rol: 'PADRE', sede: 'Todas', estado: 'activo', cargo: 'Apoderado', password: 'admin123', ultimoAcceso: new Date('2026-06-14T19:30:00') },
      { nombres: 'Andres', apellidos: 'Turpo Huallpa', dni: '46789234', email: 'a.turpo@escolar.pe', username: 'a.turpo', telefono: '987017017', rol: 'PADRE', sede: 'Todas', estado: 'activo', cargo: 'Apoderado', password: 'admin123', ultimoAcceso: new Date('2026-06-15T06:45:00') },
      { nombres: 'Nelly', apellidos: 'Chambi Quispe', dni: '46890345', email: 'n.chambi@escolar.pe', username: 'n.chambi', telefono: '987018018', rol: 'DOCENTE', sede: 'Sede Central', estado: 'activo', cargo: 'Docente de Musica', password: 'admin123', ultimoAcceso: new Date('2026-06-15T09:15:00') },
      { nombres: 'Fernando', apellidos: 'Calcina Pari', dni: '46901456', email: 'f.calcina@escolar.pe', username: 'f.calcina', telefono: '987019019', rol: 'DOCENTE', sede: 'Sede Central', estado: 'activo', cargo: 'Docente de Religion', password: 'admin123', ultimoAcceso: new Date('2026-06-15T08:20:00') },
      { nombres: 'Graciela', apellidos: 'Apaza Condori', dni: '47012567', email: 'g.apaza@escolar.pe', username: 'g.apaza', telefono: '987020020', rol: 'DIRECTOR', sede: 'Sede Inicial', estado: 'activo', cargo: 'Directora Sede Inicial', password: 'admin123', ultimoAcceso: new Date('2026-06-15T07:40:00') },
    ];

    const existentes = await repo.find({ select: { email: true, dni: true } });
    const emails = new Set(existentes.map((u) => u.email));
    const dnis = new Set(existentes.map((u) => u.dni));
    const pendientes = usuarios.filter((u) => !emails.has(u.email) && !dnis.has(u.dni));

    for (const u of pendientes) {
      try {
        await repo.save(
          repo.create({
            ...u,
            rol: u.rol as UserRole,
            estado: u.estado as UserEstado,
          }),
        );
      } catch {
        // Ignorar duplicados residuales
      }
    }
  }

  private async seedActas() {
    const repo = this.dataSource.getRepository(EvaluationActa);
    if (await repo.count()) return;

    const combos = [
      { nivel: 'Primaria', grado: '5°', seccion: 'A', bimestre: 1, docente: 'J. Pérez' },
      { nivel: 'Primaria', grado: '5°', seccion: 'A', bimestre: 2, docente: 'J. Pérez' },
      { nivel: 'Primaria', grado: '5°', seccion: 'B', bimestre: 1, docente: 'R. Mendoza' },
    ];

    for (const combo of combos) {
      try {
        const acta = await this.actasService.generate(combo);
        if (combo.bimestre === 1 && combo.seccion === 'A') {
          await this.actasService.approve(acta.id, { aprobadoPor: 'Dirección' });
        }
      } catch {
        // Sin notas suficientes para esta seccion
      }
    }
  }

  private async seedEvents() {
    const repo = this.dataSource.getRepository(SchoolEvent);
    if (await repo.count()) return;

    await repo.save([
      {
        titulo: 'Olimpiadas Escolares 2026',
        descripcion: 'Competencias deportivas inter-aulas. Inscripciones en secretaría.',
        tipo: 'deportivo',
        fechaInicio: '2026-06-20',
        fechaFin: '2026-06-20',
        horaInicio: '08:00',
        horaFin: '13:00',
        lugar: 'Patio principal',
        destinatarios: 'alumnos',
        nivel: '',
        responsable: 'Dept. Educación Física',
        publicado: true,
      },
      {
        titulo: 'Reunión de padres — 2° Bimestre',
        descripcion: 'Entrega de informes y retroalimentación del bimestre.',
        tipo: 'reunion',
        fechaInicio: '2026-06-25',
        fechaFin: '2026-06-25',
        horaInicio: '18:00',
        horaFin: '20:00',
        lugar: 'Auditorio',
        destinatarios: 'padres',
        nivel: 'Primaria',
        responsable: 'Dirección',
        publicado: true,
      },
      {
        titulo: 'Feria de Ciencias',
        descripcion: 'Exposición de proyectos de investigación por grado.',
        tipo: 'academico',
        fechaInicio: '2026-07-05',
        fechaFin: '2026-07-06',
        horaInicio: '09:00',
        horaFin: '14:00',
        lugar: 'Pabellón de ciencias',
        destinatarios: 'todos',
        nivel: '',
        responsable: 'Coord. Académica',
        publicado: true,
      },
      {
        titulo: 'Festival de Danzas Folclóricas',
        descripcion: 'Presentación artística por niveles Inicial, Primaria y Secundaria.',
        tipo: 'cultural',
        fechaInicio: '2026-07-18',
        fechaFin: '2026-07-18',
        horaInicio: '10:00',
        horaFin: '12:30',
        lugar: 'Coliseo',
        destinatarios: 'todos',
        nivel: '',
        responsable: 'Dept. Arte y Cultura',
        publicado: true,
      },
      {
        titulo: 'Capacitación docente — Evaluación por competencias',
        descripcion: 'Taller interno para docentes de todos los niveles.',
        tipo: 'reunion',
        fechaInicio: '2026-06-10',
        fechaFin: '2026-06-10',
        horaInicio: '15:00',
        horaFin: '17:00',
        lugar: 'Sala de profesores',
        destinatarios: 'docentes',
        nivel: '',
        responsable: 'UGEL / Dirección',
        publicado: true,
      },
    ]);
  }

  private async seedResources() {
    const repo = this.dataSource.getRepository(TeacherResource);
    if (await repo.count()) return;

    await repo.save([
      {
        titulo: 'Guía de fracciones equivalentes',
        descripcion: 'Material de apoyo para la semana 22. Resolver ejercicios 1 al 15 del PDF.',
        tipo: 'clase' as const,
        courseId: null,
        curso: 'Matemática',
        nivel: 'Primaria',
        grado: '5°',
        seccion: 'A',
        docente: 'J. Pérez',
        fechaPublicacion: '2026-06-10',
        fechaEntrega: null,
        url: '',
        nombreArchivo: 'fracciones-semana22.pdf',
        visible: true,
      },
      {
        titulo: 'Tarea: Problemas con fracciones',
        descripcion: 'Entregar en cuaderno. Incluir procedimiento completo.',
        tipo: 'tarea' as const,
        courseId: null,
        curso: 'Matemática',
        nivel: 'Primaria',
        grado: '5°',
        seccion: 'A',
        docente: 'J. Pérez',
        fechaPublicacion: '2026-06-12',
        fechaEntrega: '2026-06-24',
        url: '',
        nombreArchivo: '',
        visible: true,
      },
      {
        titulo: 'Video: Introducción al razonamiento lógico',
        descripcion: 'Ver el video antes de la clase del miércoles.',
        tipo: 'video' as const,
        courseId: null,
        curso: 'Razonamiento',
        nivel: 'Primaria',
        grado: '5°',
        seccion: 'A',
        docente: 'J. Pérez',
        fechaPublicacion: '2026-06-14',
        fechaEntrega: null,
        url: 'https://www.youtube.com/watch?v=ejemplo',
        nombreArchivo: '',
        visible: true,
      },
      {
        titulo: 'Lectura: El principio de inducción',
        descripcion: 'Lectura complementaria del capítulo 3.',
        tipo: 'lectura' as const,
        courseId: null,
        curso: 'Razonamiento',
        nivel: 'Primaria',
        grado: '5°',
        seccion: 'A',
        docente: 'J. Pérez',
        fechaPublicacion: '2026-06-15',
        fechaEntrega: null,
        url: '',
        nombreArchivo: 'induccion-cap3.pdf',
        visible: true,
      },
      {
        titulo: 'Evaluación Bimestral — Matemática',
        descripcion: 'Repasar temas de fracciones, decimales y porcentajes.',
        tipo: 'evaluacion' as const,
        courseId: null,
        curso: 'Matemática',
        nivel: 'Primaria',
        grado: '5°',
        seccion: 'A',
        docente: 'J. Pérez',
        fechaPublicacion: '2026-06-16',
        fechaEntrega: '2026-06-28',
        url: '',
        nombreArchivo: '',
        visible: false,
      },
      {
        titulo: 'Enlace: Khan Academy — Fracciones',
        descripcion: 'Practica interactiva recomendada.',
        tipo: 'enlace' as const,
        courseId: null,
        curso: 'Matemática',
        nivel: 'Primaria',
        grado: '5°',
        seccion: 'A',
        docente: 'J. Pérez',
        fechaPublicacion: '2026-06-08',
        fechaEntrega: null,
        url: 'https://es.khanacademy.org/math/fractions',
        nombreArchivo: '',
        visible: true,
      },
    ]);
  }

  private async seedParentStudents() {
    const repo = this.dataSource.getRepository(ParentStudent);
    if (await repo.count()) return;

    const studentRepo = this.dataSource.getRepository(Student);
    const juan = await studentRepo.findOneBy({ email: 'estudiante@escolar.pe' });
    const maria = await studentRepo.findOneBy({ email: 'm.quispe@estudiante.pe' });

    const links: Partial<ParentStudent>[] = [];
    if (juan) {
      links.push({
        parentEmail: 'padre@escolar.pe',
        studentId: juan.id,
        parentesco: 'madre',
      });
    }
    if (maria) {
      links.push({
        parentEmail: 'padre@escolar.pe',
        studentId: maria.id,
        parentesco: 'tutor',
      });
    }

    if (links.length) {
      await repo.save(links);
    }
  }

  private async seedAuditLogs() {
    const repo = this.dataSource.getRepository(AuditLog);
    if (await repo.count()) return;

    const entries: Partial<AuditLog>[] = [
      {
        usuarioId: 1,
        usuarioNombre: 'Carlos Mendoza',
        usuarioRol: 'ADMIN',
        accion: 'login',
        modulo: 'autenticacion',
        entidad: 'sesion',
        entidadId: null,
        descripcion: 'Inicio de sesión exitoso',
        detalle: { navegador: 'Chrome 125', dispositivo: 'Windows' },
        ip: '192.168.1.10',
        nivel: 'info',
        createdAt: new Date('2026-06-15T08:30:00'),
      },
      {
        usuarioId: 1,
        usuarioNombre: 'Carlos Mendoza',
        usuarioRol: 'ADMIN',
        accion: 'configurar',
        modulo: 'institucion',
        entidad: 'configuracion',
        entidadId: '1',
        descripcion: 'Actualizó datos generales de la institución',
        detalle: { campos: ['director', 'anio', 'notaMinima'] },
        ip: '192.168.1.10',
        nivel: 'info',
        createdAt: new Date('2026-06-15T09:12:00'),
      },
      {
        usuarioId: 2,
        usuarioNombre: 'Ana Garcia',
        usuarioRol: 'SECRETARIA',
        accion: 'crear',
        modulo: 'matricula',
        entidad: 'estudiante',
        entidadId: '2026-045',
        descripcion: 'Registró nueva matrícula: Sofia Ramos Cruz — 5° Primaria A',
        detalle: { dni: '72345123', nivel: 'Primaria', grado: '5°' },
        ip: '192.168.1.22',
        nivel: 'info',
        createdAt: new Date('2026-06-14T10:45:00'),
      },
      {
        usuarioId: 3,
        usuarioNombre: 'J. Pérez',
        usuarioRol: 'DOCENTE',
        accion: 'publicar',
        modulo: 'recursos',
        entidad: 'material',
        entidadId: '12',
        descripcion: 'Publicó tarea "Problemas con fracciones" en Matemática 5°A',
        detalle: { tipo: 'tarea', fechaEntrega: '2026-06-24' },
        ip: '10.0.0.55',
        nivel: 'info',
        createdAt: new Date('2026-06-14T15:20:00'),
      },
      {
        usuarioId: 3,
        usuarioNombre: 'J. Pérez',
        usuarioRol: 'DOCENTE',
        accion: 'actualizar',
        modulo: 'asistencia',
        entidad: 'asistencia',
        entidadId: '2026-06-14',
        descripcion: 'Registró asistencia del 14/06 — Matemática 5°A (28 presentes, 2 faltas)',
        ip: '10.0.0.55',
        nivel: 'info',
        createdAt: new Date('2026-06-14T16:05:00'),
      },
      {
        usuarioId: 1,
        usuarioNombre: 'Carlos Mendoza',
        usuarioRol: 'ADMIN',
        accion: 'aprobar',
        modulo: 'evaluacion',
        entidad: 'acta',
        entidadId: '3',
        descripcion: 'Aprobó acta de evaluación — Matemática 5°A, 2° Bimestre',
        ip: '192.168.1.10',
        nivel: 'info',
        createdAt: new Date('2026-06-13T11:30:00'),
      },
      {
        usuarioId: 2,
        usuarioNombre: 'Ana Garcia',
        usuarioRol: 'SECRETARIA',
        accion: 'crear',
        modulo: 'comunicaciones',
        entidad: 'comunicado',
        entidadId: '8',
        descripcion: 'Publicó comunicado "Calendario de evaluaciones — 2° Bimestre"',
        detalle: { destinatarios: 'alumnos', prioridad: 'media' },
        ip: '192.168.1.22',
        nivel: 'info',
        createdAt: new Date('2026-06-13T09:00:00'),
      },
      {
        usuarioId: 1,
        usuarioNombre: 'Carlos Mendoza',
        usuarioRol: 'ADMIN',
        accion: 'actualizar',
        modulo: 'usuarios',
        entidad: 'usuario',
        entidadId: '15',
        descripcion: 'Restableció contraseña del usuario docente.matematica',
        ip: '192.168.1.10',
        nivel: 'warning',
        createdAt: new Date('2026-06-12T14:18:00'),
      },
      {
        usuarioId: null,
        usuarioNombre: 'Sistema',
        usuarioRol: 'SISTEMA',
        accion: 'consultar',
        modulo: 'asistencia',
        entidad: 'alerta',
        entidadId: null,
        descripcion: 'Generó 4 alertas de ausentismo crítico para Primaria 5°',
        detalle: { alertas: 4, nivel: 'critico' },
        ip: '',
        nivel: 'warning',
        createdAt: new Date('2026-06-12T07:00:00'),
      },
      {
        usuarioId: 2,
        usuarioNombre: 'Ana Garcia',
        usuarioRol: 'SECRETARIA',
        accion: 'eliminar',
        modulo: 'matricula',
        entidad: 'lista_espera',
        entidadId: '7',
        descripcion: 'Eliminó solicitud de lista de espera — DNI 72345682',
        ip: '192.168.1.22',
        nivel: 'warning',
        createdAt: new Date('2026-06-11T16:40:00'),
      },
      {
        usuarioId: 1,
        usuarioNombre: 'Carlos Mendoza',
        usuarioRol: 'ADMIN',
        accion: 'exportar',
        modulo: 'evaluacion',
        entidad: 'promedios',
        entidadId: null,
        descripcion: 'Exportó reporte de promedios — Primaria 5°, 2° Bimestre',
        detalle: { formato: 'PDF', registros: 32 },
        ip: '192.168.1.10',
        nivel: 'info',
        createdAt: new Date('2026-06-11T10:15:00'),
      },
      {
        usuarioId: 4,
        usuarioNombre: 'Maria Lopez',
        usuarioRol: 'PADRE',
        accion: 'login',
        modulo: 'autenticacion',
        entidad: 'sesion',
        entidadId: null,
        descripcion: 'Inicio de sesión en portal de padres',
        ip: '201.234.56.78',
        nivel: 'info',
        createdAt: new Date('2026-06-10T19:30:00'),
      },
      {
        usuarioId: 1,
        usuarioNombre: 'Carlos Mendoza',
        usuarioRol: 'ADMIN',
        accion: 'rechazar',
        modulo: 'asistencia',
        entidad: 'justificacion',
        entidadId: '5',
        descripcion: 'Rechazó justificación de falta — documento incompleto',
        detalle: { estudiante: 'Carlos Mendoza Ruiz', fecha: '2026-06-08' },
        ip: '192.168.1.10',
        nivel: 'critical',
        createdAt: new Date('2026-06-10T12:00:00'),
      },
      {
        usuarioId: 3,
        usuarioNombre: 'J. Pérez',
        usuarioRol: 'DOCENTE',
        accion: 'actualizar',
        modulo: 'evaluacion',
        entidad: 'nota',
        entidadId: '156',
        descripcion: 'Ingresó notas del examen bimestral — Matemática 5°A',
        detalle: { alumnos: 30, bimestre: 2 },
        ip: '10.0.0.55',
        nivel: 'info',
        createdAt: new Date('2026-06-09T17:45:00'),
      },
      {
        usuarioId: 1,
        usuarioNombre: 'Carlos Mendoza',
        usuarioRol: 'ADMIN',
        accion: 'logout',
        modulo: 'autenticacion',
        entidad: 'sesion',
        entidadId: null,
        descripcion: 'Cierre de sesión',
        ip: '192.168.1.10',
        nivel: 'info',
        createdAt: new Date('2026-06-09T18:00:00'),
      },
    ];

    for (const entry of entries) {
      await repo.save(repo.create(entry));
    }
  }
}
