import { REPRESENTANTE_VACIO, Student } from './entities/student.entity';
import {
  diffStudentSnapshots,
  extractSensitiveChanges,
  snapshotStudent,
} from './student-change-diff.util';

describe('student-change-diff.util', () => {
  const base = {
    id: 1,
    nombre: 'Ana',
    apellido: 'Perez',
    apellidoPaterno: 'Perez',
    apellidoMaterno: 'Lopez',
    email: 'ana@test.com',
    nivel: 'Secundaria',
    grado: '3ro',
    seccion: 'A',
    activo: true,
    codigo: 'EST001',
    dni: '12345678',
    tipoDocumento: 'DNI',
    fechaNac: '2010-01-01',
    sexo: 'F' as const,
    direccion: 'Av. 1',
    distrito: '',
    provincia: '',
    departamento: '',
    telefonoEmergencia: '',
    foto: '',
    grupoSanguineo: 'O+',
    alergias: '',
    condicionesSalud: '',
    observaciones: '',
    anioIngreso: '2026',
    estadoMatricula: 'activo' as const,
    estadoCambioSeccion: 'elegible' as const,
    conductaNota: 'AD',
    padre: { ...REPRESENTANTE_VACIO },
    madre: { ...REPRESENTANTE_VACIO },
    apoderado: { ...REPRESENTANTE_VACIO },
  } as Student;

  it('enmascara DNI en snapshot', () => {
    const snap = snapshotStudent(base);
    expect(String(snap['dni'])).toContain('5678');
    expect(String(snap['dni'])).not.toBe('12345678');
  });

  it('detecta cambios entre snapshots', () => {
    const before = snapshotStudent(base);
    const after = snapshotStudent({ ...base, seccion: 'B' });
    const diff = diffStudentSnapshots(before, after);
    expect(diff?.seccion).toEqual({ anterior: 'A', nuevo: 'B' });
  });

  it('retorna null si no hay cambios', () => {
    const snap = snapshotStudent(base);
    expect(diffStudentSnapshots(snap, { ...snap })).toBeNull();
  });

  it('enmascara email y teléfono en snapshot', () => {
    const snap = snapshotStudent({
      ...base,
      email: 'ana@test.com',
      telefonoEmergencia: '999888777',
    });
    expect(String(snap['email'])).not.toBe('ana@test.com');
    expect(String(snap['telefonoEmergencia'])).toContain('777');
  });

  it('extractSensitiveChanges filtra solo campos personales', () => {
    const diff = {
      seccion: { anterior: 'A', nuevo: 'B' },
      direccion: { anterior: 'Av. 1', nuevo: 'Av. 2' },
    };
    const sensitive = extractSensitiveChanges(diff);
    expect(Object.keys(sensitive)).toEqual(['direccion']);
  });
});
