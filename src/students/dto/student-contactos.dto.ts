export interface StudentContactoAula {
  nivel: string;
  grado: string;
  seccion: string;
  aulaLabel: string;
  anioEscolar: number;
}

export interface StudentCompaneroContacto {
  id: number;
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string;
}

export interface StudentDocenteContacto {
  id: number;
  nombres: string;
  apellidos: string;
  abrev: string;
  email: string;
  telefono: string;
  especialidad: string;
  cursos: string[];
}

export interface StudentContactosResponse {
  aula: StudentContactoAula;
  companeros: StudentCompaneroContacto[];
  docentes: StudentDocenteContacto[];
}
