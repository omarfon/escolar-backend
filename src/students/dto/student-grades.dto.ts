export interface StudentGradeItemResponse {
  id: number;
  descripcion: string;
  fecha: string;
  bimestre: number;
  nota: number;
}

export interface StudentCursoGradesResponse {
  id: number;
  nombre: string;
  area: string;
  docenteAbrev: string;
  controlesDiarios: StudentGradeItemResponse[];
  parciales: StudentGradeItemResponse[];
  finales: StudentGradeItemResponse[];
}

export interface StudentGradesResponse {
  bimestreActual: number;
  anioEscolar: number;
  cursos: StudentCursoGradesResponse[];
}
