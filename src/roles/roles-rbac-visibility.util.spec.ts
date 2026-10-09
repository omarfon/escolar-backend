import {
  catalogoPermisosParaGestion,
  puedeVerCatalogoRbacCompleto,
  rolVisibleParaGestion,
} from './roles-rbac-visibility.util';

describe('roles-rbac-visibility', () => {
  it('ADMIN y SIAGIE ven catálogo completo', () => {
    expect(puedeVerCatalogoRbacCompleto({ roles: ['ADMIN'], rolPrincipal: 'ADMIN' })).toBe(true);
    expect(puedeVerCatalogoRbacCompleto({ roles: ['SIAGIE'], rolPrincipal: 'SIAGIE' })).toBe(true);
    expect(puedeVerCatalogoRbacCompleto({ roles: ['DIRECTOR'], rolPrincipal: 'DIRECTOR' })).toBe(
      false,
    );
  });

  it('oculta permisos admin.* fuera del catálogo completo', () => {
    const reducido = catalogoPermisosParaGestion(false);
    const codigos = reducido.flatMap((s) => s.permisos.map((p) => p.codigo));
    expect(codigos.some((c) => c.startsWith('admin.'))).toBe(false);
    expect(codigos).not.toContain('dashboard.reportes');
  });

  it('oculta SIAGIE y territorial para gestores de sede', () => {
    const viewer = { roles: ['ADM1'], rolPrincipal: 'ADM1' };
    expect(rolVisibleParaGestion('SIAGIE', null, 1, viewer)).toBe(false);
    expect(rolVisibleParaGestion('UGEL', null, 1, viewer)).toBe(false);
    expect(rolVisibleParaGestion('DOCENTE', null, 1, viewer)).toBe(true);
  });

  it('ADMIN nacional ve roles reservados', () => {
    const viewer = { roles: ['ADMIN'], rolPrincipal: 'ADMIN' };
    expect(rolVisibleParaGestion('SIAGIE', null, 1, viewer)).toBe(true);
    expect(rolVisibleParaGestion('UGEL', null, 1, viewer)).toBe(true);
  });
});
