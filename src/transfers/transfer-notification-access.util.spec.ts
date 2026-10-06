import { usuarioEsDestinatarioNotificacion } from './transfer-notification-access.util';

describe('usuarioEsDestinatarioNotificacion', () => {
  const row = {
    ieOrigenCodigoModular: '1111111',
    ieDestinoCodigoModular: '2222222',
    ieOrigenUgel: 'UGEL 01',
    ieOrigenDre: 'DRE Lima',
  };

  it('prioriza destinatarioUserId cuando está definido', () => {
    expect(
      usuarioEsDestinatarioNotificacion(
        { ambito: 'IE_DESTINO', destinatarioUserId: 7 },
        row,
        { codigoModular: '9999999', ugel: '', dre: '' },
        'IE',
        7,
      ),
    ).toBe(true);
    expect(
      usuarioEsDestinatarioNotificacion(
        { ambito: 'IE_DESTINO', destinatarioUserId: 7 },
        row,
        { codigoModular: '2222222', ugel: '', dre: '' },
        'IE',
        8,
      ),
    ).toBe(false);
  });

  it('usa alcance territorial para notificaciones legacy sin userId', () => {
    expect(
      usuarioEsDestinatarioNotificacion(
        { ambito: 'IE_ORIGEN', destinatarioUserId: null },
        row,
        { codigoModular: '1111111', ugel: 'UGEL 01', dre: 'DRE Lima' },
        'IE',
        null,
      ),
    ).toBe(true);
  });
});
