/** Competencias, capacidades e indicadores según CNEB / MINEDU (2016). */

export interface MineduIndicadorDef {
  descripcion: string;
  ponderacion: number;
}

export interface MineduCompetenciaDef {
  nombre: string;
  capacidades: string[];
  indicadoresPorCapacidad?: MineduIndicadorDef[][];
}

export type MineduAreaKey = string;

const CAP_MAT_CANTIDAD = [
  'Traduce cantidades a expresiones numéricas',
  'Comunica su comprensión sobre los números y las operaciones',
  'Usa estrategias y procedimientos de estimación y cálculo',
  'Argumenta afirmaciones sobre relaciones numéricas',
];

const CAP_MAT_REGULARIDAD = [
  'Traduce datos y condiciones a expresiones algebraicas y gráficas',
  'Comunica su comprensión sobre las relaciones algebraicas',
  'Usa estrategias y procedimientos para encontrar equivalencias y reglas generales',
  'Argumenta afirmaciones sobre relaciones y funciones',
];

const CAP_MAT_FORMA = [
  'Modela objetos con formas geométricas y sus transformaciones',
  'Comunica su comprensión sobre las formas y relaciones geométricas',
  'Usa estrategias y procedimientos para orientarse en el espacio',
  'Argumenta afirmaciones sobre relaciones geométricas',
];

const CAP_MAT_DATOS = [
  'Representa datos con gráficos y medidas de tendencia central',
  'Comunica su comprensión sobre los datos y probabilidades',
  'Usa estrategias y procedimientos para recopilar y procesar datos',
  'Argumenta afirmaciones sobre el azar y los datos',
];

const CAP_LEE = [
  'Obtiene información del texto escrito',
  'Infiere e interpreta información del texto',
  'Reflexiona y evalúa la forma, el contenido y contexto del texto',
];

const CAP_ESCRIBE = [
  'Adecua el texto a la situación comunicativa',
  'Organiza y desarrolla las ideas de forma coherente y cohesionada',
  'Utiliza convenciones del lenguaje escrito de forma pertinente',
];

const CAP_ORAL = [
  'Obtiene información de textos orales',
  'Infiere e interpreta información de textos orales',
  'Adecua, organiza y desarrolla las ideas de forma coherente y cohesionada',
];

const CAP_CTA = [
  'Indaga mediante métodos científicos para construir conocimientos',
  'Explica el mundo natural basándose en conocimientos de las ciencias',
  'Diseña y construye soluciones tecnológicas para resolver problemas de su entorno',
];

const CAP_BIO = [
  'Indaga mediante métodos científicos situaciones del mundo vivo',
  'Explica el mundo natural basándose en conocimientos sobre los seres vivos',
];

const CAP_FIS = [
  'Indaga mediante métodos científicos situaciones del mundo físico',
  'Explica el mundo físico basándose en conocimientos de las ciencias',
];

const CAP_QUI = [
  'Indaga mediante métodos científicos situaciones del entorno químico',
  'Explica el mundo natural basándose en conocimientos de la química',
];

const CAP_PS = [
  'Construye su identidad',
  'Convive y participa democráticamente en la búsqueda del bien común',
  'Construye interpretaciones históricas',
  'Gestiona responsablemente el espacio y el ambiente',
  'Gestiona responsablemente los recursos económicos',
];

const CAP_ARTE = [
  'Aprecia de manera crítica manifestaciones artístico-culturales',
  'Crea proyectos desde los lenguajes artísticos',
];

const CAP_EF = [
  'Asume una vida saludable',
  'Interactúa en el ámbito del deporte y recreativo',
  'Asume conductas de vida activa y saludable',
];

const CAP_INGLES = [
  'Obtiene información de textos orales en inglés',
  'Infiere e interpreta información de textos orales en inglés',
  'Adecua, organiza y desarrolla ideas de forma coherente en inglés',
];

const CAP_REL = [
  'Conoce a Dios y asume la experiencia de fe en su proyecto de vida',
  'Actúa coherentemente en el ejercicio de su libertad según principios éticos y cristianos',
];

const CAP_EPT = [
  'Gestiona proyectos de emprendimiento',
  'Diseña y gestiona proyectos emprendedores',
  'Innovar y emprender con responsabilidad social',
];

const CAP_INI_COM = [
  'Se comunica oralmente en su lengua materna',
  'Comprende textos orales en su lengua materna',
];

const CAP_INI_MAT = [
  'Resuelve problemas de cantidad',
  'Resuelve problemas de forma, movimiento y localización',
];

const CAP_INI_PS = [
  'Construye su identidad como persona, sujeto de derecho y agente de cambio',
  'Convive y participa democráticamente en la búsqueda del bien común',
];

const CAP_INI_CTA = [
  'Indaga mediante métodos científicos para construir su conocimiento',
  'Explica el mundo natural basándose en conocimientos de las ciencias',
];

const CAP_INI_ARTE = [
  'Aprecia manifestaciones artístico-culturales de su entorno',
  'Experimenta con los lenguajes artísticos',
];

const CAP_INI_PSI = [
  'Usa su cuerpo para expresarse y relacionarse con el entorno',
  'Desarrolla progresivamente su psicomotricidad',
];

export const MINEDU_COMPETENCIAS: Record<MineduAreaKey, MineduCompetenciaDef[]> = {
  matematica: [
    { nombre: 'Resuelve problemas de cantidad', capacidades: CAP_MAT_CANTIDAD },
    { nombre: 'Resuelve problemas de regularidad, equivalencia y cambio', capacidades: CAP_MAT_REGULARIDAD },
    { nombre: 'Resuelve problemas de forma, movimiento y localización', capacidades: CAP_MAT_FORMA },
    { nombre: 'Resuelve problemas de gestión de datos e incertidumbre', capacidades: CAP_MAT_DATOS },
  ],
  comunicacion_lectura: [
    { nombre: 'Lee diversos tipos de textos escritos en su lengua materna', capacidades: CAP_LEE },
  ],
  comunicacion_escritura: [
    { nombre: 'Escribe diversos tipos de textos en su lengua materna', capacidades: CAP_ESCRIBE },
  ],
  comunicacion_oral: [
    { nombre: 'Se comunica oralmente en su lengua materna', capacidades: CAP_ORAL },
  ],
  comunicacion_area: [
    { nombre: 'Lee diversos tipos de textos escritos en su lengua materna', capacidades: CAP_LEE },
    { nombre: 'Escribe diversos tipos de textos en su lengua materna', capacidades: CAP_ESCRIBE },
    { nombre: 'Se comunica oralmente en su lengua materna', capacidades: CAP_ORAL },
  ],
  ciencia_tecnologia: [
    { nombre: 'Indaga mediante métodos científicos para construir su conocimiento', capacidades: CAP_CTA },
    { nombre: 'Explica el mundo natural basándose en conocimientos de las ciencias', capacidades: CAP_CTA },
    { nombre: 'Diseña y construye soluciones tecnológicas para resolver problemas de su entorno', capacidades: CAP_CTA },
  ],
  biologia: [
    { nombre: 'Indaga mediante métodos científicos situaciones del mundo vivo', capacidades: CAP_BIO },
    { nombre: 'Explica el mundo natural basándose en conocimientos sobre los seres vivos', capacidades: CAP_BIO },
  ],
  fisica: [
    { nombre: 'Indaga mediante métodos científicos situaciones del mundo físico', capacidades: CAP_FIS },
    { nombre: 'Explica el mundo físico basándose en conocimientos de las ciencias', capacidades: CAP_FIS },
  ],
  quimica: [
    { nombre: 'Indaga mediante métodos científicos situaciones del entorno químico', capacidades: CAP_QUI },
    { nombre: 'Explica el mundo natural basándose en conocimientos de la química', capacidades: CAP_QUI },
  ],
  personal_social: [
    {
      nombre: 'Construye su identidad',
      capacidades: [
        'Conoce su cuerpo y sus emociones',
        'Construye una imagen positiva de sí mismo',
        'Autorregula sus emociones',
      ],
    },
    {
      nombre: 'Convive y participa democráticamente en la búsqueda del bien común',
      capacidades: [
        'Interactúa con todas las personas',
        'Construye normas y asume acuerdos y leyes',
        'Maneja conflictos de manera constructiva',
        'Delibera sobre asuntos de interés común',
      ],
    },
    {
      nombre: 'Construye interpretaciones históricas',
      capacidades: [
        'Interpreta críticamente fuentes diversas',
        'Comprende el tiempo histórico',
        'Elabora interpretaciones sobre procesos históricos',
      ],
    },
    {
      nombre: 'Gestiona responsablemente el espacio y el ambiente',
      capacidades: [
        'Comprende la relación sociedad-naturaleza',
        'Maneja responsablemente recursos naturales',
        'Participa en acciones de conservación del ambiente',
      ],
    },
    {
      nombre: 'Gestiona responsablemente los recursos económicos',
      capacidades: [
        'Comprende la relación entre el trabajo y la economía',
        'Toma decisiones económicas responsables',
        'Gestiona recursos para el bien común',
      ],
    },
  ],
  ciencias_sociales: [
    {
      nombre: 'Construye interpretaciones históricas',
      capacidades: [
        'Interpreta críticamente fuentes diversas',
        'Comprende el tiempo histórico',
        'Elabora interpretaciones sobre procesos históricos',
      ],
    },
    {
      nombre: 'Gestiona responsablemente el espacio y el ambiente',
      capacidades: [
        'Comprende la relación sociedad-naturaleza',
        'Maneja responsablemente recursos naturales',
        'Participa en acciones de conservación del ambiente',
      ],
    },
    {
      nombre: 'Gestiona responsablemente los recursos económicos',
      capacidades: [
        'Comprende la relación entre el trabajo y la economía',
        'Toma decisiones económicas responsables',
        'Gestiona recursos para el bien común',
      ],
    },
  ],
  dpcc: [
    {
      nombre: 'Construye su identidad',
      capacidades: [
        'Conoce su cuerpo y sus emociones',
        'Construye una imagen positiva de sí mismo',
        'Autorregula sus emociones',
      ],
    },
    {
      nombre: 'Convive y participa democráticamente en la búsqueda del bien común',
      capacidades: [
        'Interactúa con todas las personas',
        'Construye normas y asume acuerdos y leyes',
        'Maneja conflictos de manera constructiva',
        'Delibera sobre asuntos de interés común',
      ],
    },
    {
      nombre: 'Construye interpretaciones históricas',
      capacidades: [
        'Interpreta críticamente fuentes diversas',
        'Comprende el tiempo histórico',
        'Elabora interpretaciones sobre procesos históricos',
      ],
    },
    {
      nombre: 'Gestiona responsablemente el espacio y el ambiente',
      capacidades: [
        'Comprende la relación sociedad-naturaleza',
        'Maneja responsablemente recursos naturales',
        'Participa en acciones de conservación del ambiente',
      ],
    },
    {
      nombre: 'Gestiona responsablemente los recursos económicos',
      capacidades: [
        'Comprende la relación entre el trabajo y la economía',
        'Toma decisiones económicas responsables',
        'Gestiona recursos para el bien común',
      ],
    },
  ],
  arte_cultura: [
    { nombre: 'Aprecia de manera crítica manifestaciones artístico-culturales', capacidades: CAP_ARTE },
    { nombre: 'Crea proyectos desde los lenguajes artísticos', capacidades: CAP_ARTE },
  ],
  educacion_fisica: [
    { nombre: 'Asume una vida saludable', capacidades: CAP_EF },
    { nombre: 'Interactúa en el ámbito del deporte y recreativo', capacidades: CAP_EF },
    { nombre: 'Asume conductas de vida activa y saludable', capacidades: CAP_EF },
  ],
  ingles: [
    {
      nombre: 'Se comunica oralmente en inglés como lengua extranjera',
      capacidades: [...CAP_INGLES],
    },
    {
      nombre: 'Lee diversos tipos de textos escritos en inglés como lengua extranjera',
      capacidades: [
        'Obtiene información de textos escritos en inglés',
        'Infiere e interpreta información de textos en inglés',
        'Reflexiona y evalúa la forma, contenido y contexto del texto en inglés',
      ],
    },
    {
      nombre: 'Escribe diversos tipos de textos en inglés como lengua extranjera',
      capacidades: [
        'Adecua el texto en inglés a la situación comunicativa',
        'Organiza y desarrolla ideas de forma coherente en inglés',
        'Utiliza convenciones del lenguaje escrito en inglés',
      ],
    },
  ],
  ed_religiosa: [
    { nombre: 'Conoce a Dios y asume la experiencia de fe en su proyecto de vida', capacidades: CAP_REL },
    { nombre: 'Actúa coherentemente en el ejercicio de su libertad según principios éticos y cristianos', capacidades: CAP_REL },
  ],
  ed_trabajo: [
    {
      nombre: 'Gestiona proyectos de emprendimiento',
      capacidades: [
        'Identifica oportunidades de emprendimiento',
        'Planifica proyectos emprendedores',
        'Evalúa resultados de proyectos',
      ],
    },
    {
      nombre: 'Diseña y gestiona proyectos emprendedores',
      capacidades: [
        'Diseña propuestas de valor',
        'Organiza recursos para el emprendimiento',
        'Comunica propuestas emprendedoras',
      ],
    },
    {
      nombre: 'Innovar y emprender con responsabilidad social',
      capacidades: [
        'Genera ideas innovadoras',
        'Asume responsabilidad social en el emprendimiento',
        'Evalúa impacto de proyectos emprendedores',
      ],
    },
  ],
  inicial_comunicacion: CAP_INI_COM.map((nombre) => ({ nombre, capacidades: [nombre] })),
  inicial_matematica: CAP_INI_MAT.map((nombre) => ({ nombre, capacidades: [nombre] })),
  inicial_personal_social: CAP_INI_PS.map((nombre) => ({ nombre, capacidades: [nombre] })),
  inicial_ciencia: CAP_INI_CTA.map((nombre) => ({ nombre, capacidades: [nombre] })),
  inicial_arte: CAP_INI_ARTE.map((nombre) => ({ nombre, capacidades: [nombre] })),
  inicial_psicomotricidad: CAP_INI_PSI.map((nombre) => ({ nombre, capacidades: [nombre] })),
};

/** Resuelve la clave MINEDU según nivel, nombre del curso y área. */
export function resolveMineduKey(
  nivel: string,
  subjectNombre: string,
  areaNombre: string,
): MineduAreaKey | null {
  const s = subjectNombre.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const a = areaNombre.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

  if (nivel === 'Inicial') {
    if (a.includes('comunicacion') || s.includes('comunicacion')) return 'inicial_comunicacion';
    if (a.includes('matematica') || s.includes('matematica')) return 'inicial_matematica';
    if (a.includes('personal social') || s.includes('personal social')) return 'inicial_personal_social';
    if (a.includes('ciencia') || s.includes('ciencia')) return 'inicial_ciencia';
    if (a.includes('arte') || s.includes('arte')) return 'inicial_arte';
    if (a.includes('psicomotricidad') || s.includes('psicomotricidad')) return 'inicial_psicomotricidad';
    return null;
  }

  if (s.includes('comprension lectora')) return 'comunicacion_lectura';
  if (s.includes('produccion de textos')) return 'comunicacion_escritura';
  if (s === 'comunicacion' || (s.includes('comunicacion') && nivel === 'Secundaria')) {
    return 'comunicacion_area';
  }

  if (
    s.includes('matematica') ||
    s.includes('algebra') ||
    s.includes('geometria') ||
    s.includes('trigonometria') ||
    s.includes('aritmetica') ||
    a.includes('matematica')
  ) {
    return 'matematica';
  }

  if (s.includes('biologia')) return 'biologia';
  if (s.includes('fisica')) return 'fisica';
  if (s.includes('quimica')) return 'quimica';
  if (s === 'cta' || (s.includes('ciencia') && a.includes('ciencia'))) return 'ciencia_tecnologia';
  if (s.includes('ciencia') || a.includes('ciencia y tecnologia')) return 'ciencia_tecnologia';

  if (s.includes('historia') || s.includes('geografia') || a.includes('ccss') || a.includes('ciencias sociales')) {
    return nivel === 'Primaria' && a.includes('personal social') ? 'personal_social' : 'ciencias_sociales';
  }
  if (s.includes('personal social') || a.includes('personal social')) return 'personal_social';
  if (s.includes('dpcc') || a.includes('dpcc')) return 'dpcc';

  if (s.includes('arte') || a.includes('arte')) return 'arte_cultura';
  if (s.includes('educacion fisica') || a.includes('educacion fisica')) return 'educacion_fisica';
  if (s.includes('ingles') || a.includes('ingles')) return 'ingles';
  if (s.includes('religiosa') || a.includes('religiosa')) return 'ed_religiosa';
  if (s.includes('trabajo') || a.includes('trabajo')) return 'ed_trabajo';

  return null;
}

export function getMineduCompetencias(key: MineduAreaKey): MineduCompetenciaDef[] {
  return MINEDU_COMPETENCIAS[key] ?? [];
}
