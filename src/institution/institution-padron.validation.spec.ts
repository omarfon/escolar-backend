import {
  assertPadronProductionSafe,
  institutionHasPlaceholderPadron,
  isPlaceholderTerritorialValue,
} from './institution-padron.validation';

describe('institution-padron.validation', () => {
  it('detecta UGEL/DRE placeholder', () => {
    expect(isPlaceholderTerritorialValue('UGEL Destino')).toBe(true);
    expect(isPlaceholderTerritorialValue('DRE Lima')).toBe(false);
    expect(institutionHasPlaceholderPadron({ ugel: 'UGEL 04', dre: 'DRE Lima' })).toBe(false);
    expect(
      institutionHasPlaceholderPadron({
        ugel: 'UGEL 04',
        dre: 'DRE Lima',
        nombre: 'IE Destino E2E',
      }),
    ).toBe(true);
  });

  it('bloquea arranque en producción con padrón inválido', async () => {
    const ds = {
      query: jest.fn(async () => [
        {
          id: 3,
          nombre: 'IE Destino E2E',
          codigoModular: '7654321',
          ugel: 'UGEL Destino',
          dre: 'DRE Destino',
        },
      ]),
    };

    await expect(assertPadronProductionSafe(ds as never, 'production')).rejects.toThrow(
      /Padrón institucional inválido/,
    );
  });

  it('no valida en desarrollo', async () => {
    const ds = { query: jest.fn() };
    await expect(assertPadronProductionSafe(ds as never, 'development')).resolves.toBeUndefined();
    expect(ds.query).not.toHaveBeenCalled();
  });
});
