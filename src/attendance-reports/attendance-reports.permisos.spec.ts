import { ROLE_DEFINITIONS } from '../roles/roles.constants';

describe('attendance-reports permisos', () => {
  const byRole = Object.fromEntries(
    ROLE_DEFINITIONS.map((r) => [r.codigo, r.permisos as readonly string[]]),
  );

  it('SECRETARIA puede consultar reportes de asistencia', () => {
    expect(byRole.SECRETARIA).toContain('asistencia.reportes');
  });

  it('UGEL/DRE/MINEDU tienen asistencia.reportes', () => {
    expect(byRole.UGEL).toContain('asistencia.reportes');
    expect(byRole.DRE).toContain('asistencia.reportes');
    expect(byRole.MINEDU).toContain('asistencia.reportes');
  });
});
