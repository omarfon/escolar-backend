import { ROLE_DEFINITIONS } from '../roles/roles.constants';

describe('territorial-reports permisos', () => {
  const byRole = Object.fromEntries(
    ROLE_DEFINITIONS.map((r) => [r.codigo, r.permisos as readonly string[]]),
  );

  it('UGEL/DRE/MINEDU tienen dashboard.reportes', () => {
    expect(byRole.UGEL).toContain('dashboard.reportes');
    expect(byRole.DRE).toContain('dashboard.reportes');
    expect(byRole.MINEDU).toContain('dashboard.reportes');
  });

  it('UGEL/DRE/MINEDU tienen evaluacion.reportes', () => {
    expect(byRole.UGEL).toContain('evaluacion.reportes');
    expect(byRole.DRE).toContain('evaluacion.reportes');
    expect(byRole.MINEDU).toContain('evaluacion.reportes');
  });
});
