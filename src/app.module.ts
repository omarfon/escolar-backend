import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { ClassroomsModule } from './classrooms/classrooms.module';
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
    ClassroomsModule,
  ],
  controllers: [AppController],
  providers: [AppService, DatabaseSeedService],
})
export class AppModule {}
