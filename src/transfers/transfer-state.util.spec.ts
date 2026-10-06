import { iePuedeVerSolicitud, siguienteEstado } from './transfer-state.util';

describe('máquina de estados de traslado', () => {
  it('permite el camino de la IE de origen', () => {
    expect(siguienteEstado('borrador', 'enviar')).toBe('enviada');
    expect(siguienteEstado('enviada', 'cancelar')).toBe('cancelada');
    expect(siguienteEstado('observada', 'enviar')).toBe('enviada');
  });

  it('permite el camino del ámbito que resuelve', () => {
    expect(siguienteEstado('enviada', 'observar')).toBe('observada');
    expect(siguienteEstado('enviada', 'aprobar')).toBe('aprobada');
    expect(siguienteEstado('aprobada', 'concluir')).toBe('concluida');
    expect(siguienteEstado('observada', 'rechazar')).toBe('rechazada');
  });

  it('la IE de destino ve la solicitud solo después de enviarla', () => {
    expect(iePuedeVerSolicitud('0654321', '0654321', '2222222', 'borrador')).toBe(true);
    expect(iePuedeVerSolicitud('2222222', '0654321', '2222222', 'borrador')).toBe(false);
    expect(iePuedeVerSolicitud('2222222', '0654321', '2222222', 'enviada')).toBe(true);
    expect(iePuedeVerSolicitud('3333333', '0654321', '2222222', 'enviada')).toBe(false);
  });

  it('bloquea transiciones inválidas y estados terminales', () => {
    expect(siguienteEstado('borrador', 'aprobar')).toBeNull();
    expect(siguienteEstado('enviada', 'enviar')).toBeNull();
    expect(siguienteEstado('cancelada', 'enviar')).toBeNull();
    expect(siguienteEstado('concluida', 'cancelar')).toBeNull();
    expect(siguienteEstado('rechazada', 'aprobar')).toBeNull();
  });
});
