import {
  assertEvidenciaListaParaEnviar,
  resolverEvidenciaTraslado,
} from './transfer-evidencia.util';

describe('transfer-evidencia.util', () => {
  it('resuelve evidencia por documento del expediente', () => {
    const res = resolverEvidenciaTraslado(
      { tipo: 'documento', documentId: 12 },
      { id: 12, tipo: 'Resolución de traslado', numero: 'RD-001' },
    );
    expect(res.tipo).toBe('documento');
    expect(res.evidencia).toContain('RD-001');
  });

  it('resuelve evidencia por referencia administrativa', () => {
    const res = resolverEvidenciaTraslado({
      tipo: 'referencia',
      referencia: 'Resolución directoral 045-2026',
    });
    expect(res.tipo).toBe('referencia');
    expect(res.referencia).toBe('Resolución directoral 045-2026');
  });

  it('rechaza documento que no pertenece al estudiante', () => {
    expect(() =>
      resolverEvidenciaTraslado(
        { tipo: 'documento', documentId: 99 },
        { id: 12, tipo: 'DNI', numero: '123' },
      ),
    ).toThrow('no pertenece al estudiante');
  });

  it('permite enviar con evidencia legacy en texto', () => {
    expect(() =>
      assertEvidenciaListaParaEnviar({
        evidenciaTipo: null,
        evidenciaDocumentId: null,
        evidenciaReferencia: null,
        evidencia: 'Resolución 001 del director',
      }),
    ).not.toThrow();
  });

  it('exige documento vinculado al enviar', () => {
    expect(() =>
      assertEvidenciaListaParaEnviar({
        evidenciaTipo: 'documento',
        evidenciaDocumentId: null,
        evidenciaReferencia: null,
        evidencia: 'Documento: X',
      }),
    ).toThrow('documento de evidencia');
  });
});
