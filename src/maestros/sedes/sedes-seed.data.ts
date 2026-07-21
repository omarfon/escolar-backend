/** Sedes iniciales — cargar con npm run db:sedes-data */
export const MAESTRO_SEDES_SEED = [
  {
    nombre: 'Sede Central',
    codigo: 'SEDE-01',
    direccion: 'Av. Los Heroes 123',
    distrito: 'San Juan de Miraflores',
    provincia: 'Lima',
    region: 'Lima',
    telefono: '01-5551234',
    email: 'central@sanmartin.edu.pe',
    director: 'Juan Carlos Perez Torres',
    niveles: ['Primaria', 'Secundaria'],
    turnos: ['Manana', 'Tarde'],
    estado: 'activo' as const,
  },
  {
    nombre: 'Sede Inicial',
    codigo: 'SEDE-02',
    direccion: 'Jr. Las Flores 456',
    distrito: 'San Juan de Miraflores',
    provincia: 'Lima',
    region: 'Lima',
    telefono: '01-5554321',
    email: 'inicial@sanmartin.edu.pe',
    director: 'Rosa Gutierrez Lima',
    niveles: ['Inicial'],
    turnos: ['Manana'],
    estado: 'activo' as const,
  },
];

export const MAESTRO_INSTITUCION_SEED = {
  nombre: 'I.E.P. San Martin de Porres',
  siglas: 'IEP SMP',
  ruc: '20512345678',
  codigoModular: '0654321',
};
