import { REPRESENTANTE_VACIO, Student } from './entities/student.entity';
import { findDuplicateCandidates } from './student-duplicate-match.util';

describe('student-duplicate-match.util', () => {
  const base = {
    id: 1,
    nombre: 'Juan',
    apellido: 'Perez',
    apellidoPaterno: 'Perez',
    apellidoMaterno: '',
    email: 'juan@test.com',
    nivel: 'Primaria',
    grado: '3ro',
    seccion: 'A',
    activo: true,
    codigo: 'EST001',
    dni: '12345678',
    tipoDocumento: 'DNI',
    fechaNac: '2015-05-10',
    sexo: 'M' as const,
    estadoDocumento: 'regular',
    sinDocumentoMotivo: '',
    sinDocumentoSustento: '',
    padre: { ...REPRESENTANTE_VACIO },
    madre: { ...REPRESENTANTE_VACIO },
    apoderado: { ...REPRESENTANTE_VACIO, dni: '87654321' },
  } as Student;

  it('detecta coincidencia por nombre, fecha y sexo', () => {
    const matches = findDuplicateCandidates([base], {
      nombres: 'Juan',
      apellidos: 'Perez',
      fechaNac: '2015-05-10',
      sexo: 'M',
    });
    expect(matches.length).toBe(1);
    expect(matches[0].coincidencias.length).toBeGreaterThanOrEqual(2);
  });

  it('no detecta si solo coincide el nombre', () => {
    const matches = findDuplicateCandidates([base], {
      nombres: 'Juan',
      apellidos: 'Perez',
      fechaNac: '2010-01-01',
      sexo: 'F',
    });
    expect(matches.length).toBe(0);
  });

  it('detecta coincidencia por DNI de apoderado', () => {
    const matches = findDuplicateCandidates([base], {
      nombres: 'Otro',
      apellidos: 'Alumno',
      fechaNac: '2015-05-10',
      sexo: 'M',
      apoderadoDni: '87654321',
    });
    expect(matches.length).toBe(1);
    expect(matches[0].coincidencias).toContain('DNI apoderado coincidente');
  });
});
