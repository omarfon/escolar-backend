import { BadRequestException } from '@nestjs/common';
import { rmSync } from 'fs';
import { join } from 'path';
import { LocalDocumentStorage } from '../storage/local-document.storage';
import {
  computeFileSha256,
  validateStudentDocumentFile,
} from './student-document-upload.util';

describe('student-document-upload.util', () => {
  const mockFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File =>
    ({
      fieldname: 'file',
      originalname: 'fut.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 128,
      buffer: Buffer.from('%PDF-1.4 test'),
      ...overrides,
    }) as Express.Multer.File;

  it('rechaza archivos vacíos', () => {
    expect(() => validateStudentDocumentFile(mockFile({ buffer: Buffer.alloc(0), size: 0 })))
      .toThrow(BadRequestException);
  });

  it('rechaza mime no permitido', () => {
    expect(() =>
      validateStudentDocumentFile(mockFile({ mimetype: 'application/x-msdownload' })),
    ).toThrow(BadRequestException);
  });

  it('calcula sha256 estable', () => {
    const buf = Buffer.from('escolar');
    expect(computeFileSha256(buf)).toHaveLength(64);
    expect(computeFileSha256(buf)).toBe(computeFileSha256(buf));
  });
});

describe('LocalDocumentStorage', () => {
  it('guarda archivo en uploads/', async () => {
    const storage = new LocalDocumentStorage();
    const buffer = Buffer.from('%PDF-1.4 test');
    const saved = await storage.putStudentDocument({
      studentId: 99,
      documentId: 88,
      version: 1,
      buffer,
      originalName: 'fut.pdf',
      mimeType: 'application/pdf',
      size: buffer.length,
      sha256: computeFileSha256(buffer),
    });
    expect(saved.url).toContain('/uploads/student-documents/99/88/');
    expect(await storage.exists(saved.storagePath)).toBe(true);
    rmSync(join(process.cwd(), 'uploads', 'student-documents', '99'), {
      recursive: true,
      force: true,
    });
  });
});
