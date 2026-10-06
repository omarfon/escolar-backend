import {
  aplicarFiltroTerritorialAlcance,
  nivelAlcanceTraslado,
  resolverAlcanceTerritorial,
  solicitudFueraDeAlcance,
} from './transfer-territorial-scope.util';
import type { TransferRequest } from './entities/transfer-request.entity';
import type { Institution } from '../institution/entities/institution.entity';

const institution = {
  id: 1,
  nombre: 'I.E. Referencia',
  codigoModular: '0654321',
  ugel: 'UGEL 01',
  dre: 'DRELM',
} as Institution;

const row = {
  ieOrigenCodigoModular: '0654321',
  ieDestinoCodigoModular: '7654321',
  ieOrigenUgel: 'UGEL 01',
  ieOrigenDre: 'DRELM',
  estado: 'enviada',
} as TransferRequest;

describe('transfer-territorial-scope.util', () => {
  it('resuelve UGEL desde asignación sin IE de referencia', () => {
    const scope = resolverAlcanceTerritorial(
      {
        req: {} as never,
        permisos: ['traslados.resolver'],
        ambitos: ['UGEL'],
        esAdmin: false,
        ugelCodigo: 'UGEL 01',
      },
      null,
    );
    expect(scope.nivel).toBe('UGEL');
    expect(scope.ugel).toBe('UGEL 01');
    expect(scope.fuente).toBe('asignacion');
    expect(scope.institution).toBeNull();
  });

  it('exige UGEL cuando no hay asignación ni IE de referencia', () => {
    expect(() =>
      resolverAlcanceTerritorial(
        {
          req: {} as never,
          permisos: ['traslados.resolver'],
          ambitos: ['UGEL'],
          esAdmin: false,
        },
        null,
      ),
    ).toThrow('Indique la UGEL de referencia');
  });

  it('resuelve DRE desde IE de referencia', () => {
    const scope = resolverAlcanceTerritorial(
      {
        req: {} as never,
        permisos: ['traslados.resolver'],
        ambitos: ['DRE'],
        esAdmin: false,
        institutionId: 1,
      },
      institution,
    );
    expect(scope.dre).toBe('DRELM');
    expect(scope.fuente).toBe('institucion_referencia');
  });

  it('MINEDU no filtra solicitudes fuera de alcance', () => {
    const scope = resolverAlcanceTerritorial(
      {
        req: {} as never,
        permisos: ['traslados.resolver'],
        ambitos: ['MINEDU'],
        esAdmin: false,
      },
      null,
    );
    expect(solicitudFueraDeAlcance(row, scope)).toBe(false);
  });

  it('UGEL filtra por ieOrigenUgel', () => {
    const scope = resolverAlcanceTerritorial(
      {
        req: {} as never,
        permisos: ['traslados.resolver'],
        ambitos: ['UGEL'],
        esAdmin: false,
        ugelCodigo: 'UGEL 99',
      },
      null,
    );
    expect(solicitudFueraDeAlcance(row, scope)).toBe(true);
  });

  it('aplica filtro SQL por UGEL', () => {
    const andWhere = jest.fn().mockReturnThis();
    const qb = { andWhere } as never;
    aplicarFiltroTerritorialAlcance(qb, {
      nivel: 'UGEL',
      ugel: 'UGEL 01',
      dre: null,
      institution: null,
      fuente: 'asignacion',
    });
    expect(andWhere).toHaveBeenCalledWith(
      'LOWER(t.ieOrigenUgel) = LOWER(:ugel)',
      { ugel: 'UGEL 01' },
    );
  });

  it('prioriza MINEDU sobre DRE en nivel de alcance', () => {
    expect(
      nivelAlcanceTraslado({
        esAdmin: false,
        ambitos: ['MINEDU', 'DRE'],
      }),
    ).toBe('MINEDU');
  });
});
