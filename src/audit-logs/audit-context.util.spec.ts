import { resolveAuditInstitutionId, sanitizeAuditPayload } from './audit-context.util';

describe('audit-context.util', () => {
  describe('sanitizeAuditPayload', () => {
    it('redacta contraseñas y tokens', () => {
      const result = sanitizeAuditPayload({
        username: 'admin',
        password: 'secret',
        accessToken: 'jwt-token',
        refreshToken: 'refresh-token',
        nested: { apiSecret: 'xyz' },
      });

      expect(result).toEqual({
        username: 'admin',
        password: '[redactado]',
        accessToken: '[redactado]',
        refreshToken: '[redactado]',
        nested: { apiSecret: '[redactado]' },
      });
    });

    it('retorna null para valores no objeto', () => {
      expect(sanitizeAuditPayload(null)).toBeNull();
      expect(sanitizeAuditPayload('texto')).toBeNull();
    });
  });

  describe('resolveAuditInstitutionId', () => {
    it('usa institutionId del usuario IE', () => {
      const req = {
        user: { institutionId: 3, roles: ['ADMIN'] },
        headers: {},
        query: {},
      } as never;
      expect(resolveAuditInstitutionId(req)).toBe(3);
    });

    it('usa header X-Institution-Id para SIAGIE', () => {
      const req = {
        user: { roles: ['SIAGIE'], rolPrincipal: 'SIAGIE' },
        headers: { 'x-institution-id': '5' },
        query: {},
      } as never;
      expect(resolveAuditInstitutionId(req)).toBe(5);
    });
  });
});
