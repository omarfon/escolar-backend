import { BadRequestException } from '@nestjs/common';
import { assertAuditMotivoForUpdate } from './students-audit.util';

describe('assertAuditMotivoForUpdate', () => {
  it('acepta motivo válido', () => {
    expect(() =>
      assertAuditMotivoForUpdate({ motivo: 'Corrección de domicilio' }),
    ).not.toThrow();
  });

  it('rechaza motivo vacío o corto', () => {
    expect(() => assertAuditMotivoForUpdate({ motivo: 'ab' })).toThrow(
      BadRequestException,
    );
    expect(() => assertAuditMotivoForUpdate(undefined)).toThrow(
      BadRequestException,
    );
  });
});
