import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ConfigService } from '@nestjs/config';
import { TENANT_INSTITUTION_HEADER } from '../auth/tenant-scope.util';

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://[::1]:4200',
];

/** Orígenes HTTPS habituales si no se configura nada en producción */
const DEFAULT_PROD_ORIGINS = [
  'https://royal-escolar.rsdev.site',
  'https://www.royal-escolar.rsdev.site',
];

/** localhost / 127.0.0.1 / [::1] con cualquier puerto */
const LOCALHOST_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/** Red local (LAN) */
const LAN_ORIGIN =
  /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/i;

export interface CorsPolicy {
  exactOrigins: string[];
  wildcardPatterns: RegExp[];
  allowAll: boolean;
  allowDevLan: boolean;
  allowLocalhost: boolean;
}

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function wildcardToRegExp(pattern: string): RegExp {
  const normalized = normalizeOrigin(pattern);
  const withScheme =
    normalized.includes('://') || normalized.startsWith('*')
      ? normalized
      : `https://${normalized}`;
  const escaped = withScheme.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const regexBody = escaped.replace(/\*/g, '[^/:\\s]*');
  return new RegExp(`^${regexBody}$`, 'i');
}

function splitEnvList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);
}

export function buildCorsPolicy(config: ConfigService): CorsPolicy {
  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';

  const fromOrigins = splitEnvList(config.get<string>('CORS_ORIGINS'));
  const fromPatterns = splitEnvList(config.get<string>('CORS_ORIGIN_PATTERNS'));
  const frontendUrl = normalizeOrigin(config.get<string>('FRONTEND_URL', ''));

  const exactOrigins = new Set<string>();
  const wildcardPatterns: RegExp[] = [];

  for (const entry of [...fromOrigins, frontendUrl]) {
    if (!entry || entry === '*') continue;
    if (entry.includes('*')) {
      wildcardPatterns.push(wildcardToRegExp(entry));
    } else {
      exactOrigins.add(entry);
    }
  }

  for (const pattern of fromPatterns) {
    wildcardPatterns.push(wildcardToRegExp(pattern));
  }

  if (exactOrigins.size === 0 && wildcardPatterns.length === 0) {
    const defaults = isProduction ? DEFAULT_PROD_ORIGINS : DEFAULT_DEV_ORIGINS;
    for (const origin of defaults) exactOrigins.add(origin);
  }

  const allowAll = fromOrigins.includes('*');
  const allowDevLan = config.get<string>('CORS_ALLOW_LAN', isProduction ? 'false' : 'true') === 'true';
  const allowLocalhost =
    config.get<string>('CORS_ALLOW_LOCALHOST', isProduction ? 'false' : 'true') === 'true';

  return {
    exactOrigins: [...exactOrigins],
    wildcardPatterns,
    allowAll,
    allowDevLan,
    allowLocalhost,
  };
}

export function parseCorsOrigins(config: ConfigService): string[] {
  return buildCorsPolicy(config).exactOrigins;
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  policy: CorsPolicy,
): boolean {
  if (!origin) return true;
  if (policy.allowAll) return true;
  if (policy.exactOrigins.includes(origin)) return true;
  if (policy.wildcardPatterns.some((pattern) => pattern.test(origin))) return true;
  if (policy.allowLocalhost && LOCALHOST_ORIGIN.test(origin)) return true;
  if (policy.allowDevLan && LAN_ORIGIN.test(origin)) return true;
  return false;
}

export function buildCorsOptions(config: ConfigService): CorsOptions {
  const policy = buildCorsPolicy(config);

  return {
    origin: (origin, callback) => {
      if (isCorsOriginAllowed(origin, policy)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'Cache-Control',
      'Pragma',
      'Idempotency-Key',
      TENANT_INSTITUTION_HEADER,
      'X-Institution-Id',
    ],
    exposedHeaders: ['Content-Disposition'],
    optionsSuccessStatus: 204,
    maxAge: 86_400,
  };
}

export function describeCorsPolicy(config: ConfigService): string {
  const policy = buildCorsPolicy(config);
  if (policy.allowAll) return 'CORS: todos los orígenes (*)';

  const parts: string[] = [`CORS: ${policy.exactOrigins.join(', ') || '(sin orígenes exactos)'}`];
  if (policy.wildcardPatterns.length) {
    parts.push(`${policy.wildcardPatterns.length} patrón(es) wildcard`);
  }
  if (policy.allowLocalhost) parts.push('localhost');
  if (policy.allowDevLan) parts.push('LAN');
  return parts.join(' · ');
}
