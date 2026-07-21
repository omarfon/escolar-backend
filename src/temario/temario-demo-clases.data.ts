import {
  TemarioClaseEstado,
  TemarioMaterialTipo,
} from './entities/temario-clase.entity';
import { TemarioImagenClaseDto } from './dto/temario-clase.dto';

export interface DemoClaseTemplate {
  numero: number;
  titulo: string;
  descripcion: string;
  objetivos: string;
  contenidoClase: string;
  fechaClase: string;
  estado: TemarioClaseEstado;
  diasAntesLiberacion?: number | null;
  horaLiberacion?: string;
  imagenesClase?: TemarioImagenClaseDto[];
  materialTitulo?: string;
  materialDescripcion?: string;
  materialTipo?: TemarioMaterialTipo;
  materialUrl?: string;
}

/** 3 sesiones por semana (lun/mié/vie) desde marzo — 15 clases ≈ 5 semanas lectivas. */
export function fechasClasesTresPorSemana(
  inicioIso: string,
  total: number,
): string[] {
  const fechas: string[] = [];
  const cursor = new Date(`${inicioIso}T12:00:00`);
  while (fechas.length < total) {
    const dow = cursor.getDay();
    if (dow === 1 || dow === 3 || dow === 5) {
      fechas.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return fechas;
}

function claseGenerica(
  numero: number,
  titulo: string,
  descripcion: string,
  objetivos: string[],
  desarrollo: string[],
  estado: TemarioClaseEstado,
  imagenTexto: string,
  materialTitulo?: string,
  materialTipo: TemarioMaterialTipo = 'texto',
  diasAntesLiberacion?: number | null,
): Omit<DemoClaseTemplate, 'fechaClase' | 'numero'> {
  const objetivosTexto = objetivos.map((o) => `• ${o}`).join('\n');
  const desarrolloTexto = desarrollo.map((d, i) => `${i + 1}. ${d}`).join('\n');
  return {
    titulo,
    descripcion,
    objetivos: `Al finalizar la clase, el estudiante:\n${objetivosTexto}`,
    contenidoClase: `DATOS DE LA SESIÓN
Curso: Matemática · 5° grado · Duración: 50 minutos

MOMENTO 1 — INICIO (10 min)
• Activación de saberes previos con pregunta detonante.
• Presentación del objetivo del día.

MOMENTO 2 — DESARROLLO (30 min)
${desarrolloTexto}

MOMENTO 3 — CIERRE (10 min)
• Síntesis grupal y ticket de salida.
• Tarea orientada al siguiente tema.`,
    estado,
    diasAntesLiberacion: diasAntesLiberacion ?? null,
    imagenesClase: [
      {
        url: `https://placehold.co/800x450/e8eaf6/3949ab?text=${encodeURIComponent(imagenTexto)}`,
        nombre: imagenTexto,
        leyenda: `Recursos visuales — ${titulo}`,
      },
    ],
    materialTitulo: materialTitulo ?? `Ficha de trabajo — ${titulo}`,
    materialDescripcion: `Material de apoyo para la clase ${numero}. Revisar antes o después de la sesión.`,
    materialTipo,
  };
}

const CLASES_DETALLADAS: Omit<DemoClaseTemplate, 'fechaClase'>[] = [
  {
    numero: 1,
    titulo: 'Números naturales y operaciones básicas',
    descripcion:
      'Sesión de repaso y consolidación de suma, resta, multiplicación y división con números naturales, usando situaciones del entorno escolar.',
    objetivos:
      'Al finalizar la clase, el estudiante:\n• Identifica la operación adecuada según una situación problemática.\n• Resuelve ejercicios de las cuatro operaciones con números hasta 10 000.\n• Explica oralmente el procedimiento usado en al menos un ejercicio.',
    contenidoClase: `DATOS DE LA SESIÓN
Curso: Matemática · 5° grado · Duración: 50 minutos
Recursos: fichas de problemas, material base diez, pizarra, cuaderno

MOMENTO 1 — INICIO (10 min)
• Saludo y recogida de tarea de la sesión anterior.
• Pregunta detonante sobre operaciones en situaciones de compra y reparto.
• Presentación del objetivo del día en la pizarra.

MOMENTO 2 — DESARROLLO (30 min)
Repaso guiado de suma, resta, multiplicación y división.
Trabajo con material concreto en grupos.
Ficha individual con operaciones mixtas.

MOMENTO 3 — CIERRE (10 min)
• Síntesis: cuándo usar cada operación.
• Ticket de salida y tarea de la guía.`,
    estado: 'dictada',
    diasAntesLiberacion: null,
    imagenesClase: [
      {
        url: 'https://placehold.co/800x450/e0f2f1/004d40?text=Cuadro+operaciones',
        nombre: 'Cuadro de operaciones',
        leyenda: 'Resumen visual: suma, resta, multiplicación y división',
      },
    ],
    materialTitulo: 'Guía de ejercicios — Operaciones básicas',
    materialDescripcion:
      'Ficha con 12 ejercicios progresivos y ejemplos resueltos.',
    materialTipo: 'documento',
    materialUrl: '',
  },
  {
    numero: 2,
    titulo: 'Fracciones equivalentes',
    descripcion:
      'Clase orientada a reconocer, generar y comparar fracciones equivalentes mediante modelos gráficos y la recta numérica.',
    objetivos:
      'Al finalizar la clase, el estudiante:\n• Representa fracciones equivalentes con dibujos y recta numérica.\n• Genera una fracción equivalente amplificando o simplificando.\n• Compara fracciones con distinto denominador usando equivalencias.',
    contenidoClase: `DATOS DE LA SESIÓN
Curso: Matemática · 5° grado · Duración: 50 minutos

MOMENTO 1 — INICIO (8 min)
• Repaso: numerador y denominador.
• Comparación visual de 1/2 y 2/4.

MOMENTO 2 — DESARROLLO (32 min)
Concepto de equivalencia con barras de fracción.
Práctica con recta numérica.
Actividad en parejas con tarjetas.

MOMENTO 3 — CIERRE (10 min)
• Metacognición y evaluación formativa oral.`,
    estado: 'dictada',
    diasAntesLiberacion: 2,
    imagenesClase: [
      {
        url: 'https://placehold.co/800x450/fff3e0/e65100?text=Recta+num%C3%A9rica',
        nombre: 'Recta numérica — fracciones',
        leyenda: 'Ubicación de fracciones equivalentes',
      },
    ],
    materialTitulo: 'Video + ficha: Fracciones equivalentes',
    materialDescripcion: 'Video de repaso y ficha para la recta numérica.',
    materialTipo: 'video',
    materialUrl: 'https://www.youtube.com/watch?v=DJzMbRating',
  },
  {
    numero: 3,
    titulo: 'Decimales y porcentajes',
    descripcion:
      'Relación entre fracciones, decimales y porcentajes aplicada a descuentos, rebajas y encuestas sencillas.',
    objetivos:
      'Al finalizar la clase, el estudiante:\n• Convierte fracciones comunes a decimales y porcentajes.\n• Interpreta un porcentaje en una situación cotidiana.\n• Resuelve problemas breves de porcentaje con apoyo gráfico.',
    contenidoClase: `DATOS DE LA SESIÓN
Curso: Matemática · 5° grado · Duración: 50 minutos

MOMENTO 1 — INICIO (10 min)
• Situación real: descuentos en tienda.
• Conexión fracción ↔ decimal ↔ porcentaje.

MOMENTO 2 — DESARROLLO (30 min)
Conversión entre representaciones.
Cuadro 10×10 para visualizar porcentajes.
Problemas contextualizados individuales.

MOMENTO 3 — CIERRE (10 min)
• Rúbrica rápida y tarea de ficha.`,
    estado: 'dictada',
    diasAntesLiberacion: 5,
    imagenesClase: [
      {
        url: 'https://placehold.co/800x450/e8eaf6/283593?text=Cuadro+10x10',
        nombre: 'Cuadro porcentual 10×10',
        leyenda: 'Modelo para representar porcentajes',
      },
    ],
    materialTitulo: 'Ficha de trabajo — Porcentajes',
    materialDescripcion: '6 problemas de la vida diaria.',
    materialTipo: 'texto',
  },
  {
    numero: 4,
    titulo: 'Geometría: perímetro y área',
    descripcion:
      'Cálculo de perímetro y área de rectángulos, cuadrados y figuras compuestas simples en contextos reales.',
    objetivos:
      'Al finalizar la clase, el estudiante:\n• Diferencia perímetro y área con ejemplos concretos.\n• Aplica fórmulas P = 2(b + h) y A = b × h.\n• Resuelve un problema de enlosado o cercado perimetral.',
    contenidoClase: `DATOS DE LA SESIÓN
Curso: Matemática · 5° grado · Duración: 50 minutos

MOMENTO 1 — INICIO (10 min)
• Comparación perímetro (hilo) vs área (papel).

MOMENTO 2 — DESARROLLO (30 min)
Perímetro y área de rectángulos.
Figuras compuestas en cuaderno cuadriculado.

MOMENTO 3 — CIERRE (10 min)
• Problema integrador de enlosado.`,
    estado: 'programada',
    diasAntesLiberacion: 3,
    imagenesClase: [
      {
        url: 'https://placehold.co/800x450/f3e5f5/6a1b9a?text=Per%C3%ADmetro+vs+%C3%81rea',
        nombre: 'Perímetro vs área',
        leyenda: 'Contorno frente a superficie interior',
      },
    ],
    materialTitulo: 'Documento — Perímetro y área',
    materialDescripcion: 'PDF con fórmulas y ejercicios propuestos.',
    materialTipo: 'documento',
    materialUrl: '',
  },
  {
    numero: 5,
    titulo: 'Problemas de proporcionalidad',
    descripcion:
      'Regla de tres simple directa e inversa en situaciones de compras, velocidad y reparto de trabajo.',
    objetivos:
      'Al finalizar la clase, el estudiante:\n• Identifica magnitudes proporcionales en un enunciado.\n• Aplica regla de tres simple para encontrar un valor desconocido.\n• Distingue proporcionalidad directa e inversa en ejemplos cotidianos.',
    contenidoClase: `DATOS DE LA SESIÓN
Curso: Matemática · 5° grado · Duración: 50 minutos

MOMENTO 1 — INICIO (8 min)
• Problema de precios de cuadernos.

MOMENTO 2 — DESARROLLO (32 min)
Proporcionalidad directa e inversa con tablas.
Práctica guiada con procedimiento escrito.

MOMENTO 3 — CIERRE (10 min)
• Autoevaluación directa/inversa.`,
    estado: 'programada',
    diasAntesLiberacion: 4,
    imagenesClase: [
      {
        url: 'https://placehold.co/800x450/e3f2fd/0d47a1?text=Regla+de+tres',
        nombre: 'Esquema regla de tres',
        leyenda: 'Organización en tabla',
      },
    ],
    materialTitulo: 'Enlace — Proporcionalidad explicada',
    materialDescripcion: 'Artículo y ejemplos interactivos para repaso.',
    materialTipo: 'enlace',
    materialUrl: 'https://es.khanacademy.org/math/arithmetic-home/arith-ratios-rates',
  },
  {
    numero: 6,
    titulo: 'Repaso bimestral integrado',
    descripcion:
      'Síntesis de operaciones, fracciones, decimales, porcentajes, geometría y proporcionalidad del bimestre.',
    objetivos:
      'Al finalizar la clase, el estudiante:\n• Repasa los contenidos clave del bimestre en estaciones de trabajo.\n• Identifica su propio avance y dificultades pendientes.\n• Resuelve una evaluación formativa integrada en equipos.',
    contenidoClase: `DATOS DE LA SESIÓN
Curso: Matemática · 5° grado · Duración: 50 minutos

MOMENTO 1 — INICIO (5 min)
• Organización en 4 estaciones rotativas.

MOMENTO 2 — DESARROLLO (40 min)
Estaciones: operaciones, fracciones, geometría, proporcionalidad.

MOMENTO 3 — CIERRE (5 min)
• Autoevaluación con rúbrica personal.`,
    estado: 'programada',
    diasAntesLiberacion: null,
    imagenesClase: [
      {
        url: 'https://placehold.co/800x450/efebe9/4e342e?text=Estaciones+de+repaso',
        nombre: 'Mapa de estaciones',
        leyenda: 'Cuatro estaciones de repaso bimestral',
      },
    ],
    materialTitulo: 'Cuadernillo de repaso bimestral',
    materialDescripcion: 'Resumen de fórmulas y ejercicios tipo evaluación.',
    materialTipo: 'documento',
    materialUrl: '',
  },
];

const CLASES_ADICIONALES: Array<{
  titulo: string;
  descripcion: string;
  objetivos: string[];
  desarrollo: string[];
  estado: TemarioClaseEstado;
  imagen: string;
  diasAntes?: number | null;
}> = [
  {
    titulo: 'Operaciones con números decimales',
    descripcion:
      'Suma y resta de números decimales alineando la coma decimal en problemas de compras y medidas.',
    objetivos: [
      'Alinea correctamente los decimales en sumas y restas.',
      'Resuelve problemas contextualizados con soles y centavos.',
      'Estima resultados para verificar razonabilidad.',
    ],
    desarrollo: [
      'Repaso de valor posicional en la parte decimal.',
      'Ejercicios guiados de suma y resta en pizarra.',
      'Problemas de ticket de compra en parejas.',
    ],
    estado: 'programada',
    imagen: 'Decimales',
    diasAntes: 3,
  },
  {
    titulo: 'Multiplicación de fracciones',
    descripcion:
      'Multiplicación de fracciones con modelos de área y aplicación en recetas y repartos.',
    objetivos: [
      'Multiplica fracciones numerador por numerador y denominador por denominador.',
      'Interpreta el producto como parte de una parte.',
      'Resuelve problemas de recetas con fracciones.',
    ],
    desarrollo: [
      'Modelo de cuadrícula para 1/2 × 1/3.',
      'Práctica con tarjetas de ejercicios.',
      'Problema de ingredientes para mitad de receta.',
    ],
    estado: 'programada',
    imagen: 'Multiplicar fracciones',
    diasAntes: 2,
  },
  {
    titulo: 'División de fracciones',
    descripcion:
      'División de fracciones usando el inverso multiplicativo en situaciones de reparto.',
    objetivos: [
      'Identifica la fracción reciprocal.',
      'Divide fracciones transformando en multiplicación.',
      'Resuelve problemas de reparto con fracciones.',
    ],
    desarrollo: [
      'Conexión con reparto de pizza en partes iguales.',
      'Procedimiento invertir y multiplicar.',
      'Ficha de 6 ejercicios con retroalimentación.',
    ],
    estado: 'programada',
    imagen: 'Dividir fracciones',
    diasAntes: 4,
  },
  {
    titulo: 'Ángulos: clasificación y medición',
    descripcion:
      'Tipos de ángulos (agudo, recto, obtuso) y uso del transportador en figuras planas.',
    objetivos: [
      'Clasifica ángulos según su medida.',
      'Usa el transportador para medir ángulos.',
      'Identifica ángulos en objetos del entorno.',
    ],
    desarrollo: [
      'Demostración con transportador en pizarra.',
      'Clasificación de tarjetas de ángulos.',
      'Medición de ángulos en figuras del cuaderno.',
    ],
    estado: 'programada',
    imagen: 'Ángulos',
    diasAntes: 3,
  },
  {
    titulo: 'Triángulos y cuadriláteros',
    descripcion:
      'Propiedades de triángulos y cuadriláteros: lados, ángulos y clasificación.',
    objetivos: [
      'Clasifica triángulos por lados y por ángulos.',
      'Reconoce propiedades de paralelogramos y trapecios.',
      'Construye figuras con regla y escuadra.',
    ],
    desarrollo: [
      'Tabla de clasificación de triángulos.',
      'Identificación de cuadriláteros en fichas.',
      'Construcción guiada de un rectángulo y un rombo.',
    ],
    estado: 'programada',
    imagen: 'Triángulos',
    diasAntes: 5,
  },
  {
    titulo: 'Unidades de longitud',
    descripcion:
      'Conversión entre mm, cm, m y km en problemas de distancia y medición.',
    objetivos: [
      'Convierte unidades de longitud usando factores.',
      'Elige la unidad adecuada según el contexto.',
      'Resuelve problemas de distancia en el entorno.',
    ],
    desarrollo: [
      'Tabla de equivalencias en la pizarra.',
      'Ejercicios de conversión en cadena.',
      'Problema del recorrido escolar en metros y km.',
    ],
    estado: 'programada',
    imagen: 'Longitud',
    diasAntes: 2,
  },
  {
    titulo: 'Masa y capacidad',
    descripcion:
      'Unidades de masa (g, kg) y capacidad (ml, L) en situaciones de cocina y consumo.',
    objetivos: [
      'Convierte gramos y kilogramos.',
      'Convierte mililitros y litros.',
      'Resuelve problemas de recetas y envases.',
    ],
    desarrollo: [
      'Material concreto: balanza y recipientes graduados.',
      'Conversiones en tabla comparativa.',
      'Problema de preparación de limonada.',
    ],
    estado: 'programada',
    imagen: 'Masa y capacidad',
    diasAntes: 3,
  },
  {
    titulo: 'Gráficos de barras y pictogramas',
    descripcion:
      'Lectura e interpretación de gráficos estadísticos sencillos con datos del aula.',
    objetivos: [
      'Lee e interpreta gráficos de barras.',
      'Construye un pictograma con datos recolectados.',
      'Responde preguntas sobre frecuencia y comparación.',
    ],
    desarrollo: [
      'Encuesta rápida: deporte favorito del aula.',
      'Construcción colectiva de gráfico de barras.',
      'Preguntas de interpretación en parejas.',
    ],
    estado: 'programada',
    imagen: 'Estadística',
    diasAntes: 4,
  },
  {
    titulo: 'Evaluación formativa del periodo',
    descripcion:
      'Sesión de cierre del periodo con evaluación formativa y plan de mejora personal.',
    objetivos: [
      'Demuestra aprendizajes del periodo en situaciones problemáticas.',
      'Identifica fortalezas y aspectos por reforzar.',
      'Plantea metas de estudio para el siguiente bimestre.',
    ],
    desarrollo: [
      'Evaluación formativa individual (40 min).',
      'Autocorrección con pauta del docente.',
      'Registro de metas en cuaderno de matemática.',
    ],
    estado: 'programada',
    imagen: 'Evaluación',
    diasAntes: null,
  },
];

export const TOTAL_CLASES_DEMO = 15;

export function buildDemoClases(): DemoClaseTemplate[] {
  const fechas = fechasClasesTresPorSemana('2026-03-09', TOTAL_CLASES_DEMO);

  const detalladas: DemoClaseTemplate[] = CLASES_DETALLADAS.map((c, i) => ({
    ...c,
    fechaClase: fechas[i],
  }));

  const adicionales: DemoClaseTemplate[] = CLASES_ADICIONALES.map((c, i) => {
    const numero = CLASES_DETALLADAS.length + i + 1;
    const base = claseGenerica(
      numero,
      c.titulo,
      c.descripcion,
      c.objetivos,
      c.desarrollo,
      c.estado,
      c.imagen,
      undefined,
      'texto',
      c.diasAntes ?? null,
    );
    return {
      numero,
      fechaClase: fechas[CLASES_DETALLADAS.length + i],
      ...base,
    };
  });

  return [...detalladas, ...adicionales];
}
