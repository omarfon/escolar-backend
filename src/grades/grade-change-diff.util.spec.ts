import { Grade } from './entities/grade.entity';
import { diffGradeSnapshots, snapshotGrade } from './grade-change-diff.util';

describe('grade-change-diff.util', () => {
  const base = {
    id: 1,
    studentId: 10,
    curso: 'Matemática',
    tipo: 'partial' as const,
    componenteCodigo: 'examen_parcial',
    bimestre: 2,
    nota: 15,
    fechaEvaluacion: '2026-06-01',
    descripcion: '',
  } as Grade;

  it('genera snapshot de nota', () => {
    const snap = snapshotGrade(base);
    expect(snap['nota']).toBe(15);
    expect(snap['curso']).toBe('Matemática');
  });

  it('detecta cambio de nota', () => {
    const before = snapshotGrade(base);
    const after = snapshotGrade({ ...base, nota: 16 });
    const diff = diffGradeSnapshots(before, after);
    expect(diff?.nota).toEqual({ anterior: 15, nuevo: 16 });
  });

  it('retorna null si no hay cambios', () => {
    const snap = snapshotGrade(base);
    expect(diffGradeSnapshots(snap, { ...snap })).toBeNull();
  });
});
