import { ConfigService } from '@nestjs/config';

/** Credenciales y opciones SMTP — editar en `.env` (ver `.env.example`). */
export interface MailEnvConfig {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  fromName: string;
  replyTo: string;
  testTo: string;
  devFallback: 'ethereal' | 'off';
}

export type MailTransportMode = 'smtp' | 'ethereal' | 'off';

export function isSendGridHost(host: string): boolean {
  return host.toLowerCase().includes('sendgrid');
}

export function readMailEnv(config: ConfigService): MailEnvConfig {
  const user = (config.get<string>('MAIL_USER') ?? '').trim();
  const pass = (config.get<string>('MAIL_PASS') ?? '').trim();
  const host = (config.get<string>('SMTP_HOST') ?? '').trim();
  const fromExplicit = (config.get<string>('MAIL_FROM') ?? '').trim();
  // SendGrid: MAIL_USER suele ser "apikey"; el remitente real va en MAIL_FROM (verificado en SendGrid).
  const from =
    fromExplicit ||
    (isSendGridHost(host) && user.toLowerCase() === 'apikey' ? '' : user);
  const replyTo = (config.get<string>('MAIL_REPLY_TO') ?? '').trim() || from;
  const devFallbackRaw = (config.get<string>('MAIL_DEV_FALLBACK') ?? 'ethereal')
    .trim()
    .toLowerCase();

  return {
    enabled: config.get<string>('MAIL_ENABLED', 'true') !== 'false',
    host,
    port: Number(config.get<string>('SMTP_PORT', '587')),
    user,
    pass,
    from,
    fromName: (config.get<string>('MAIL_FROM_NAME') ?? 'Portal Escolar').trim(),
    replyTo,
    testTo: (config.get<string>('MAIL_TEST_TO') ?? '').trim() || user,
    devFallback: devFallbackRaw === 'off' ? 'off' : 'ethereal',
  };
}

export function isMailConfigured(cfg: MailEnvConfig): boolean {
  return Boolean(cfg.enabled && cfg.host && cfg.user && cfg.pass);
}

/** Estado público (sin contraseña) para APIs de diagnóstico. */
export function mailEnvStatus(cfg: MailEnvConfig, mode: MailTransportMode) {
  return {
    enabled: cfg.enabled,
    configured: isMailConfigured(cfg),
    mode,
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    from: cfg.from,
    fromName: cfg.fromName,
    replyTo: cfg.replyTo,
    testTo: cfg.testTo,
    hasPassword: Boolean(cfg.pass),
    devFallback: cfg.devFallback,
  };
}
