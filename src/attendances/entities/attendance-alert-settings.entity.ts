import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('attendance_alert_settings')
export class AttendanceAlertSettings {
  @PrimaryGeneratedColumn()
  id: number;

  /** Null = configuración global por defecto. */
  @Column({ type: 'int', nullable: true })
  institutionId: number | null;

  /** Alerta cuando faltas injustificadas o consecutivas superan este valor */
  @Column({ type: 'int', default: 2 })
  diasAlertaAusentismo: number;

  /** Nivel crítico cuando supera este valor */
  @Column({ type: 'int', default: 5 })
  diasAlertaCritica: number;

  /** Porcentaje de inasistencia injustificada sobre días con registro. */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 15 })
  porcentajeUmbral: number;

  /** mes | bimestre | rolling30 */
  @Column({ length: 20, default: 'mes' })
  periodoTipo: string;

  /** Filtro opcional: Inicial, Primaria, Secundaria. Vacío = todos. */
  @Column({ length: 30, default: '' })
  nivelEducativo: string;

  /** todos | presencial | virtual */
  @Column({ length: 20, default: 'todos' })
  modalidad: string;
}
