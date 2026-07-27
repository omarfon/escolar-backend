import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { renameLegacyCurriculaTables } from './curricula/curricula-table-rename';
import { prepareConductIncidentsTable } from './conduct-incidents/conduct-incidents-migration';
import { prepareDocentesTable } from './maestros/docentes/docentes-migration';
import { prepareAuditLogsTable } from './audit-logs/audit-logs-migration';
import { prepareSedesTable } from './institution/sedes-migration';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StudentsModule } from './students/students.module';
import { CoursesModule } from './courses/courses.module';
import { SchedulesModule } from './schedules/schedules.module';
import { GradesModule } from './grades/grades.module';
import { AttendancesModule } from './attendances/attendances.module';
import { TasksModule } from './tasks/tasks.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { AuthModule } from './auth/auth.module';
import { InstitutionModule } from './institution/institution.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { ActasModule } from './actas/actas.module';
import { EventsModule } from './events/events.module';
import { ResourcesModule } from './resources/resources.module';
import { ParentsModule } from './parents/parents.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { ConductIncidentsModule } from './conduct-incidents/conduct-incidents.module';
import { ContinuityEnrollmentModule } from './continuity-enrollment/continuity-enrollment.module';
import { MaestrosModule } from './maestros/maestros.module';
import { CurriculaModule } from './curricula/curricula.module';
import { HorariosModule } from './horarios/horarios.module';
import { CompetencyEvaluationsModule } from './competency-evaluations/competency-evaluations.module';
import { ReportCardsModule } from './report-cards/report-cards.module';
import { TemarioModule } from './temario/temario.module';
import { TreasuryModule } from './treasury/treasury.module';
import { GradingModule } from './grading/grading.module';
import { PromediosModule } from './promedios/promedios.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { MailModule } from './mail/mail.module';
import { DatabaseSeedService } from './database/database-seed.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_NAME', 'escolar'),
        autoLoadEntities: true,
        synchronize: true,
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
        await migrationDs.destroy();

        const dataSource = new DataSource(options);
        await dataSource.initialize();
        return dataSource;
      },
    }),
    AuthModule,
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
    WaitlistModule,
    ActasModule,
    EventsModule,
    ResourcesModule,
    ParentsModule,
    AuditLogsModule,
    ConductIncidentsModule,
    ContinuityEnrollmentModule,
    MaestrosModule,
    CurriculaModule,
    HorariosModule,
    CompetencyEvaluationsModule,
    ReportCardsModule,
    TemarioModule,
    TreasuryModule,
    GradingModule,
    PromediosModule,
    DashboardModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService, DatabaseSeedService],
})
export class AppModule {}
