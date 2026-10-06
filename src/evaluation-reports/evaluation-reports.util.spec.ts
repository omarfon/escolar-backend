import {
  buildCsv,
  csvCell,
  matchesBusqueda,
  paginateRows,
} from './evaluation-reports.util';

describe('evaluation-reports.util', () => {
  it('paginateRows calcula páginas correctamente', () => {
    const rows = [1, 2, 3, 4, 5];
    const result = paginateRows(rows, 2, 2);
    expect(result.items).toEqual([3, 4]);
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 2,
      totalItems: 5,
      totalPages: 3,
    });
  });

  it('csvCell escapa comillas y comas', () => {
    expect(csvCell('Hola, "mundo"')).toBe('"Hola, ""mundo"""');
    expect(csvCell(null)).toBe('');
  });

  it('buildCsv genera encabezado y filas', () => {
    const csv = buildCsv(
      [{ key: 'a', label: 'Col A' }],
      [{ a: 'x' }],
    );
    expect(csv).toContain('Col A');
    expect(csv).toContain('x');
  });

  it('matchesBusqueda filtra por texto', () => {
    expect(matchesBusqueda('ana', 'Ana García')).toBe(true);
    expect(matchesBusqueda('xyz', 'Ana García')).toBe(false);
    expect(matchesBusqueda(undefined, 'Ana')).toBe(true);
  });
});
