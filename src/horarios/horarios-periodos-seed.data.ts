export interface HorarioPeriodoSeed {
  orden: number;
  nombre: string;
  horaInicio: string;
  horaFin: string;
  esReceso: boolean;
  niveles: string[];
}

export const HORARIO_PERIODOS_SEED: HorarioPeriodoSeed[] = [
  {
    orden: 1,
    nombre: '1ª Hora',
    horaInicio: '07:45',
    horaFin: '08:30',
    esReceso: false,
    niveles: ['Inicial', 'Primaria', 'Secundaria'],
  },
  {
    orden: 2,
    nombre: '2ª Hora',
    horaInicio: '08:30',
    horaFin: '09:15',
    esReceso: false,
    niveles: ['Inicial', 'Primaria', 'Secundaria'],
  },
  {
    orden: 3,
    nombre: '3ª Hora',
    horaInicio: '09:15',
    horaFin: '10:00',
    esReceso: false,
    niveles: ['Inicial', 'Primaria', 'Secundaria'],
  },
  {
    orden: 4,
    nombre: 'Recreo',
    horaInicio: '10:00',
    horaFin: '10:30',
    esReceso: true,
    niveles: ['Inicial', 'Primaria', 'Secundaria'],
  },
  {
    orden: 5,
    nombre: '4ª Hora',
    horaInicio: '10:30',
    horaFin: '11:15',
    esReceso: false,
    niveles: ['Inicial', 'Primaria', 'Secundaria'],
  },
  {
    orden: 6,
    nombre: '5ª Hora',
    horaInicio: '11:15',
    horaFin: '12:00',
    esReceso: false,
    niveles: ['Inicial', 'Primaria', 'Secundaria'],
  },
  {
    orden: 7,
    nombre: '6ª Hora',
    horaInicio: '12:00',
    horaFin: '12:45',
    esReceso: false,
    niveles: ['Inicial', 'Primaria', 'Secundaria'],
  },
  {
    orden: 8,
    nombre: '7ª Hora',
    horaInicio: '12:45',
    horaFin: '13:30',
    esReceso: false,
    niveles: ['Primaria', 'Secundaria'],
  },
  {
    orden: 9,
    nombre: '8ª Hora',
    horaInicio: '13:30',
    horaFin: '14:15',
    esReceso: false,
    niveles: ['Primaria', 'Secundaria'],
  },
  {
    orden: 10,
    nombre: '9ª Hora',
    horaInicio: '14:15',
    horaFin: '15:00',
    esReceso: false,
    niveles: ['Secundaria'],
  },
];
