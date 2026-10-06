import { codigoNacionalDeAlumno } from './codigo-alumno.util';

describe('codigoNacionalDeAlumno', () => {
  it('usa el documento y no depende de la institución', () => {
    expect(codigoNacionalDeAlumno({ id: 6, tipoDocumento: 'DNI', dni: '71234568' })).toBe(
      'DNI-71234568',
    );
    expect(codigoNacionalDeAlumno({ id: 8, tipoDocumento: '', dni: '' })).toBe('ALU-000008');
  });
});
