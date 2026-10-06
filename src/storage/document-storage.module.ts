import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  DOCUMENT_STORAGE,
  DocumentStorage,
} from './document-storage.interface';
import { DocumentStorageService } from './document-storage.service';
import { LocalDocumentStorage } from './local-document.storage';
import { MinioDocumentStorage } from './minio-document.storage';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DOCUMENT_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): DocumentStorage => {
        const driver = config.get<string>('STORAGE_DRIVER', 'local').trim();
        if (driver === 'minio') {
          return new MinioDocumentStorage({
            endpoint: config.get<string>('MINIO_ENDPOINT', '127.0.0.1'),
            port: Number(config.get<string>('MINIO_PORT', '9000')),
            useSsl: config.get<string>('MINIO_USE_SSL', 'false') === 'true',
            accessKey: config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
            secretKey: config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
            bucket: config.get<string>('MINIO_BUCKET', 'escolar-documents'),
            region: config.get<string>('MINIO_REGION', 'us-east-1'),
          });
        }
        return new LocalDocumentStorage();
      },
    },
    DocumentStorageService,
  ],
  exports: [DOCUMENT_STORAGE, DocumentStorageService],
})
export class DocumentStorageModule {}
