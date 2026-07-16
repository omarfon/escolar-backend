import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('attendance_alert_settings')
export class AttendanceAlertSettings {
  @PrimaryGeneratedColumn()
  id: number;

  /** Alerta cuando faltas injustificadas o consecutivas superan este valor */
  @Column({ type: 'int', default: 2 })
  diasAlertaAusentismo: number;

  /** Nivel crítico cuando supera este valor */
  @Column({ type: 'int', default: 5 })
  diasAlertaCritica: number;
}
