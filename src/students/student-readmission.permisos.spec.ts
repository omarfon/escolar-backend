import {
  PERMISSION_SECTIONS,
  ROLE_DEFINITIONS,
} from '../roles/roles.constants';

describe('permiso matricula.reingreso', () => {
  it('está definido en el catálogo RBAC', () => {
    const codes = PERMISSION_SECTIONS.flatMap((s) =>
      s.permisos.map((p) => p.codigo),
    );
    expect(codes).toContain('matricula.reingreso');
  });

  it('está asignado a roles de IE que operan matrícula y no a UGEL/DRE/MINEDU', () => {
    const byRole = Object.fromEntries(
      ROLE_DEFINITIONS.map((r) => [r.codigo, r.permisos as readonly string[]]),
    );
    expect(byRole['ADMIN']).toContain('matricula.reingreso');
    expect(byRole['DIRECTOR']).toContain('matricula.reingreso');
    expect(byRole['SECRETARIA']).toContain('matricula.reingreso');
    expect(byRole['UGEL']).not.toContain('matricula.reingreso');
    expect(byRole['DRE']).not.toContain('matricula.reingreso');
    expect(byRole['MINEDU']).not.toContain('matricula.reingreso');
  });
});
