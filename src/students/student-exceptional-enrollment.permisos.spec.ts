import {
  PERMISSION_SECTIONS,
  ROLE_DEFINITIONS,
} from '../roles/roles.constants';

describe('permiso matricula.excepcional', () => {
  it('está definido en el catálogo RBAC', () => {
    const codes = PERMISSION_SECTIONS.flatMap((s) =>
      s.permisos.map((p) => p.codigo),
    );
    expect(codes).toContain('matricula.excepcional');
  });

  it('está asignado a roles de IE', () => {
    const byRole = Object.fromEntries(
      ROLE_DEFINITIONS.map((r) => [r.codigo, r.permisos as readonly string[]]),
    );
    expect(byRole['ADMIN']).toContain('matricula.excepcional');
    expect(byRole['SECRETARIA']).toContain('matricula.excepcional');
    expect(byRole['TESORERO']).not.toContain('matricula.excepcional');
  });
});
