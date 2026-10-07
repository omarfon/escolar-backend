import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { renameLegacyCurriculaTables } from './curricula/curricula-table-rename';
import { prepareConductIncidentsTable } from './conduct-incidents/conduct-incidents-migration';
import { prepareDocentesTable } from './maestros/docentes/docentes-migration';
import { prepareAuditLogsTable } from './audit-logs/audit-logs-migration';
import { preparePasswordResetTables } from './auth/password-reset-migration';
import { prepareUserRoleAssignmentsTable } from './users/user-roles-migration';
import { prepareStudentChangeLogsTable } from './students/student-change-audit-migration';
import { prepareStudentSensitiveNotificationsTable } from './students/student-sensitive-notification-migration';
import { prepareStudentSinDocumentoColumns } from './students/student-sin-documento-migration';
import { prepareStudentExceptionalEnrollmentColumns } from './students/student-exceptional-enrollment-migration';
import { prepareRepresentativeLinksTables } from './representative-links/representative-links-migration';
import { prepareStudentDocumentFilesTables } from './students/student-documents-migration';
import { prepareStudentWithdrawalsTable } from './students/student-withdrawal-migration';
import { prepareStudentReadmissionsTable } from './students/student-readmission-migration';
import { prepareEnrollmentEvaluationsTable } from './enrollment-evaluations/enrollment-evaluation-migration';
import { prepareEnrollmentFeedbacksTable } from './enrollment-feedback/enrollment-feedback-migration';
import { prepareMultiInstitution } from './institution/multi-institution-migration';
import { assertPadronProductionSafe } from './institution/institution-padron.validation';
import { prepareMaestrosInstitutionColumns } from './institution/maestros-institution-migration';
import { prepareSiagieAccess } from './institution/siagie-access-migration';
import { prepareTenantLinkage } from './institution/tenant-linkage-migration';
import { prepareSedeAdminRoles } from './roles/sede-admin-role';
import { prepareTransferRequestsTables } from './transfers/transfer-migration';
import { prepareGradeChangeLogsTable } from './grades/grade-change-audit-migration';
import { preparePerformanceIndexes } from './database/performance-indexes-migration';
import { prepareSedesTable } from './institution/sedes-migration';
import { prepareAniosEscolaresTables } from './maestros/anios-escolares/anios-escolares-migration';
import { prepareAttendanceRecurrentAlertsTables } from './attendances/attendance-recurrent-alerts-migration';
import { prepareGradingScaleConfigTables } from './grading/grading-scale-config-migration';
import { prepareCompetencyChangeAuditTables } from './competency-evaluations/competency-change-audit-migration';
import { prepareDiagnosticEvaluationsTables } from './diagnostic-evaluations/diagnostic-evaluations-migration';
import { prepareEvaluationReportJobsTable } from './evaluation-reports/evaluation-report-jobs-migration';
import { prepareEnrollmentReportJobsTable } from './enrollment-reports/enrollment-report-jobs-migration';
import { prepareAttendanceReportJobsTable } from './attendance-reports/attendance-report-jobs-migration';
import { prepareCurriculaPermissions } from './curricula/curricula-permissions-migration';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StudentDocumentsModule } from './students/student-documents.module';
import { StudentsModule } from './students/students.module';
import { CoursesModule } from './courses/courses.module';
import { SchedulesModule } from './schedules/schedules.module';
import { GradesModule } from './grades/grades.module';
import { AttendancesModule } from './attendances/attendances.module';
import { TasksModule } from './tasks/tasks.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { AuthCacheModule } from './auth/auth-cache.module';
import { CatalogCacheModule } from './common/catalog-cache.module';
import { AuthModule } from './auth/auth.module';
import { InstitutionModule } from './institution/institution.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { RbacModule } from './rbac/rbac.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { ActasModule } from './actas/actas.module';
import { EventsModule } from './events/events.module';
import { ResourcesModule } from './resources/resources.module';
import { ParentsModule } from './parents/parents.module';
import { RepresentativeLinksModule } from './representative-links/representative-links.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { ConductIncidentsModule } from './conduct-incidents/conduct-incidents.module';
import { ContinuityEnrollmentModule } from './continuity-enrollment/continuity-enrollment.module';
import { EnrollmentEvaluationsModule } from './enrollment-evaluations/enrollment-evaluation.module';
import { EnrollmentFeedbackModule } from './enrollment-feedback/enrollment-feedback.module';
import { EnrollmentHistoryModule } from './enrollment-history/enrollment-history.module';
import { TransfersModule } from './transfers/transfer-request.module';
import { MaestrosModule } from './maestros/maestros.module';
import { CurriculaModule } from './curricula/curricula.module';
import { HorariosModule } from './horarios/horarios.module';
import { CompetencyEvaluationsModule } from './competency-evaluations/competency-evaluations.module';
import { DiagnosticEvaluationsModule } from './diagnostic-evaluations/diagnostic-evaluations.module';
import { EvaluationReportsModule } from './evaluation-reports/evaluation-reports.module';
import { EnrollmentReportsModule } from './enrollment-reports/enrollment-reports.module';
import { AttendanceReportsModule } from './attendance-reports/attendance-reports.module';
import { TerritorialReportsModule } from './territorial-reports/territorial-reports.module';
import { ReportCardsModule } from './report-cards/report-cards.module';
import { TemarioModule } from './temario/temario.module';
import { TreasuryModule } from './treasury/treasury.module';
import { GradingModule } from './grading/grading.module';
import { PromediosModule } from './promedios/promedios.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { MailModule } from './mail/mail.module';
import { DocumentStorageModule } from './storage/document-storage.module';
import { DatabaseSeedService } from './database/database-seed.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
      {
        name: 'auth',
        ttl: 60_000,
        limit: 20,
      },
    ]),
    DocumentStorageModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', '127.0.0.1'),
        port: Number(config.get<string>('DB_PORT', '5433')),
        username: config.get<string>('DB_USER', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_NAME', 'escolar'),
        autoLoadEntities: true,
        synchronize: config.get<string>('NODE_ENV', 'development') !== 'production',
        connectTimeoutMS: 10_000,
        extra: {
          connectionTimeoutMillis: 10_000,
          max: Number(config.get<string>('DB_POOL_MAX', '20')),
          min: Number(config.get<string>('DB_POOL_MIN', '2')),
          idleTimeoutMillis: 30_000,
        },
      }),
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error('Invalid TypeORM options');
        }
        const migrationDs = new DataSource({ ...options, synchronize: false });
        await migrationDs.initialize();
        await renameLegacyCurriculaTables(migrationDs);
        await prepareConductIncidentsTable(migrationDs);
        await prepareDocentesTable(migrationDs);
        await prepareSedesTable(migrationDs);
        await prepareAuditLogsTable(migrationDs);
        await preparePasswordResetTables(migrationDs);
        await prepareUserRoleAssignmentsTable(migrationDs);
        await prepareStudentChangeLogsTable(migrationDs);
        await prepareStudentSensitiveNotificationsTable(migrationDs);
        await prepareStudentSinDocumentoColumns(migrationDs);
        await prepareStudentExceptionalEnrollmentColumns(migrationDs);
        await prepareRepresentativeLinksTables(migrationDs);
        await prepareStudentDocumentFilesTables(migrationDs);
        await prepareStudentWithdrawalsTable(migrationDs);
        await prepareStudentReadmissionsTable(migrationDs);
        await prepareEnrollmentEvaluationsTable(migrationDs);
        await prepareEnrollmentFeedbacksTable(migrationDs);
        await prepareTransferRequestsTables(migrationDs);
        await prepareAniosEscolaresTables(migrationDs);
        await prepareAttendanceRecurrentAlertsTables(migrationDs);
        await prepareGradingScaleConfigTables(migrationDs);
        await prepareCompetencyChangeAuditTables(migrationDs);
        await prepareDiagnosticEvaluationsTables(migrationDs);
        await prepareEvaluationReportJobsTable(migrationDs);
        await prepareEnrollmentReportJobsTable(migrationDs);
        await prepareAttendanceReportJobsTable(migrationDs);
        await prepareCurriculaPermissions(migrationDs);
        const nodeEnv = process.env.NODE_ENV ?? 'development';
        await prepareMultiInstitution(migrationDs, {
          includeDemoPadron: nodeEnv !== 'production',
        });
        await assertPadronProductionSafe(migrationDs, nodeEnv);
        await prepareMaestrosInstitutionColumns(migrationDs);
        await prepareSiagieAccess(migrationDs);
        await prepareTenantLinkage(migrationDs);
        await prepareSedeAdminRoles(migrationDs);
        await prepareGradeChangeLogsTable(migrationDs);
        await preparePerformanceIndexes(migrationDs);
        await migrationDs.destroy();

        const dataSource = new DataSource(options);
        await dataSource.initialize();
        return dataSource;
      },
    }),
    AuthCacheModule,
    CatalogCacheModule,
    AuthModule,
    StudentDocumentsModule,
    StudentsModule,
    CoursesModule,
    SchedulesModule,
    GradesModule,
    AttendancesModule,
    TasksModule,
    AnnouncementsModule,
    InstitutionModule,
    UsersModule,
    RolesModule,
    RbacModule,
    WaitlistModule,
    ActasModule,
    EventsModule,
    ResourcesModule,
    ParentsModule,
    RepresentativeLinksModule,
    AuditLogsModule,
    ConductIncidentsModule,
    ContinuityEnrollmentModule,
    EnrollmentEvaluationsModule,
    EnrollmentFeedbackModule,
    EnrollmentHistoryModule,
    TransfersModule,
    MaestrosModule,
    CurriculaModule,
    HorariosModule,
    CompetencyEvaluationsModule,
    DiagnosticEvaluationsModule,
    EvaluationReportsModule,
    EnrollmentReportsModule,
    AttendanceReportsModule,
    TerritorialReportsModule,
    ReportCardsModule,
    TemarioModule,
    TreasuryModule,
    GradingModule,
    PromediosModule,
    DashboardModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    DatabaseSeedService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
