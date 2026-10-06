import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { ConductIncident } from '../conduct-incidents/entities/conduct-incident.entity';
import { Student } from '../students/entities/student.entity';
import {
  isMailConfigured,
  mailEnvStatus,
  MailEnvConfig,
  MailTransportMode,
  readMailEnv,
} from './mail.config';

export interface MailSendResult {
  sent: boolean;
  simulated: boolean;
  messageId?: string;
  previewUrl?: string;
  mode?: MailTransportMode;
}

const TIPO_LABELS: Record<string, string> = {
  falta_leve: 'Falta leve',
  falta_grave: 'Falta grave',
  falta_muy_grave: 'Falta muy grave',
  reconocimiento: 'Reconocimiento',
};

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly mailConfig: MailEnvConfig;
  private transporter: Transporter | null = null;
  private mode: MailTransportMode = 'off';
  private etherealUser = '';

  constructor(private readonly config: ConfigService) {
    this.mailConfig = readMailEnv(config);
  }

  async onModuleInit(): Promise<void> {
    if (!this.mailConfig.enabled) {
      this.logger.warn('MAIL_ENABLED=false — envío de correos desactivado.');
      return;
    }

    if (isMailConfigured(this.mailConfig)) {
      this.initSmtpTransport();
      this.mode = 'smtp';
      this.logger.log(
        `Correo SMTP activo (${this.mailConfig.user} vía ${this.mailConfig.host}:${this.mailConfig.port})`,
      );
      return;
    }

    if (this.mailConfig.devFallback === 'ethereal') {
      await this.initEtherealTransport();
      return;
    }

    this.logger.warn(
      'Configure MAIL_PASS en .env para Gmail real, o MAIL_DEV_FALLBACK=ethereal para pruebas en desarrollo.',
    );
  }

  getStatus() {
    return mailEnvStatus(this.mailConfig, this.mode);
  }

  getDefaultTestRecipient(): string {
    return this.mailConfig.testTo;
  }

  async verifyConnection(): Promise<{ ok: boolean; message: string; mode: MailTransportMode }> {
    if (!this.mailConfig.enabled) {
      return {
        ok: false,
        mode: this.mode,
        message: 'Envío deshabilitado. Configure MAIL_ENABLED=true en .env.',
      };
    }
    if (!this.transporter) {
      return {
        ok: false,
        mode: this.mode,
        message:
          'Sin transporte de correo. Configure MAIL_PASS (Gmail) o MAIL_DEV_FALLBACK=ethereal en .env.',
      };
    }
    try {
      await this.transporter.verify();
      const suffix =
        this.mode === 'ethereal'
          ? ' Modo desarrollo Ethereal (vista previa web, no llega al buzón real).'
          : '';
      return {
        ok: true,
        mode: this.mode,
        message: `Conexión de correo verificada.${suffix}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error SMTP desconocido';
      return { ok: false, mode: this.mode, message };
    }
  }

  async send(options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
  }): Promise<MailSendResult> {
    const to = options.to.trim();
    if (!to) {
      throw new Error('Destinatario de correo vacío');
    }

    if (!this.mailConfig.enabled) {
      this.logger.warn(`[simulado] ${to} | ${options.subject}`);
      return { sent: false, simulated: true, mode: this.mode };
    }

    if (!this.transporter) {
      this.logger.warn(
        `[simulado] ${to} | ${options.subject}\n${options.text}`,
      );
      return { sent: false, simulated: true, mode: this.mode };
    }

    const from = this.formatFrom();
    if (!from || from.includes('<apikey>') || from.includes('<>')) {
      throw new Error(
        'Configure MAIL_FROM con un correo verificado en SendGrid (Settings → Sender Authentication).',
      );
    }

    const info = await this.transporter.sendMail({
      from,
      to,
      replyTo: options.replyTo ?? this.mailConfig.replyTo,
      subject: options.subject,
      text: options.text,
      html: options.html ?? this.textToHtml(options.text),
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
    if (previewUrl) {
      this.logger.log(`Correo de prueba — vista previa: ${previewUrl}`);
    } else {
      this.logger.log(`Correo enviado a ${to} (${info.messageId ?? 'ok'})`);
    }

    return {
      sent: true,
      simulated: false,
      messageId: info.messageId,
      previewUrl,
      mode: this.mode,
    };
  }

  async sendConductParentNotification(
    student: Student,
    incident: ConductIncident,
  ): Promise<MailSendResult | null> {
    const parentEmail = this.resolveParentEmail(student);
    if (!parentEmail) {
      this.logger.warn(
        `Sin correo de apoderado para alumno ${student.id}; no se envió notificación de conducta.`,
      );
      return null;
    }

    const alumno = `${student.nombre} ${student.apellido}`.trim();
    const tipo = TIPO_LABELS[incident.tipo] ?? incident.tipo;
    const fecha = this.formatFecha(incident.fecha);
    const subject =
      incident.tipo === 'reconocimiento'
        ? `Reconocimiento de conducta — ${alumno}`
        : `Notificación de conducta escolar — ${alumno}`;

    const text = [
      'Estimado(a) apoderado(a),',
      '',
      `Le informamos un registro de conducta del estudiante ${alumno} (${student.grado} "${student.seccion}").`,
      '',
      `Tipo: ${tipo}`,
      `Fecha: ${fecha}`,
      incident.lugar ? `Lugar: ${incident.lugar}` : '',
      `Descripción: ${incident.descripcion}`,
      incident.medida ? `Medida: ${incident.medida}` : '',
      incident.observaciones ? `Observaciones: ${incident.observaciones}` : '',
      '',
      'Este mensaje fue generado automáticamente por el Portal Escolar.',
      'Ante cualquier consulta, comuníquese con la institución educativa.',
    ]
      .filter(Boolean)
      .join('\n');

    return this.send({ to: parentEmail, subject, text });
  }

  async sendAbsenceAlertParentNotification(options: {
    student: Student;
    mesLabel: string;
    faltasInjustificadas: number;
    diasConsecutivos: number;
    nivelAlerta: string;
    motivoAlerta: string;
    fechasFaltas?: string[];
    notificadoPor: string;
  }): Promise<MailSendResult | null> {
    const parentEmail = this.resolveParentEmail(options.student);
    if (!parentEmail) {
      this.logger.warn(
        `Sin correo de apoderado para alumno ${options.student.id}; no se envió alerta de ausentismo.`,
      );
      return null;
    }

    const alumno = `${options.student.nombre} ${options.student.apellido}`.trim();
    const aula = `${options.student.grado} · Sección ${options.student.seccion}`;
    const severidad =
      options.nivelAlerta === 'critico'
        ? 'Crítica'
        : options.nivelAlerta === 'alerta'
          ? 'Temprana'
          : 'Informativa';

    const subject = `Alerta de ausentismo — ${alumno} (${options.mesLabel})`;

    const fechasLine =
      options.fechasFaltas?.length
        ? `Fechas con falta injustificada: ${options.fechasFaltas.join(', ')}`
        : '';

    const text = [
      'Estimado(a) apoderado(a),',
      '',
      `Le informamos sobre la asistencia de su hijo/a ${alumno} (${aula}) correspondiente al periodo ${options.mesLabel}.`,
      '',
      `Nivel de alerta: ${severidad}`,
      `Faltas injustificadas: ${options.faltasInjustificadas}`,
      `Días consecutivos con falta: ${options.diasConsecutivos}`,
      options.motivoAlerta ? `Detalle: ${options.motivoAlerta}` : '',
      fechasLine,
      '',
      'Puede revisar el detalle en el Portal de Padres, sección Seguimiento académico, y registrar una justificación si corresponde.',
      '',
      `Notificación registrada por: ${options.notificadoPor}`,
      '',
      'Este mensaje fue generado automáticamente por el Portal Escolar.',
      'Ante cualquier consulta, comuníquese con la institución educativa.',
    ]
      .filter(Boolean)
      .join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;color:#1f2937">
        <h2 style="color:#4338ca;margin:0 0 12px">Alerta de ausentismo escolar</h2>
        <p>Estimado(a) apoderado(a),</p>
        <p>Le informamos sobre la asistencia de <strong>${alumno}</strong> (${aula}) en <strong>${options.mesLabel}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;border:1px solid #e5e7eb">Nivel</td><td style="padding:8px;border:1px solid #e5e7eb"><strong>${severidad}</strong></td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb">Faltas injustificadas</td><td style="padding:8px;border:1px solid #e5e7eb"><strong>${options.faltasInjustificadas}</strong></td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb">Días consecutivos</td><td style="padding:8px;border:1px solid #e5e7eb"><strong>${options.diasConsecutivos}</strong></td></tr>
        </table>
        ${options.motivoAlerta ? `<p><strong>Detalle:</strong> ${options.motivoAlerta}</p>` : ''}
        ${fechasLine ? `<p style="font-size:14px;color:#6b7280">${fechasLine}</p>` : ''}
        <p style="margin-top:20px">Ingrese al <strong>Portal de Padres</strong> → Seguimiento académico para ver el detalle y, de ser necesario, enviar una justificación.</p>
        <p style="font-size:12px;color:#9ca3af;margin-top:24px">Registrado por ${options.notificadoPor} · Portal Escolar</p>
      </div>`;

    return this.send({ to: parentEmail, subject, text, html });
  }

  async sendStudentPersonalDataChangeNotification(options: {
    student: Student;
    camposLabels: string[];
    actorNombre: string;
    motivo: string;
  }): Promise<MailSendResult | null> {
    const parentEmail = this.resolveParentEmail(options.student);
    if (!parentEmail) {
      this.logger.warn(
        `Sin correo de apoderado para alumno ${options.student.id}; no se envió aviso de datos personales.`,
      );
      return null;
    }

    const alumno = `${options.student.nombre} ${options.student.apellido}`.trim();
    const aula = `${options.student.grado} · Sección ${options.student.seccion}`;
    const campos = options.camposLabels.join(', ');
    const fecha = this.formatFecha(new Date().toISOString().slice(0, 10));
    const subject = `Actualización de datos personales — ${alumno}`;

    const text = [
      'Estimado(a) apoderado(a),',
      '',
      `Le informamos que se registraron cambios en datos personales del estudiante ${alumno} (${aula}).`,
      '',
      `Campos actualizados: ${campos}`,
      `Motivo registrado: ${options.motivo}`,
      `Fecha: ${fecha}`,
      `Registrado por: ${options.actorNombre}`,
      '',
      'Por seguridad, este mensaje no incluye los valores actualizados.',
      'Puede verificar la información en el Portal de Padres o comunicarse con la institución.',
      '',
      'Este mensaje fue generado automáticamente por el Portal Escolar.',
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;color:#1f2937">
        <h2 style="color:#4338ca;margin:0 0 12px">Actualización de datos personales</h2>
        <p>Estimado(a) apoderado(a),</p>
        <p>Se registraron cambios en los datos personales de <strong>${alumno}</strong> (${aula}).</p>
        <p><strong>Campos actualizados:</strong> ${campos}</p>
        <p><strong>Motivo:</strong> ${options.motivo}</p>
        <p style="font-size:14px;color:#6b7280">Por seguridad, este correo no incluye los valores modificados.</p>
        <p style="font-size:12px;color:#9ca3af;margin-top:24px">${fecha} · ${options.actorNombre} · Portal Escolar</p>
      </div>`;

    return this.send({ to: parentEmail, subject, text, html });
  }

  async sendParentToTeacherMessage(options: {
    teacherEmail: string;
    teacherName: string;
    parentEmail: string;
    parentName: string;
    studentName: string;
    subject: string;
    body: string;
  }): Promise<MailSendResult> {
    const text = [
      `Mensaje del apoderado ${options.parentName} (${options.parentEmail})`,
      `Referente al estudiante: ${options.studentName}`,
      '',
      options.body,
      '',
      '—',
      this.mailConfig.fromName,
    ].join('\n');

    return this.send({
      to: options.teacherEmail,
      subject: `[${this.mailConfig.fromName}] ${options.subject}`,
      text,
      replyTo: options.parentEmail,
    });
  }

  async sendTest(to: string): Promise<MailSendResult> {
    return this.send({
      to,
      subject: `Prueba de correo — ${this.mailConfig.fromName}`,
      text: [
        'Este es un correo de prueba del Portal Escolar.',
        '',
        `Remitente configurado: ${this.formatFrom()}`,
        `Modo: ${this.mode}`,
        `Fecha: ${new Date().toLocaleString('es-PE')}`,
        this.mode === 'ethereal'
          ? 'En desarrollo con Ethereal: abra el enlace previewUrl de la respuesta para ver el mensaje.'
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }

  resolveParentEmail(student: Student): string | null {
    const reps = [student.apoderado, student.padre, student.madre];
    for (const rep of reps) {
      const email = rep?.email?.trim().toLowerCase();
      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return email;
      }
    }
    return null;
  }

  private initSmtpTransport(): void {
    this.transporter = nodemailer.createTransport({
      host: this.mailConfig.host,
      port: this.mailConfig.port,
      secure: this.mailConfig.port === 465,
      auth: {
        user: this.mailConfig.user,
        pass: this.mailConfig.pass,
      },
    });
  }

  private async initEtherealTransport(): Promise<void> {
    try {
      const testAccount = await nodemailer.createTestAccount();
      this.etherealUser = testAccount.user;
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      this.mode = 'ethereal';
      this.logger.warn(
        `Modo desarrollo Ethereal activo (${testAccount.user}). Los correos NO llegan al buzón real; use previewUrl. Para Gmail real, configure MAIL_PASS en .env.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      this.logger.error(`No se pudo iniciar Ethereal: ${message}`);
    }
  }

  async sendTransferNotification(options: {
    to: string;
    codigo: string;
    studentNombre: string;
    mensaje: string;
    plantilla: string;
    estadoNuevo: string;
    ambito: string;
  }): Promise<MailSendResult> {
    const subject = `Traslado ${options.codigo} — ${options.estadoNuevo}`;
    const text = [
      'Notificación de traslado escolar',
      '',
      options.mensaje,
      '',
      `Estudiante: ${options.studentNombre}`,
      `Código solicitud: ${options.codigo}`,
      `Estado: ${options.estadoNuevo}`,
      `Ámbito: ${options.ambito}`,
      '',
      'Ingrese al Portal Escolar → Traslados para ver el detalle y marcar como leída.',
      '',
      'Este mensaje fue generado automáticamente por el Portal Escolar.',
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;color:#1f2937">
        <h2 style="color:#4338ca;margin:0 0 12px">Notificación de traslado</h2>
        <p>${this.escapeHtml(options.mensaje)}</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;border:1px solid #e5e7eb">Estudiante</td><td style="padding:8px;border:1px solid #e5e7eb"><strong>${this.escapeHtml(options.studentNombre)}</strong></td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb">Solicitud</td><td style="padding:8px;border:1px solid #e5e7eb"><strong>${this.escapeHtml(options.codigo)}</strong></td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb">Estado</td><td style="padding:8px;border:1px solid #e5e7eb"><strong>${this.escapeHtml(options.estadoNuevo)}</strong></td></tr>
        </table>
        <p style="font-size:14px;color:#6b7280">Revise la bandeja de traslados en el portal para confirmar la recepción.</p>
      </div>`;

    return this.send({ to: options.to, subject, text, html });
  }

  async sendPasswordResetEmail(options: {
    to: string;
    nombre: string;
    resetUrl: string;
    expiresMinutes: number;
    institucionNombre: string;
  }): Promise<MailSendResult> {
    const subject = `Recuperación de contraseña — ${options.institucionNombre || 'Portal Escolar'}`;
    const text = [
      `Estimado(a) ${options.nombre},`,
      '',
      'Recibimos una solicitud para restablecer la contraseña de su cuenta en el sistema escolar.',
      '',
      `Para continuar, abra el siguiente enlace (válido por ${options.expiresMinutes} minutos):`,
      options.resetUrl,
      '',
      'Si usted no solicitó este cambio, ignore este mensaje. Su contraseña actual seguirá siendo válida.',
      '',
      'Por seguridad, el enlace solo puede usarse una vez.',
      '',
      options.institucionNombre,
    ].join('\n');

    const html = `
      <p>Estimado(a) <strong>${this.escapeHtml(options.nombre)}</strong>,</p>
      <p>Recibimos una solicitud para restablecer la contraseña de su cuenta.</p>
      <p><a href="${options.resetUrl}">Restablecer contraseña</a></p>
      <p>El enlace expira en ${options.expiresMinutes} minutos y solo puede usarse una vez.</p>
      <p>Si no solicitó este cambio, ignore este correo.</p>
      <p><small>${this.escapeHtml(options.institucionNombre)}</small></p>
    `;

    return this.send({ to: options.to, subject, text, html });
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private formatFrom(): string {
    if (this.mode === 'ethereal') {
      return `"${this.mailConfig.fromName}" <${this.etherealUser || this.mailConfig.from}>`;
    }
    return `"${this.mailConfig.fromName}" <${this.mailConfig.from}>`;
  }

  private formatFecha(fecha: string): string {
    if (!fecha) return '';
    if (fecha.includes('-')) {
      const [y, m, d] = fecha.split('-');
      return `${d}/${m}/${y}`;
    }
    return fecha;
  }

  private textToHtml(text: string): string {
    return text
      .split('\n')
      .map((line) => `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`)
      .join('');
  }
}
