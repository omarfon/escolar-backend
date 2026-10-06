import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Readable } from 'stream';
import {
  DOCUMENT_STORAGE,
  DocumentStorage,
  PutStudentDocumentInput,
  StoredDocumentFile,
} from './document-storage.interface';
import { LocalDocumentStorage } from './local-document.storage';
import { MinioDocumentStorage } from './minio-document.storage';

@Injectable()
export class DocumentStorageService {
  private readonly local = new LocalDocumentStorage();
  private minioReader: MinioDocumentStorage | null = null;

  constructor(
    @Inject(DOCUMENT_STORAGE) private readonly primary: DocumentStorage,
    private readonly config: ConfigService,
  ) {}

  get driver(): 'local' | 'minio' {
    return this.primary.driver;
  }

  putStudentDocument(input: PutStudentDocumentInput): Promise<StoredDocumentFile> {
    return this.primary.putStudentDocument(input);
  }

  async openReadStream(storagePath: string): Promise<Readable> {
    if (storagePath.startsWith('minio://')) {
      return this.getMinioReader().openReadStream(storagePath);
    }
    return this.local.openReadStream(storagePath);
  }

  async exists(storagePath: string): Promise<boolean> {
    if (storagePath.startsWith('minio://')) {
      return this.getMinioReader().exists(storagePath);
    }
    return this.local.exists(storagePath);
  }

  private getMinioReader(): MinioDocumentStorage {
    if (!this.minioReader) {
      this.minioReader = new MinioDocumentStorage({
        endpoint: this.config.get<string>('MINIO_ENDPOINT', '127.0.0.1'),
        port: Number(this.config.get<string>('MINIO_PORT', '9000')),
        useSsl: this.config.get<string>('MINIO_USE_SSL', 'false') === 'true',
        accessKey: this.config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
        secretKey: this.config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
        bucket: this.config.get<string>('MINIO_BUCKET', 'escolar-documents'),
        region: this.config.get<string>('MINIO_REGION', 'us-east-1'),
      });
    }
    return this.minioReader;
  }
}
