import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type DocumentoEstado = 'entregado' | 'pendiente' | 'vencido';

@Entity('student_documents')
export class StudentDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  studentId: number;

  @Column({ length: 150 })
  tipo: string;

  @Column({ length: 80, default: '' })
  numero: string;

  @Column({ length: 15, default: 'pendiente' })
  estado: DocumentoEstado;

  @Column({ length: 20, default: '' })
  fechaEntrega: string;

  @Column({ type: 'text', default: '' })
  imagenUrl: string;
}
