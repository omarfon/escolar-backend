import { RepresentanteData } from '../students/entities/student.entity';

export interface StudentProfileSeed {
  email: string;
  fechaNac: string;
  direccion: string;
  grupoSanguineo?: string;
  alergias?: string;
  condicionesSalud?: string;
  anioIngreso?: string;
  padre: RepresentanteData;
  madre: RepresentanteData;
  apoderado: RepresentanteData;
}

export interface HistorialSeedRow {
  anio: string;
  grado: string;
  seccion: string;
  promedio: number;
  estado: string;
}

const rep = (
  nombres: string,
  apellidos: string,
  dni: string,
  telefono: string,
  email: string,
  trabajo: string,
): RepresentanteData => ({ nombres, apellidos, dni, telefono, email, trabajo });

const familiaPerez = {
  padre: rep('Carlos', 'Perez Mamani', '40123456', '987001001', 'cperez@gmail.com', 'Ingeniero Civil'),
  madre: rep('Maria', 'Lopez Quispe', '46678123', '987016016', 'padre@escolar.pe', 'Apoderada'),
  apoderado: rep('Maria', 'Lopez Quispe', '46678123', '987016016', 'padre@escolar.pe', 'Apoderada'),
};

export const STUDENT_PROFILE_SEED: StudentProfileSeed[] = [
  {
    email: 'estudiante@escolar.pe',
    fechaNac: '2012-05-14',
    direccion: 'Av. Los Heroes 234, San Juan de Miraflores',
    grupoSanguineo: 'O+',
    alergias: 'Ninguna',
    anioIngreso: '2018',
    ...familiaPerez,
  },
  {
    email: 'l.torres@estudiante.pe',
    fechaNac: '2012-03-18',
    direccion: 'Av. Los Heroes 234, San Juan de Miraflores',
    grupoSanguineo: 'A+',
    anioIngreso: '2018',
    ...familiaPerez,
  },
  {
    email: 'c.mendoza@estudiante.pe',
    fechaNac: '2012-08-22',
    direccion: 'Av. Los Heroes 234, San Juan de Miraflores',
    grupoSanguineo: 'B+',
    anioIngreso: '2018',
    ...familiaPerez,
  },
  {
    email: 'p.salazar@estudiante.pe',
    fechaNac: '2012-01-10',
    direccion: 'Jr. Los Laureles 112, San Juan de Miraflores',
    padre: rep('Fernando', 'Salazar Luna', '40234561', '987201001', 'f.salazar@gmail.com', 'Electricista'),
    madre: rep('Lucia', 'Luna Quispe', '40234562', '987201002', 'l.luna@gmail.com', 'Comerciante'),
    apoderado: rep('Fernando', 'Salazar Luna', '40234561', '987201001', 'f.salazar@gmail.com', 'Electricista'),
  },
  {
    email: 'r.vargas@estudiante.pe',
    fechaNac: '2012-06-25',
    direccion: 'Calle Las Palmeras 456, Villa Maria del Triunfo',
    padre: rep('Roberto', 'Vargas Ortiz', '40345671', '987202001', 'r.vargas@gmail.com', 'Taxista'),
    madre: rep('Elena', 'Ortiz Mamani', '40345672', '987202002', 'e.ortiz@gmail.com', 'Ama de casa'),
    apoderado: rep('Elena', 'Ortiz Mamani', '40345672', '987202002', 'e.ortiz@gmail.com', 'Ama de casa'),
  },
  {
    email: 'm.condori@estudiante.pe',
    fechaNac: '2012-11-03',
    direccion: 'Av. Pachacutec 789, Villa El Salvador',
    padre: rep('Victor', 'Condori Paz', '40456781', '987203001', 'v.condori@gmail.com', 'Albañil'),
    madre: rep('Rosa', 'Paz Huanca', '40456782', '987203002', 'r.paz@gmail.com', 'Vendedora'),
    apoderado: rep('Victor', 'Condori Paz', '40456781', '987203001', 'v.condori@gmail.com', 'Albañil'),
  },
  {
    email: 'v.rojas@estudiante.pe',
    fechaNac: '2012-04-14',
    direccion: 'Jr. Huancavelica 321, San Juan de Miraflores',
    padre: rep('Alberto', 'Rojas Mejia', '40567891', '987204001', 'a.rojas@gmail.com', 'Contador'),
    madre: rep('Patricia', 'Mejia Solis', '40567892', '987204002', 'p.mejia@gmail.com', 'Docente'),
    apoderado: rep('Patricia', 'Mejia Solis', '40567892', '987204002', 'p.mejia@gmail.com', 'Docente'),
  },
  {
    email: 'a.garcia@estudiante.pe',
    fechaNac: '2011-03-10',
    direccion: 'Calle Tupac Amaru 789, San Juan de Miraflores',
    alergias: 'Polen',
    condicionesSalud: 'Rinitis',
    anioIngreso: '2017',
    padre: rep('Antonio', 'Garcia Lima', '40456781', '987104401', 'a.garcia.padre@gmail.com', 'Comerciante'),
    madre: rep('Carmen', 'Lima Torres', '40456782', '987104402', 'c.lima@gmail.com', 'Ama de casa'),
    apoderado: rep('Carmen', 'Lima Torres', '40456782', '987104402', 'c.lima@gmail.com', 'Ama de casa'),
  },
  {
    email: 'j.paredes@estudiante.pe',
    fechaNac: '2011-07-22',
    direccion: 'Av. El Sol 567, Villa Maria del Triunfo',
    padre: rep('Miguel', 'Paredes Cano', '40567891', '987105501', 'm.paredes@gmail.com', 'Chofer'),
    madre: rep('Rosa', 'Cano Mendoza', '40567892', '987105502', 'r.cano@gmail.com', 'Vendedora'),
    apoderado: rep('Miguel', 'Paredes Cano', '40567891', '987105501', 'm.paredes@gmail.com', 'Chofer'),
  },
  {
    email: 's.huaman@estudiante.pe',
    fechaNac: '2011-09-08',
    direccion: 'Jr. Los Claveles 234, San Juan de Miraflores',
    padre: rep('Julio', 'Huaman Cruz', '40678901', '987205501', 'j.huaman@gmail.com', 'Mecánico'),
    madre: rep('Teresa', 'Cruz Vega', '40678902', '987205502', 't.cruz@gmail.com', 'Enfermera'),
    apoderado: rep('Teresa', 'Cruz Vega', '40678902', '987205502', 't.cruz@gmail.com', 'Enfermera'),
  },
  {
    email: 'd.quispe@estudiante.pe',
    fechaNac: '2011-12-15',
    direccion: 'Calle Los Eucaliptos 890, Villa El Salvador',
    padre: rep('Hugo', 'Quispe Arce', '40789012', '987206501', 'h.quispe@gmail.com', 'Agricultor'),
    madre: rep('Nelly', 'Arce Rojas', '40789013', '987206502', 'n.arce@gmail.com', 'Cocinera'),
    apoderado: rep('Hugo', 'Quispe Arce', '40789012', '987206501', 'h.quispe@gmail.com', 'Agricultor'),
  },
  {
    email: 'm.quispe@estudiante.pe',
    fechaNac: '2013-02-28',
    direccion: 'Av. Salvador Allende 445, San Juan de Miraflores',
    anioIngreso: '2019',
    padre: rep('Julio', 'Quispe Rojas', '40678901', '987106601', 'j.quispe@gmail.com', 'Agricultor'),
    madre: rep('Ana', 'Rojas Huanca', '40678902', '987106602', 'a.rojas@gmail.com', 'Cocinera'),
    apoderado: rep('Ana', 'Rojas Huanca', '40678902', '987106602', 'a.rojas@gmail.com', 'Cocinera'),
  },
  {
    email: 'l.castillo@estudiante.pe',
    fechaNac: '2013-05-12',
    direccion: 'Jr. Las Gardenias 678, Villa Maria del Triunfo',
    anioIngreso: '2019',
    padre: rep('Jorge', 'Castillo Vera', '40789012', '987107701', 'j.castillo@gmail.com', 'Mecánico'),
    madre: rep('Teresa', 'Vera Quispe', '40789013', '987107702', 't.vera@gmail.com', 'Secretaria'),
    apoderado: rep('Teresa', 'Vera Quispe', '40789013', '987107702', 't.vera@gmail.com', 'Secretaria'),
  },
  {
    email: 'c.flores@estudiante.pe',
    fechaNac: '2013-08-20',
    direccion: 'Calle Los Rosales 123, San Juan de Miraflores',
    anioIngreso: '2019',
    padre: rep('Raul', 'Flores Diaz', '40890123', '987207701', 'r.flores@gmail.com', 'Chef'),
    madre: rep('Silvia', 'Diaz Mamani', '40890124', '987207702', 's.diaz@gmail.com', 'Diseñadora'),
    apoderado: rep('Silvia', 'Diaz Mamani', '40890124', '987207702', 's.diaz@gmail.com', 'Diseñadora'),
  },
  {
    email: 'a.mamani@estudiante.pe',
    fechaNac: '2013-10-05',
    direccion: 'Av. Los Constructores 901, Villa El Salvador',
    anioIngreso: '2019',
    padre: rep('Felipe', 'Mamani Soto', '40901234', '987208801', 'f.mamani@gmail.com', 'Técnico'),
    madre: rep('Claudia', 'Soto Quispe', '40901235', '987208802', 'c.soto@gmail.com', 'Administradora'),
    apoderado: rep('Felipe', 'Mamani Soto', '40901234', '987208801', 'f.mamani@gmail.com', 'Técnico'),
  },
  {
    email: 's.ramos@estudiante.pe',
    fechaNac: '2010-04-18',
    direccion: 'Av. Benavides 2345, Surco',
    anioIngreso: '2016',
    padre: rep('Hector', 'Ramos Cruz', '40890123', '987108801', 'h.ramos@gmail.com', 'Policía'),
    madre: rep('Claudia', 'Cruz Mamani', '40890124', '987108802', 'c.cruz@gmail.com', 'Enfermera'),
    apoderado: rep('Hector', 'Ramos Cruz', '40890123', '987108801', 'h.ramos@gmail.com', 'Policía'),
  },
  {
    email: 'r.paredes@estudiante.pe',
    fechaNac: '2010-06-30',
    direccion: 'Calle Las Begonias 567, Surco',
    anioIngreso: '2016',
    padre: rep('Oscar', 'Paredes Lino', '41012345', '987209901', 'o.paredes@gmail.com', 'Ingeniero'),
    madre: rep('Monica', 'Lino Torres', '41012346', '987209902', 'm.lino@gmail.com', 'Abogada'),
    apoderado: rep('Monica', 'Lino Torres', '41012346', '987209902', 'm.lino@gmail.com', 'Abogada'),
  },
  {
    email: 'g.torres@estudiante.pe',
    fechaNac: '2010-09-14',
    direccion: 'Jr. Monterrico 890, Surco',
    anioIngreso: '2016',
    padre: rep('Luis', 'Torres Nina', '41123456', '987210001', 'l.torres.padre@gmail.com', 'Empresario'),
    madre: rep('Gabriela', 'Nina Rojas', '41123457', '987210002', 'g.nina@gmail.com', 'Psicóloga'),
    apoderado: rep('Gabriela', 'Nina Rojas', '41123457', '987210002', 'g.nina@gmail.com', 'Psicóloga'),
  },
  {
    email: 'd.fernandez@estudiante.pe',
    fechaNac: '2010-11-25',
    direccion: 'Av. Caminos del Inca 1234, Surco',
    anioIngreso: '2016',
    padre: rep('Pablo', 'Fernandez Mar', '40901234', '987109901', 'p.fernandez@gmail.com', 'Abogado'),
    madre: rep('Isabel', 'Mar Lopez', '40901235', '987109902', 'i.mar@gmail.com', 'Psicóloga'),
    apoderado: rep('Isabel', 'Mar Lopez', '40901235', '987109902', 'i.mar@gmail.com', 'Psicóloga'),
  },
  {
    email: 'p.caceres@estudiante.pe',
    fechaNac: '2010-02-08',
    direccion: 'Calle Los Pinos 345, Surco',
    anioIngreso: '2016',
    padre: rep('Daniel', 'Caceres Ruiz', '41234567', '987211001', 'd.caceres@gmail.com', 'Médico'),
    madre: rep('Veronica', 'Ruiz Solis', '41234568', '987211002', 'v.ruiz@gmail.com', 'Farmacéutica'),
    apoderado: rep('Daniel', 'Caceres Ruiz', '41234567', '987211001', 'd.caceres@gmail.com', 'Médico'),
  },
  {
    email: 'm.silva@estudiante.pe',
    fechaNac: '2010-07-19',
    direccion: 'Av. Primavera 678, Surco',
    anioIngreso: '2016',
    padre: rep('Eduardo', 'Silva Vega', '41345678', '987212001', 'e.silva@gmail.com', 'Arquitecto'),
    madre: rep('Laura', 'Vega Quispe', '41345679', '987212002', 'l.vega@gmail.com', 'Contadora'),
    apoderado: rep('Eduardo', 'Silva Vega', '41345678', '987212001', 'e.silva@gmail.com', 'Arquitecto'),
  },
];

export const STUDENT_HISTORIAL_SEED: Record<string, HistorialSeedRow[]> = {
  'estudiante@escolar.pe': [
    { anio: '2021', grado: '5 años', seccion: 'A', promedio: 14.0, estado: 'Promovido' },
    { anio: '2022', grado: '1° Primaria', seccion: 'A', promedio: 14.2, estado: 'Promovido' },
    { anio: '2023', grado: '2° Primaria', seccion: 'A', promedio: 14.5, estado: 'Promovido' },
    { anio: '2024', grado: '3° Primaria', seccion: 'A', promedio: 14.8, estado: 'Promovido' },
    { anio: '2025', grado: '4° Primaria', seccion: 'A', promedio: 15.2, estado: 'Promovido' },
  ],
  'l.torres@estudiante.pe': [
    { anio: '2021', grado: '5 años', seccion: 'A', promedio: 13.8, estado: 'Promovido' },
    { anio: '2022', grado: '1° Primaria', seccion: 'A', promedio: 14.0, estado: 'Promovido' },
    { anio: '2023', grado: '2° Primaria', seccion: 'A', promedio: 14.3, estado: 'Promovido' },
    { anio: '2024', grado: '3° Primaria', seccion: 'A', promedio: 14.6, estado: 'Promovido' },
    { anio: '2025', grado: '4° Primaria', seccion: 'A', promedio: 15.0, estado: 'Promovido' },
  ],
  'c.mendoza@estudiante.pe': [
    { anio: '2021', grado: '5 años', seccion: 'A', promedio: 14.5, estado: 'Promovido' },
    { anio: '2022', grado: '1° Primaria', seccion: 'A', promedio: 14.8, estado: 'Promovido' },
    { anio: '2023', grado: '2° Primaria', seccion: 'A', promedio: 15.0, estado: 'Promovido' },
    { anio: '2024', grado: '3° Primaria', seccion: 'A', promedio: 15.5, estado: 'Promovido' },
    { anio: '2025', grado: '4° Primaria', seccion: 'A', promedio: 16.1, estado: 'Promovido' },
  ],
  'p.salazar@estudiante.pe': [
    { anio: '2021', grado: '5 años', seccion: 'A', promedio: 13.5, estado: 'Promovido' },
    { anio: '2022', grado: '1° Primaria', seccion: 'A', promedio: 13.8, estado: 'Promovido' },
    { anio: '2023', grado: '2° Primaria', seccion: 'A', promedio: 14.0, estado: 'Promovido' },
    { anio: '2024', grado: '3° Primaria', seccion: 'A', promedio: 14.3, estado: 'Promovido' },
    { anio: '2025', grado: '4° Primaria', seccion: 'A', promedio: 14.7, estado: 'Promovido' },
  ],
  'r.vargas@estudiante.pe': [
    { anio: '2021', grado: '5 años', seccion: 'A', promedio: 14.1, estado: 'Promovido' },
    { anio: '2022', grado: '1° Primaria', seccion: 'A', promedio: 14.3, estado: 'Promovido' },
    { anio: '2023', grado: '2° Primaria', seccion: 'A', promedio: 14.6, estado: 'Promovido' },
    { anio: '2024', grado: '3° Primaria', seccion: 'A', promedio: 14.9, estado: 'Promovido' },
    { anio: '2025', grado: '4° Primaria', seccion: 'A', promedio: 15.3, estado: 'Promovido' },
  ],
  'm.condori@estudiante.pe': [
    { anio: '2021', grado: '5 años', seccion: 'A', promedio: 13.2, estado: 'Promovido' },
    { anio: '2022', grado: '1° Primaria', seccion: 'A', promedio: 13.5, estado: 'Promovido' },
    { anio: '2023', grado: '2° Primaria', seccion: 'A', promedio: 13.8, estado: 'Promovido' },
    { anio: '2024', grado: '3° Primaria', seccion: 'A', promedio: 14.1, estado: 'Promovido' },
    { anio: '2025', grado: '4° Primaria', seccion: 'A', promedio: 14.5, estado: 'Promovido' },
  ],
  'v.rojas@estudiante.pe': [
    { anio: '2021', grado: '5 años', seccion: 'A', promedio: 14.8, estado: 'Promovido' },
    { anio: '2022', grado: '1° Primaria', seccion: 'A', promedio: 15.0, estado: 'Promovido' },
    { anio: '2023', grado: '2° Primaria', seccion: 'A', promedio: 15.3, estado: 'Promovido' },
    { anio: '2024', grado: '3° Primaria', seccion: 'A', promedio: 15.6, estado: 'Promovido' },
    { anio: '2025', grado: '4° Primaria', seccion: 'A', promedio: 16.0, estado: 'Promovido' },
  ],
  'a.garcia@estudiante.pe': [
    { anio: '2021', grado: '5 años', seccion: 'B', promedio: 13.9, estado: 'Promovido' },
    { anio: '2022', grado: '1° Primaria', seccion: 'B', promedio: 14.1, estado: 'Promovido' },
    { anio: '2023', grado: '2° Primaria', seccion: 'B', promedio: 14.4, estado: 'Promovido' },
    { anio: '2024', grado: '3° Primaria', seccion: 'B', promedio: 14.9, estado: 'Promovido' },
    { anio: '2025', grado: '4° Primaria', seccion: 'B', promedio: 15.5, estado: 'Promovido' },
  ],
  'j.paredes@estudiante.pe': [
    { anio: '2021', grado: '5 años', seccion: 'B', promedio: 13.5, estado: 'Promovido' },
    { anio: '2022', grado: '1° Primaria', seccion: 'B', promedio: 13.8, estado: 'Promovido' },
    { anio: '2023', grado: '2° Primaria', seccion: 'B', promedio: 14.0, estado: 'Promovido' },
    { anio: '2024', grado: '3° Primaria', seccion: 'B', promedio: 13.2, estado: 'Repitente' },
    { anio: '2025', grado: '4° Primaria', seccion: 'B', promedio: 14.8, estado: 'Promovido' },
  ],
  's.huaman@estudiante.pe': [
    { anio: '2021', grado: '5 años', seccion: 'B', promedio: 14.2, estado: 'Promovido' },
    { anio: '2022', grado: '1° Primaria', seccion: 'B', promedio: 14.5, estado: 'Promovido' },
    { anio: '2023', grado: '2° Primaria', seccion: 'B', promedio: 14.8, estado: 'Promovido' },
    { anio: '2024', grado: '3° Primaria', seccion: 'B', promedio: 15.1, estado: 'Promovido' },
    { anio: '2025', grado: '4° Primaria', seccion: 'B', promedio: 15.4, estado: 'Promovido' },
  ],
  'd.quispe@estudiante.pe': [
    { anio: '2021', grado: '5 años', seccion: 'B', promedio: 13.7, estado: 'Promovido' },
    { anio: '2022', grado: '1° Primaria', seccion: 'B', promedio: 14.0, estado: 'Promovido' },
    { anio: '2023', grado: '2° Primaria', seccion: 'B', promedio: 14.2, estado: 'Promovido' },
    { anio: '2024', grado: '3° Primaria', seccion: 'B', promedio: 14.6, estado: 'Promovido' },
    { anio: '2025', grado: '4° Primaria', seccion: 'B', promedio: 15.0, estado: 'Promovido' },
  ],
  'm.quispe@estudiante.pe': [
    { anio: '2022', grado: '5 años', seccion: 'A', promedio: 13.6, estado: 'Promovido' },
    { anio: '2023', grado: '1° Primaria', seccion: 'A', promedio: 13.9, estado: 'Promovido' },
    { anio: '2024', grado: '2° Primaria', seccion: 'A', promedio: 14.3, estado: 'Promovido' },
    { anio: '2025', grado: '3° Primaria', seccion: 'A', promedio: 15.0, estado: 'Promovido' },
  ],
  'l.castillo@estudiante.pe': [
    { anio: '2022', grado: '5 años', seccion: 'A', promedio: 13.4, estado: 'Promovido' },
    { anio: '2023', grado: '1° Primaria', seccion: 'A', promedio: 13.7, estado: 'Promovido' },
    { anio: '2024', grado: '2° Primaria', seccion: 'A', promedio: 14.1, estado: 'Promovido' },
    { anio: '2025', grado: '3° Primaria', seccion: 'A', promedio: 14.8, estado: 'Promovido' },
  ],
  'c.flores@estudiante.pe': [
    { anio: '2022', grado: '5 años', seccion: 'A', promedio: 14.5, estado: 'Promovido' },
    { anio: '2023', grado: '1° Primaria', seccion: 'A', promedio: 14.8, estado: 'Promovido' },
    { anio: '2024', grado: '2° Primaria', seccion: 'A', promedio: 15.2, estado: 'Promovido' },
    { anio: '2025', grado: '3° Primaria', seccion: 'A', promedio: 15.6, estado: 'Promovido' },
  ],
  'a.mamani@estudiante.pe': [
    { anio: '2022', grado: '5 años', seccion: 'A', promedio: 13.0, estado: 'Promovido' },
    { anio: '2023', grado: '1° Primaria', seccion: 'A', promedio: 13.3, estado: 'Promovido' },
    { anio: '2024', grado: '2° Primaria', seccion: 'A', promedio: 13.7, estado: 'Promovido' },
    { anio: '2025', grado: '3° Primaria', seccion: 'A', promedio: 14.2, estado: 'Promovido' },
  ],
  's.ramos@estudiante.pe': [
    { anio: '2021', grado: '3° Primaria', seccion: 'A', promedio: 13.2, estado: 'Promovido' },
    { anio: '2022', grado: '4° Primaria', seccion: 'A', promedio: 13.8, estado: 'Promovido' },
    { anio: '2023', grado: '5° Primaria', seccion: 'A', promedio: 14.2, estado: 'Promovido' },
    { anio: '2024', grado: '6° Primaria', seccion: 'A', promedio: 14.7, estado: 'Promovido' },
    { anio: '2025', grado: '1° Secundaria', seccion: 'A', promedio: 14.9, estado: 'Promovido' },
  ],
  'r.paredes@estudiante.pe': [
    { anio: '2021', grado: '3° Primaria', seccion: 'A', promedio: 13.0, estado: 'Promovido' },
    { anio: '2022', grado: '4° Primaria', seccion: 'A', promedio: 13.4, estado: 'Promovido' },
    { anio: '2023', grado: '5° Primaria', seccion: 'A', promedio: 13.9, estado: 'Promovido' },
    { anio: '2024', grado: '6° Primaria', seccion: 'A', promedio: 14.3, estado: 'Promovido' },
    { anio: '2025', grado: '1° Secundaria', seccion: 'A', promedio: 14.6, estado: 'Promovido' },
  ],
  'g.torres@estudiante.pe': [
    { anio: '2021', grado: '3° Primaria', seccion: 'A', promedio: 14.5, estado: 'Promovido' },
    { anio: '2022', grado: '4° Primaria', seccion: 'A', promedio: 14.9, estado: 'Promovido' },
    { anio: '2023', grado: '5° Primaria', seccion: 'A', promedio: 15.2, estado: 'Promovido' },
    { anio: '2024', grado: '6° Primaria', seccion: 'A', promedio: 15.6, estado: 'Promovido' },
    { anio: '2025', grado: '1° Secundaria', seccion: 'A', promedio: 15.9, estado: 'Promovido' },
  ],
  'd.fernandez@estudiante.pe': [
    { anio: '2021', grado: '3° Primaria', seccion: 'B', promedio: 13.0, estado: 'Promovido' },
    { anio: '2022', grado: '4° Primaria', seccion: 'B', promedio: 13.5, estado: 'Promovido' },
    { anio: '2023', grado: '5° Primaria', seccion: 'B', promedio: 14.0, estado: 'Promovido' },
    { anio: '2024', grado: '6° Primaria', seccion: 'B', promedio: 14.4, estado: 'Promovido' },
    { anio: '2025', grado: '1° Secundaria', seccion: 'B', promedio: 14.6, estado: 'Promovido' },
  ],
  'p.caceres@estudiante.pe': [
    { anio: '2021', grado: '3° Primaria', seccion: 'B', promedio: 14.2, estado: 'Promovido' },
    { anio: '2022', grado: '4° Primaria', seccion: 'B', promedio: 14.6, estado: 'Promovido' },
    { anio: '2023', grado: '5° Primaria', seccion: 'B', promedio: 15.0, estado: 'Promovido' },
    { anio: '2024', grado: '6° Primaria', seccion: 'B', promedio: 15.3, estado: 'Promovido' },
    { anio: '2025', grado: '1° Secundaria', seccion: 'B', promedio: 15.7, estado: 'Promovido' },
  ],
  'm.silva@estudiante.pe': [
    { anio: '2021', grado: '3° Primaria', seccion: 'B', promedio: 12.8, estado: 'Promovido' },
    { anio: '2022', grado: '4° Primaria', seccion: 'B', promedio: 13.2, estado: 'Promovido' },
    { anio: '2023', grado: '5° Primaria', seccion: 'B', promedio: 13.6, estado: 'Promovido' },
    { anio: '2024', grado: '6° Primaria', seccion: 'B', promedio: 14.0, estado: 'Promovido' },
    { anio: '2025', grado: '1° Secundaria', seccion: 'B', promedio: 14.3, estado: 'Promovido' },
  ],
};
