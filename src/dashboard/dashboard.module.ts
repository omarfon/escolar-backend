import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { TreasuryModule } from '../treasury/treasury.module';
import { MaestrosModule } from '../maestros/maestros.module';
import { Student } from '../students/entities/student.entity';
import { Docente } from '../maestros/docentes/entities/docente.entity';
import { Attendance } from '../attendances/entities/attendance.entity';
import { StudentCharge } from '../treasury/entities/student-charge.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    AuthModule,
    TreasuryModule,
    MaestrosModule,
    TypeOrmModule.forFeature([Student, Docente, Attendance, StudentCharge]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
