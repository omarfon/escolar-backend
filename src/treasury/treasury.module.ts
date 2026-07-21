import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PaymentConcept } from './entities/payment-concept.entity';
import { StudentCharge } from './entities/student-charge.entity';
import { StudentPayment } from './entities/student-payment.entity';
import { Student } from '../students/entities/student.entity';
import { Institution } from '../institution/entities/institution.entity';
import { TreasuryService } from './treasury.service';
import { TreasuryController } from './treasury.controller';
import { TreasuryPaymentsController } from './treasury-payments.controller';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      PaymentConcept,
      StudentCharge,
      StudentPayment,
      Student,
      Institution,
    ]),
  ],
  controllers: [TreasuryController, TreasuryPaymentsController],
  providers: [TreasuryService],
  exports: [TreasuryService],
})
export class TreasuryModule {}
