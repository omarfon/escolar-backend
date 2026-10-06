import {
  PERMISSION_SECTIONS,
  ROLE_DEFINITIONS,
} from '../roles/roles.constants';

describe('permiso matricula.retroalimentacion', () => {
  it('está definido en el catálogo RBAC', () => {
    const codes = PERMISSION_SECTIONS.flatMap((s) =>
      s.permisos.map((p) => p.codigo),
    );
    expect(codes).toContain('matricula.retroalimentacion');
  });

  it('está asignado a roles de IE y no a UGEL/DRE/MINEDU', () => {
    const byRole = Object.fromEntries(
      ROLE_DEFINITIONS.map((r) => [r.codigo, r.permisos as readonly string[]]),
    );
    expect(byRole['ADMIN']).toContain('matricula.retroalimentacion');
    expect(byRole['SECRETARIA']).toContain('matricula.retroalimentacion');
    expect(byRole['UGEL']).not.toContain('matricula.retroalimentacion');
  });
});
