import { BadRequestException } from '@nestjs/common';
import type { StudentAuditContext } from './dto/student-change-audit.dto';

/** Exige motivo documentado en actualizaciones de datos personales (trazabilidad). */
export function assertAuditMotivoForUpdate(
  auditCtx?: StudentAuditContext,
  dtoMotivo?: string,
): void {
  const motivo = (dtoMotivo ?? auditCtx?.motivo ?? '').trim();
  if (motivo.length < 3) {
    throw new BadRequestException(
      'Debe indicar un motivo de al menos 3 caracteres para actualizar datos personales del estudiante.',
    );
  }
}
