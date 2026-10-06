import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Logger } from '@nestjs/common';
import { extname } from 'path';
import type { Readable } from 'stream';
import {
  DocumentStorage,
  PutStudentDocumentInput,
  StoredDocumentFile,
} from './document-storage.interface';

export interface MinioStorageConfig {
  endpoint: string;
  port: number;
  useSsl: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
}

export class MinioDocumentStorage extends DocumentStorage {
  readonly driver = 'minio' as const;
  private readonly logger = new Logger(MinioDocumentStorage.name);
  private readonly client: S3Client;
  private bucketReady = false;

  constructor(private readonly config: MinioStorageConfig) {
    super();
    const protocol = config.useSsl ? 'https' : 'http';
    this.client = new S3Client({
      region: config.region,
      endpoint: `${protocol}://${config.endpoint}:${config.port}`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
    });
  }

  async ensureBucket(): Promise<void> {
    if (this.bucketReady) return;
    try {
      await this.client.send(
        new HeadBucketCommand({ Bucket: this.config.bucket }),
      );
    } catch {
      await this.client.send(
        new CreateBucketCommand({ Bucket: this.config.bucket }),
      );
      this.logger.log(`Bucket creado: ${this.config.bucket}`);
    }
    this.bucketReady = true;
  }

  async putStudentDocument(
    input: PutStudentDocumentInput,
  ): Promise<StoredDocumentFile> {
    await this.ensureBucket();

    const ext = extname(input.originalName) || mimeToExt(input.mimeType);
    const safeBase = input.originalName
      .replace(/[^\w.\-()áéíóúñÁÉÍÓÚÑ ]+/g, '_')
      .replace(/\.[^.]+$/, '');
    const objectKey = [
      'student-documents',
      String(input.studentId),
      String(input.documentId),
      `v${input.version}-${Date.now()}-${safeBase}${ext}`,
    ].join('/');

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
        Body: input.buffer,
        ContentType: input.mimeType,
        Metadata: {
          sha256: input.sha256,
          originalName: input.originalName,
        },
      }),
    );

    const storagePath = `minio://${this.config.bucket}/${objectKey}`;
    const url = `/uploads/${objectKey}`;

    return {
      storagePath,
      url,
      nombreArchivo: input.originalName,
      mimeType: input.mimeType,
      tamanoBytes: input.size,
      sha256: input.sha256,
    };
  }

  async openReadStream(storagePath: string): Promise<Readable> {
    const { bucket, key } = parseMinioPath(storagePath);
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    if (!response.Body) {
      throw new Error('Objeto vacío en MinIO');
    }
    return response.Body as Readable;
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      const { bucket, key } = parseMinioPath(storagePath);
      await this.client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }
}

export function parseMinioPath(storagePath: string): {
  bucket: string;
  key: string;
} {
  if (!storagePath.startsWith('minio://')) {
    throw new Error(`Ruta MinIO inválida: ${storagePath}`);
  }
  const withoutScheme = storagePath.slice('minio://'.length);
  const slash = withoutScheme.indexOf('/');
  if (slash <= 0) {
    throw new Error(`Ruta MinIO inválida: ${storagePath}`);
  }
  return {
    bucket: withoutScheme.slice(0, slash),
    key: withoutScheme.slice(slash + 1),
  };
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  };
  return map[mime] ?? '';
}
