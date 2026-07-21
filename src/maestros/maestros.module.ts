import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Salon } from './salones/entities/salon.entity';
import { MaestroCurso } from './cursos/entities/maestro-curso.entity';
import { MaestroConductaTipo } from './faltas-reconocimientos/entities/maestro-conducta-tipo.entity';
import { MaestroConductaDescripcion } from './faltas-reconocimientos/entities/maestro-conducta-descripcion.entity';
import { MaestroFeriado } from './feriados/entities/maestro-feriado.entity';
import { SalonesController } from './salones/salones.controller';
import { CursosMaestrosController } from './cursos/cursos.controller';
import { FaltasReconocimientosController } from './faltas-reconocimientos/faltas-reconocimientos.controller';
import { FeriadosMaestrosController } from './feriados/feriados.controller';
import { SalonesService } from './salones/salones.service';
import { CursosMaestrosService } from './cursos/cursos.service';
import { FaltasReconocimientosService } from './faltas-reconocimientos/faltas-reconocimientos.service';
import { FeriadosMaestrosService } from './feriados/feriados.service';
import { EventosMaestrosController } from './eventos/eventos.controller';
import { EventosMaestrosService } from './eventos/eventos.service';
import { DocentesMaestrosController } from './docentes/docentes.controller';
import { DocentesMaestrosService } from './docentes/docentes.service';
import { PeriodosAcademicosMaestrosController } from './periodos-academicos/periodos-academicos.controller';
import { PeriodosAcademicosMaestrosService } from './periodos-academicos/periodos-academicos.service';
import { MaestroPeriodoAcademico } from './periodos-academicos/entities/maestro-periodo-academico.entity';
import { SedesMaestrosController } from './sedes/sedes.controller';
import { SedesMaestrosService } from './sedes/sedes.service';
import { Student } from '../students/entities/student.entity';
import { Sede } from '../institution/entities/sede.entity';
import { Institution } from '../institution/entities/institution.entity';
import { EducationLevel } from '../institution/entities/education-level.entity';
import { GradeLevel } from '../institution/entities/grade-level.entity';
import { GradeSection } from '../institution/entities/grade-section.entity';
import { MaestroFormulaEvaluacion } from './formulas-evaluacion/entities/maestro-formula-evaluacion.entity';
import { FormulasEvaluacionMaestrosController } from './formulas-evaluacion/formulas-evaluacion.controller';
import { FormulasEvaluacionMaestrosService } from './formulas-evaluacion/formulas-evaluacion.service';
import { AuthModule } from '../auth/auth.module';
import { Evento } from '../events/entities/evento.entity';
import { Docente } from './docentes/entities/docente.entity';
import { User } from '../users/entities/user.entity';
import { CurriculumTeacherAssignment } from '../curricula/entities/curriculum-teacher-assignment.entity';
import { CurriculumSubject } from '../curricula/entities/curriculum-subject.entity';
import { HorarioBlock } from '../horarios/entities/horario-block.entity';
import { HorarioPeriodo } from '../horarios/entities/horario-periodo.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Salon,
      MaestroCurso,
      MaestroConductaTipo,
      MaestroConductaDescripcion,
      MaestroFeriado,
      MaestroPeriodoAcademico,
      Evento,
      Docente,
      User,
      CurriculumTeacherAssignment,
      CurriculumSubject,
      Sede,
      Institution,
      Student,
      EducationLevel,
      GradeLevel,
      GradeSection,
      MaestroFormulaEvaluacion,
      HorarioBlock,
      HorarioPeriodo,
    ]),
    AuthModule,
  ],
  controllers: [SalonesController, CursosMaestrosController, FaltasReconocimientosController, SedesMaestrosController, FeriadosMaestrosController, EventosMaestrosController, DocentesMaestrosController, PeriodosAcademicosMaestrosController, FormulasEvaluacionMaestrosController],
  providers: [SalonesService, CursosMaestrosService, FaltasReconocimientosService, SedesMaestrosService, FeriadosMaestrosService, EventosMaestrosService, DocentesMaestrosService, PeriodosAcademicosMaestrosService, FormulasEvaluacionMaestrosService],
  exports: [SalonesService, CursosMaestrosService, FaltasReconocimientosService, SedesMaestrosService, FeriadosMaestrosService, EventosMaestrosService, DocentesMaestrosService, PeriodosAcademicosMaestrosService, FormulasEvaluacionMaestrosService],
})
export class MaestrosModule {}
