import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('curricula_areas')
export class CurriculumArea {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  curriculumId: number | null;

  @Column({ length: 120 })
  nombre: string;

  @Column({ length: 20 })
  nivel: string;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @Column({ length: 80, default: 'bg-blue-50 border-blue-200 text-blue-800' })
  colorClass: string;

  @Column({ length: 40, default: 'bg-blue-500' })
  dotClass: string;

  @Column({ default: true })
  activo: boolean;
}
