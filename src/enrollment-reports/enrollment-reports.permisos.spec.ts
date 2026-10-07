import {
  PERMISSION_SECTIONS,
  ROLE_DEFINITIONS,
} from '../roles/roles.constants';

describe('enrollment-reports permisos', () => {
  const allCodes = PERMISSION_SECTIONS.flatMap((s) => s.permisos.map((p) => p.codigo));
  const byRole = Object.fromEntries(
    ROLE_DEFINITIONS.map((r) => [r.codigo, r.permisos as readonly string[]]),
  );

  it('matricula.reportes está definido en catálogo', () => {
    expect(allCodes).toContain('matricula.reportes');
  });

  it('SECRETARIA puede consultar reportes de matrícula', () => {
    expect(byRole.SECRETARIA).toContain('matricula.reportes');
  });

  it('UGEL/DRE/MINEDU tienen matricula.reportes', () => {
    expect(byRole.UGEL).toContain('matricula.reportes');
    expect(byRole.DRE).toContain('matricula.reportes');
    expect(byRole.MINEDU).toContain('matricula.reportes');
  });
});
