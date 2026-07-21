import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { GradeTaskDto } from './dto/grade-task.dto';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';

@Controller('tasks')
@RequirePermiso('comunicados.ver')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.create(createTaskDto);
  }

  @Get()
  findAll(
    @Query('studentId') studentId?: string,
    @Query('resourceId') resourceId?: string,
    @Query('titulo') titulo?: string,
    @Query('curso') curso?: string,
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Query('seccion') seccion?: string,
  ) {
    return this.tasksService.findAll({
      studentId:
        studentId !== undefined && studentId !== '' ? +studentId : undefined,
      resourceId:
        resourceId !== undefined && resourceId !== '' ? +resourceId : undefined,
      titulo: titulo || undefined,
      curso: curso || undefined,
      nivel: nivel || undefined,
      grado: grado || undefined,
      seccion: seccion || undefined,
    });
  }

  @Get('entregas')
  findEntregas(
    @Query('resourceId') resourceId: string,
    @Query('nivel') nivel?: string,
    @Query('grado') grado?: string,
    @Query('seccion') seccion?: string,
  ) {
    return this.tasksService.findEntregasForResource({
      resourceId: +resourceId,
      nivel: nivel || undefined,
      grado: grado || undefined,
      seccion: seccion || undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(+id);
  }

  @Post(':id/submit')
  @UseInterceptors(FileInterceptor('file'))
  submit(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('comentario') comentario?: string,
  ) {
    return this.tasksService.submit(+id, file, comentario);
  }

  @Patch(':id/grade')
  @RequirePermiso('comunicados.enviar')
  grade(@Param('id') id: string, @Body() dto: GradeTaskDto) {
    return this.tasksService.grade(+id, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto) {
    return this.tasksService.update(+id, updateTaskDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tasksService.remove(+id);
  }
}
