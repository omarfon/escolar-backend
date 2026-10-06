import { parseMinioPath } from './minio-document.storage';

describe('parseMinioPath', () => {
  it('extrae bucket y key', () => {
    const parsed = parseMinioPath(
      'minio://escolar-documents/student-documents/5/10/v1-file.pdf',
    );
    expect(parsed.bucket).toBe('escolar-documents');
    expect(parsed.key).toBe('student-documents/5/10/v1-file.pdf');
  });

  it('rechaza rutas inválidas', () => {
    expect(() => parseMinioPath('/uploads/local.pdf')).toThrow();
  });
});
