import { PERMISSION_SECTIONS, ROLE_DEFINITIONS } from '../roles/roles.constants';

describe('permisos de traslados', () => {
  const codes = PERMISSION_SECTIONS.flatMap((s) => s.permisos.map((p) => p.codigo));
  const byRole = Object.fromEntries(
    ROLE_DEFINITIONS.map((r) => [r.codigo, r.permisos as readonly string[]]),
  );

  it('define ver, solicitar, resolver y aprobar en destino', () => {
    expect(codes).toEqual(
      expect.arrayContaining([
        'traslados.ver',
        'traslados.solicitar',
        'traslados.resolver',
        'traslados.aprobar_destino',
      ]),
    );
  });

  it('asigna la solicitud a la IE, la aprobación destino a secretaría y la resolución territorial', () => {
    expect(byRole['SECRETARIA']).toContain('traslados.solicitar');
    expect(byRole['SECRETARIA']).toContain('traslados.aprobar_destino');
    expect(byRole['SECRETARIA']).not.toContain('traslados.resolver');
    expect(byRole['UGEL']).toContain('traslados.resolver');
    expect(byRole['UGEL']).toContain('traslados.ver');
    expect(byRole['UGEL']).not.toContain('traslados.solicitar');
    expect(byRole['DRE']).toContain('traslados.resolver');
    expect(byRole['MINEDU']).toContain('traslados.ver');
    expect(byRole['MINEDU']).toContain('traslados.resolver');
    expect(byRole['TESORERO']).not.toContain('traslados.solicitar');
    expect(byRole['ADMIN']).toContain('traslados.solicitar');
  });
});
