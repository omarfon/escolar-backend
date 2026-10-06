import {
  PERMISSION_SECTIONS,
  ROLE_DEFINITIONS,
} from '../roles/roles.constants';

describe('permiso matricula.retiro', () => {
  it('está definido en el catálogo RBAC', () => {
    const codes = PERMISSION_SECTIONS.flatMap((s) =>
      s.permisos.map((p) => p.codigo),
    );
    expect(codes).toContain('matricula.retiro');
  });

  it('está asignado a roles de IE que operan matrícula y no a UGEL/DRE/MINEDU', () => {
    const byRole = Object.fromEntries(
      ROLE_DEFINITIONS.map((r) => [r.codigo, r.permisos as readonly string[]]),
    );
    expect(byRole['ADMIN']).toContain('matricula.retiro');
    expect(byRole['DIRECTOR']).toContain('matricula.retiro');
    expect(byRole['SECRETARIA']).toContain('matricula.retiro');
    expect(byRole['UGEL']).not.toContain('matricula.retiro');
    expect(byRole['DRE']).not.toContain('matricula.retiro');
    expect(byRole['MINEDU']).not.toContain('matricula.retiro');
    expect(byRole['UGEL']).toContain('matricula.exportar');
  });
});
