import { Body, Controller, Get, Param, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CreateParentJustificationDto } from './dto/create-parent-justification.dto';
import { SendParentTeacherMessageDto } from './dto/send-parent-teacher-message.dto';
import { ParentsService } from './parents.service';
import { RequireRole } from '../auth/decorators/require-role.decorator';
import { PayVisaDto } from '../treasury/dto/pay-visa.dto';

@Controller('parents')
@RequireRole('PADRE')
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @Get('children')
  getChildren(@Query('email') email: string) {
    return this.parentsService.getChildren(email ?? '');
  }

  @Get('events')
  getEvents(@Query('email') email: string, @Query('mes') mes?: string) {
    return this.parentsService.getEventsForParent(email ?? '', mes);
  }

  @Get('teachers')
  getTeachers(@Query('email') email: string) {
    return this.parentsService.getTeachersForParent(email ?? '');
  }

  @Get('messages')
  getMessages(@Query('email') email: string) {
    return this.parentsService.getTeacherMessages(email ?? '');
  }

  @Post('messages')
  sendMessage(
    @Query('email') email: string,
    @Query('parentNombre') parentNombre: string | undefined,
    @Body() dto: SendParentTeacherMessageDto,
  ) {
    return this.parentsService.sendTeacherMessage(
      email ?? '',
      parentNombre ?? '',
      dto,
    );
  }

  @Get('children/:studentId/account-statement')
  getAccountStatement(
    @Param('studentId') studentId: string,
    @Query('email') email: string,
    @Query('anioEscolar') anioEscolar?: string,
  ) {
    return this.parentsService.getAccountStatementForChild(
      +studentId,
      email ?? '',
      anioEscolar ? +anioEscolar : undefined,
    );
  }

  @Post('children/:studentId/charges/:chargeId/pay-visa')
  payChargeWithVisa(
    @Param('studentId') studentId: string,
    @Param('chargeId') chargeId: string,
    @Query('email') email: string,
    @Query('parentNombre') parentNombre: string | undefined,
    @Body() dto: PayVisaDto,
  ) {
    return this.parentsService.payChargeWithVisa(
      +studentId,
      +chargeId,
      email ?? '',
      parentNombre ?? '',
      dto,
    );
  }

  @Get('children/:studentId/payments/:paymentId/receipt')
  getPaymentReceipt(
    @Param('studentId') studentId: string,
    @Param('paymentId') paymentId: string,
    @Query('email') email: string,
    @Query('parentNombre') parentNombre: string | undefined,
  ) {
    return this.parentsService.getPaymentReceiptForChild(
      +studentId,
      +paymentId,
      email ?? '',
      parentNombre ?? '',
    );
  }

  @Get('children/:studentId/horario')
  getHorario(
    @Param('studentId') studentId: string,
    @Query('email') email: string,
    @Query('anioEscolar') anioEscolar?: string,
  ) {
    return this.parentsService.getHorarioForChild(
      +studentId,
      email ?? '',
      anioEscolar ? +anioEscolar : undefined,
    );
  }

  @Get('children/:studentId/profile')
  getChildProfile(
    @Param('studentId') studentId: string,
    @Query('email') email: string,
  ) {
    return this.parentsService.getChildProfile(+studentId, email ?? '');
  }

  @Get('children/:studentId/tracking')
  getTracking(
    @Param('studentId') studentId: string,
    @Query('email') email?: string,
  ) {
    return this.parentsService.getAcademicTracking(+studentId, email);
  }

  @Get('children/:studentId/tasks')
  getTasks(
    @Param('studentId') studentId: string,
    @Query('email') email: string,
  ) {
    return this.parentsService.getTasksForChild(+studentId, email ?? '');
  }

  @Get('children/:studentId/clases')
  getClases(
    @Param('studentId') studentId: string,
    @Query('email') email: string,
    @Query('curso') curso?: string,
    @Query('anioEscolar') anioEscolar?: string,
  ) {
    return this.parentsService.getClasesForChild(+studentId, email ?? '', {
      curso: curso || undefined,
      anioEscolar: anioEscolar ? +anioEscolar : undefined,
    });
  }

  @Get('children/:studentId/justifications/pending')
  getPendingJustifications(
    @Param('studentId') studentId: string,
    @Query('email') email: string,
    @Query('mes') mes?: string,
  ) {
    return this.parentsService.getPendingJustifications(+studentId, email, mes);
  }

  @Get('children/:studentId/justifications')
  getJustifications(
    @Param('studentId') studentId: string,
    @Query('email') email: string,
    @Query('mes') mes?: string,
  ) {
    return this.parentsService.getJustifications(+studentId, email, mes);
  }

  @Post('children/:studentId/justifications')
  @UseInterceptors(FilesInterceptor('adjuntos', 5))
  createJustification(
    @Param('studentId') studentId: string,
    @Query('email') email: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: CreateParentJustificationDto,
  ) {
    return this.parentsService.createJustification(
      +studentId,
      email,
      dto,
      files ?? [],
    );
  }

  @Post('children/:studentId/absence-alerts/:alertId/read')
  markAbsenceAlertRead(
    @Param('studentId') studentId: string,
    @Param('alertId') alertId: string,
    @Query('email') email: string,
  ) {
    return this.parentsService.markAbsenceAlertRead(
      +studentId,
      email ?? '',
      +alertId,
    );
  }
}
