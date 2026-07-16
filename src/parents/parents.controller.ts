import { Controller, Get, Param, Query } from '@nestjs/common';
import { ParentsService } from './parents.service';

@Controller('parents')
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @Get('children')
  getChildren(@Query('email') email: string) {
    return this.parentsService.getChildren(email ?? '');
  }

  @Get('children/:studentId/tracking')
  getTracking(
    @Param('studentId') studentId: string,
    @Query('email') email?: string,
  ) {
    return this.parentsService.getAcademicTracking(+studentId, email);
  }
}
