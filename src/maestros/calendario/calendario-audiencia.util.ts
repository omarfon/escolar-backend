import { Repository } from 'typeorm';
import { RequestUser } from '../../auth/interfaces/request-user.interface';
import { Student } from '../../students/entities/student.entity';
import { User } from '../../users/entities/user.entity';
import {
  CalendarioAudienciaContext,
  CalendarioRolVista,
  resolveCalendarioRolVista,
} from './calendario-role-filter.util';

export async function resolveCalendarioAudiencia(
  studentRepo: Repository<Student>,
  userRepo: Repository<User>,
  user: RequestUser,
  rolVista?: CalendarioRolVista,
): Promise<CalendarioAudienciaContext | undefined> {
  const rol = rolVista ?? resolveCalendarioRolVista(user);
  if (rol !== 'alumno') return undefined;

  const login = user.username.trim().toLowerCase();
  let email = login.includes('@') ? login : null;
  if (!email) {
    const row = await userRepo.findOne({ where: { username: user.username } });
    email = row?.email?.trim().toLowerCase() ?? null;
  }
  if (!email) return undefined;

  const student = await studentRepo.findOneBy({ email });
  if (!student) return undefined;

  return {
    nivel: student.nivel,
    grado: student.grado,
    seccion: student.seccion,
  };
}
