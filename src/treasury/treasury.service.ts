import { Injectable, BadRequestException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PaymentConcept } from './entities/payment-concept.entity';
import { StudentCharge, ChargeEstado } from './entities/student-charge.entity';
import { StudentPayment } from './entities/student-payment.entity';
import { Student } from '../students/entities/student.entity';
import { Institution } from '../institution/entities/institution.entity';
import {
  TREASURY_DEMO_STUDENTS,
} from './treasury-seed.data';
import { PayVisaDto } from './dto/pay-visa.dto';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import {
  StaffChargeItemDto,
  TreasurySummaryDto,
} from './dto/treasury-charge.dto';
import {
  CreatePaymentConceptDto,
  PaymentConceptResponseDto,
  UpdatePaymentConceptDto,
} from './dto/payment-concept.dto';
import {
  BoletaVentaDto,
  PayVisaResultDto,
} from './dto/boleta-venta.dto';

export interface PaymentItemDto {
  id: number;
  monto: number;
  fechaPago: string;
  metodoPago: string;
  referencia: string;
  numeroBoleta: string;
  tarjetaMarca: string;
  tarjetaUltimos4: string;
}

export interface ChargeItemDto {
  id: number;
  concepto: string;
  codigoConcepto: string;
  tipoConcepto: string;
  periodoLabel: string;
  monto: number;
  montoPagado: number;
  saldo: number;
  fechaVencimiento: string;
  estado: ChargeEstado;
  pagos: PaymentItemDto[];
}

export interface AccountStatementResumen {
  totalDeuda: number;
  totalPagado: number;
  pendiente: number;
  vencido: number;
  proximoVencimiento: string | null;
}

export interface AccountStatementDto {
  studentId: number;
  anioEscolar: number;
  resumen: AccountStatementResumen;
  matricula: ChargeItemDto | null;
  mensualidades: ChargeItemDto[];
  otros: ChargeItemDto[];
}

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

@Injectable()
export class TreasuryService implements OnModuleInit {
  constructor(
    @InjectRepository(PaymentConcept)
    private readonly conceptRepo: Repository<PaymentConcept>,
    @InjectRepository(StudentCharge)
    private readonly chargeRepo: Repository<StudentCharge>,
    @InjectRepository(StudentPayment)
    private readonly paymentRepo: Repository<StudentPayment>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Institution)
    private readonly institutionRepo: Repository<Institution>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensurePaymentBoletas();
  }

  async getAccountStatement(
    studentId: number,
    anioEscolar?: number,
  ): Promise<AccountStatementDto> {
    const anio = anioEscolar ?? new Date().getFullYear();
    const charges = await this.chargeRepo.find({
      where: { studentId, anioEscolar: anio },
      order: { fechaVencimiento: 'ASC', id: 'ASC' },
    });

    const conceptIds = [...new Set(charges.map((c) => c.conceptId))];
    const concepts = conceptIds.length
      ? await this.conceptRepo.find({ where: { id: In(conceptIds) } })
      : [];
    const conceptMap = new Map(concepts.map((c) => [c.id, c]));

    const chargeIds = charges.map((c) => c.id);
    const payments = chargeIds.length
      ? await this.paymentRepo.find({
          where: { chargeId: In(chargeIds) },
          order: { fechaPago: 'DESC' },
        })
      : [];
    const paymentsByCharge = new Map<number, StudentPayment[]>();
    for (const p of payments) {
      const list = paymentsByCharge.get(p.chargeId) ?? [];
      list.push(p);
      paymentsByCharge.set(p.chargeId, list);
    }

    const items: ChargeItemDto[] = charges.map((charge) => {
      const concept = conceptMap.get(charge.conceptId);
      const monto = Number(charge.monto);
      const montoPagado = Number(charge.montoPagado);
      const saldo = Math.max(monto - montoPagado, 0);
      const estado = this.resolveEstado(charge, saldo);
      const pagos = (paymentsByCharge.get(charge.id) ?? []).map((p) => ({
        id: p.id,
        monto: Number(p.monto),
        fechaPago: p.fechaPago,
        metodoPago: p.metodoPago,
        referencia: p.referencia,
        numeroBoleta: p.numeroBoleta,
        tarjetaMarca: p.tarjetaMarca,
        tarjetaUltimos4: p.tarjetaUltimos4,
      }));

      return {
        id: charge.id,
        concepto: concept?.nombre ?? 'Concepto',
        codigoConcepto: concept?.codigo ?? '',
        tipoConcepto: concept?.periodicidad ?? '',
        periodoLabel: charge.periodoLabel,
        monto,
        montoPagado,
        saldo,
        fechaVencimiento: charge.fechaVencimiento,
        estado,
        pagos,
      };
    });

    const matricula =
      items.find(
        (i) =>
          i.tipoConcepto === 'anual' ||
          i.codigoConcepto.startsWith('MAT-'),
      ) ?? null;

    const mensualidades = items.filter((i) => i.tipoConcepto === 'mensual');
    const otros = items.filter(
      (i) => i !== matricula && !mensualidades.includes(i),
    );

    const totalDeuda = items.reduce((s, i) => s + i.monto, 0);
    const totalPagado = items.reduce((s, i) => s + i.montoPagado, 0);
    const pendiente = items
      .filter((i) => i.estado === 'pendiente' || i.estado === 'parcial')
      .reduce((s, i) => s + i.saldo, 0);
    const vencido = items
      .filter((i) => i.estado === 'vencido')
      .reduce((s, i) => s + i.saldo, 0);

    const proximos = items
      .filter((i) => i.saldo > 0 && i.estado !== 'vencido')
      .map((i) => i.fechaVencimiento)
      .sort();

    return {
      studentId,
      anioEscolar: anio,
      resumen: {
        totalDeuda,
        totalPagado,
        pendiente,
        vencido,
        proximoVencimiento: proximos[0] ?? null,
      },
      matricula,
      mensualidades,
      otros,
    };
  }

  async payChargeWithVisa(
    studentId: number,
    chargeId: number,
    dto: PayVisaDto,
    registradoPor: string,
  ): Promise<PayVisaResultDto> {
    this.validateVisaCard(dto);

    const charge = await this.chargeRepo.findOneBy({ id: chargeId, studentId });
    if (!charge) {
      throw new NotFoundException('Cargo no encontrado para este alumno');
    }

    const saldo = Math.max(Number(charge.monto) - Number(charge.montoPagado), 0);
    if (saldo <= 0) {
      throw new BadRequestException('Este cargo ya está pagado');
    }

    const monto = dto.monto ?? saldo;
    if (monto <= 0 || monto > saldo + 0.001) {
      throw new BadRequestException(
        `El monto debe ser mayor a 0 y no superar el saldo (S/ ${saldo.toFixed(2)})`,
      );
    }

    const hoy = new Date().toISOString().slice(0, 10);
    const referencia = this.buildVisaReference(dto.numeroTarjeta);
    const ultimos4 = dto.numeroTarjeta.slice(-4);

    return this.applyPayment(
      charge,
      monto,
      hoy,
      'visa',
      referencia,
      registradoPor,
      'Visa',
      ultimos4,
    );
  }

  async getPaymentReceipt(
    studentId: number,
    paymentId: number,
    apoderadoNombre = '',
  ): Promise<BoletaVentaDto> {
    const payment = await this.paymentRepo.findOneBy({ id: paymentId });
    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    const charge = await this.chargeRepo.findOneBy({ id: payment.chargeId });
    if (!charge || charge.studentId !== studentId) {
      throw new NotFoundException('Boleta no disponible para este alumno');
    }

    const student = await this.studentRepo.findOneBy({ id: studentId });
    if (!student) {
      throw new NotFoundException('Alumno no encontrado');
    }

    const concept = await this.conceptRepo.findOneBy({ id: charge.conceptId });
    const institucion = await this.getInstitutionInfo();
    const { serie, correlativo } = this.parseBoletaNumber(payment.numeroBoleta);

    return {
      id: payment.id,
      numeroBoleta: payment.numeroBoleta,
      serie,
      correlativo,
      fechaEmision: payment.fechaPago,
      fechaPago: payment.fechaPago,
      estudiante: {
        id: student.id,
        nombreCompleto: `${student.nombre} ${student.apellido}`.trim(),
        nivel: student.nivel,
        grado: student.grado,
        seccion: student.seccion,
      },
      apoderado: apoderadoNombre,
      concepto: concept?.nombre ?? 'Concepto de pago',
      periodoLabel: charge.periodoLabel,
      anioEscolar: charge.anioEscolar,
      monto: Number(payment.monto),
      metodoPago: payment.metodoPago,
      referencia: payment.referencia,
      tarjetaMarca: payment.tarjetaMarca,
      tarjetaUltimos4: payment.tarjetaUltimos4,
      institucion,
    };
  }

  async ensureTreasuryDemoData(anioEscolar?: number): Promise<void> {
    const anio = anioEscolar ?? new Date().getFullYear();

    for (const email of TREASURY_DEMO_STUDENTS) {
      const student = await this.studentRepo.findOneBy({ email });
      if (!student) continue;

      const existing = await this.chargeRepo.count({
        where: { studentId: student.id, anioEscolar: anio },
      });
      if (existing > 0) continue;

      await this.seedChargesForStudent(student, anio);
    }
  }

  // ── Staff: cargos, resumen y registro de pagos ─────────────────────────

  async findStaffCharges(filters?: {
    anioEscolar?: number;
    q?: string;
    estado?: ChargeEstado;
  }): Promise<StaffChargeItemDto[]> {
    const anio = filters?.anioEscolar ?? new Date().getFullYear();
    const charges = await this.chargeRepo.find({
      where: { anioEscolar: anio },
      order: { fechaVencimiento: 'ASC', id: 'ASC' },
    });

    if (!charges.length) return [];

    const studentIds = [...new Set(charges.map((c) => c.studentId))];
    const conceptIds = [...new Set(charges.map((c) => c.conceptId))];

    const [students, concepts] = await Promise.all([
      this.studentRepo.find({ where: { id: In(studentIds) } }),
      conceptIds.length
        ? this.conceptRepo.find({ where: { id: In(conceptIds) } })
        : Promise.resolve([]),
    ]);

    const studentMap = new Map(students.map((s) => [s.id, s]));
    const conceptMap = new Map(concepts.map((c) => [c.id, c]));

    const q = filters?.q?.trim().toLowerCase() ?? '';
    const estadoFilter = filters?.estado;

    const items: StaffChargeItemDto[] = [];

    for (const charge of charges) {
      const student = studentMap.get(charge.studentId);
      const concept = conceptMap.get(charge.conceptId);
      const monto = Number(charge.monto);
      const montoPagado = Number(charge.montoPagado);
      const saldo = Math.max(monto - montoPagado, 0);
      const estado = this.resolveEstado(charge, saldo);

      if (estadoFilter && estado !== estadoFilter) continue;

      const alumno = student
        ? `${student.apellido}, ${student.nombre}`.trim()
        : 'Alumno desconocido';
      const codigoAlumno = student?.codigo ?? '';
      const grado = student?.grado ?? '';
      const seccion = student?.seccion ?? '';
      const nivel = student?.nivel ?? '';

      if (q) {
        const haystack = [
          alumno,
          codigoAlumno,
          grado,
          concept?.nombre ?? '',
          concept?.codigo ?? '',
          charge.periodoLabel,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) continue;
      }

      items.push({
        id: charge.id,
        studentId: charge.studentId,
        alumno,
        codigoAlumno,
        grado,
        seccion,
        nivel,
        concepto: concept?.nombre ?? 'Concepto',
        codigoConcepto: concept?.codigo ?? '',
        periodoLabel: charge.periodoLabel,
        monto,
        montoPagado,
        saldo,
        fechaVencimiento: charge.fechaVencimiento,
        estado,
        anioEscolar: charge.anioEscolar,
      });
    }

    return items;
  }

  async getTreasurySummary(anioEscolar?: number): Promise<TreasurySummaryDto> {
    const anio = anioEscolar ?? new Date().getFullYear();
    const charges = await this.chargeRepo.find({
      where: { anioEscolar: anio },
    });

    let recaudado = 0;
    let pendiente = 0;
    let vencido = 0;
    let cargosPendientes = 0;

    for (const charge of charges) {
      const monto = Number(charge.monto);
      const montoPagado = Number(charge.montoPagado);
      const saldo = Math.max(monto - montoPagado, 0);
      const estado = this.resolveEstado(charge, saldo);

      recaudado += montoPagado;
      if (estado === 'vencido') {
        vencido += saldo;
        cargosPendientes += 1;
      } else if (estado === 'pendiente' || estado === 'parcial') {
        pendiente += saldo;
        cargosPendientes += 1;
      }
    }

    const hoy = new Date();
    const year = hoy.getFullYear();
    const month = hoy.getMonth();
    const iniMes = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const ultimoDia = new Date(year, month + 1, 0).getDate();
    const finMes = `${year}-${String(month + 1).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
    const payments = await this.paymentRepo
      .createQueryBuilder('p')
      .where('p.fechaPago >= :iniMes AND p.fechaPago <= :finMes', {
        iniMes,
        finMes,
      })
      .getMany();
    const recaudadoMes = payments.reduce((s, p) => s + Number(p.monto), 0);

    return {
      anioEscolar: anio,
      recaudado,
      pendiente,
      vencido,
      recaudadoMes,
      totalCargos: charges.length,
      cargosPendientes,
    };
  }

  async registerStaffPayment(
    chargeId: number,
    dto: RegisterPaymentDto,
    registradoPor: string,
  ): Promise<PayVisaResultDto> {
    const charge = await this.chargeRepo.findOneBy({ id: chargeId });
    if (!charge) {
      throw new NotFoundException('Cargo no encontrado');
    }

    const saldo = Math.max(Number(charge.monto) - Number(charge.montoPagado), 0);
    if (saldo <= 0) {
      throw new BadRequestException('Este cargo ya está pagado');
    }

    const monto = dto.monto;
    if (monto <= 0 || monto > saldo + 0.001) {
      throw new BadRequestException(
        `El monto debe ser mayor a 0 y no superar el saldo (S/ ${saldo.toFixed(2)})`,
      );
    }

    const fechaPago = dto.fechaPago ?? new Date().toISOString().slice(0, 10);
    const referencia = dto.referencia?.trim() ?? '';

    return this.applyPayment(
      charge,
      monto,
      fechaPago,
      dto.metodoPago,
      referencia,
      registradoPor,
    );
  }

  async payChargeWithVisaStaff(
    chargeId: number,
    dto: PayVisaDto,
    registradoPor: string,
  ): Promise<PayVisaResultDto> {
    const charge = await this.chargeRepo.findOneBy({ id: chargeId });
    if (!charge) {
      throw new NotFoundException('Cargo no encontrado');
    }
    return this.payChargeWithVisa(
      charge.studentId,
      chargeId,
      dto,
      registradoPor,
    );
  }

  async getPaymentReceiptStaff(paymentId: number): Promise<BoletaVentaDto> {
    const payment = await this.paymentRepo.findOneBy({ id: paymentId });
    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    const charge = await this.chargeRepo.findOneBy({ id: payment.chargeId });
    if (!charge) {
      throw new NotFoundException('Cargo asociado no encontrado');
    }

    return this.getPaymentReceipt(
      charge.studentId,
      paymentId,
      payment.registradoPor,
    );
  }

  private async applyPayment(
    charge: StudentCharge,
    monto: number,
    fechaPago: string,
    metodoPago: string,
    referencia: string,
    registradoPor: string,
    tarjetaMarca = '',
    tarjetaUltimos4 = '',
  ): Promise<PayVisaResultDto> {
    const numeroBoleta = await this.nextBoletaNumber();

    const payment = await this.paymentRepo.save(
      this.paymentRepo.create({
        chargeId: charge.id,
        monto,
        fechaPago,
        metodoPago,
        referencia,
        numeroBoleta,
        tarjetaMarca,
        tarjetaUltimos4,
        registradoPor,
      }),
    );

    charge.montoPagado = Number(charge.montoPagado) + monto;
    const saldoRestante = Math.max(
      Number(charge.monto) - Number(charge.montoPagado),
      0,
    );
    charge.estado = this.resolveEstado(charge, saldoRestante);
    await this.chargeRepo.save(charge);

    return {
      paymentId: payment.id,
      numeroBoleta,
      monto,
      chargeId: charge.id,
      estado: charge.estado,
      saldoRestante,
    };
  }


  // ── CRUD conceptos de pago ───────────────────────────────────────────────

  async findAllConcepts(filters?: {
    tipo?: PaymentConcept['tipo'];
    nivel?: string;
    activo?: boolean;
    q?: string;
  }): Promise<PaymentConceptResponseDto[]> {
    const qb = this.conceptRepo
      .createQueryBuilder('c')
      .orderBy('c.id', 'DESC');

    if (filters?.tipo) {
      qb.andWhere('c.tipo = :tipo', { tipo: filters.tipo });
    }
    if (filters?.nivel) {
      qb.andWhere('c.nivel = :nivel', { nivel: filters.nivel });
    }
    if (filters?.activo !== undefined) {
      qb.andWhere('c.activo = :activo', { activo: filters.activo });
    }
    if (filters?.q?.trim()) {
      const q = `%${filters.q.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(c.nombre) LIKE :q OR LOWER(c.codigo) LIKE :q OR LOWER(c.descripcion) LIKE :q)',
        { q },
      );
    }

    const rows = await qb.getMany();
    return rows.map((row) => this.toConceptResponse(row));
  }

  async findConceptById(id: number): Promise<PaymentConceptResponseDto> {
    const row = await this.conceptRepo.findOneBy({ id });
    if (!row) {
      throw new NotFoundException('Concepto de pago no encontrado');
    }
    return this.toConceptResponse(row);
  }

  async createConcept(
    dto: CreatePaymentConceptDto,
  ): Promise<PaymentConceptResponseDto> {
    const codigo = await this.nextConceptCodigo();
    const saved = await this.conceptRepo.save(
      this.conceptRepo.create({
        codigo,
        nombre: dto.nombre.trim(),
        descripcion: dto.descripcion?.trim() ?? '',
        monto: dto.monto,
        tipo: dto.tipo,
        periodicidad: dto.periodicidad,
        nivel: dto.nivel?.trim() || 'Todos',
        activo: dto.activo ?? true,
      }),
    );
    return this.toConceptResponse(saved);
  }

  async updateConcept(
    id: number,
    dto: UpdatePaymentConceptDto,
  ): Promise<PaymentConceptResponseDto> {
    const row = await this.conceptRepo.findOneBy({ id });
    if (!row) {
      throw new NotFoundException('Concepto de pago no encontrado');
    }

    if (dto.nombre !== undefined) row.nombre = dto.nombre.trim();
    if (dto.descripcion !== undefined) row.descripcion = dto.descripcion.trim();
    if (dto.monto !== undefined) row.monto = dto.monto;
    if (dto.tipo !== undefined) row.tipo = dto.tipo;
    if (dto.periodicidad !== undefined) row.periodicidad = dto.periodicidad;
    if (dto.nivel !== undefined) row.nivel = dto.nivel.trim() || 'Todos';
    if (dto.activo !== undefined) row.activo = dto.activo;

    const saved = await this.conceptRepo.save(row);
    return this.toConceptResponse(saved);
  }

  async setConceptActivo(
    id: number,
    activo: boolean,
  ): Promise<PaymentConceptResponseDto> {
    const row = await this.conceptRepo.findOneBy({ id });
    if (!row) {
      throw new NotFoundException('Concepto de pago no encontrado');
    }
    row.activo = activo;
    const saved = await this.conceptRepo.save(row);
    return this.toConceptResponse(saved);
  }

  async removeConcept(id: number): Promise<{ deleted: boolean; id: number }> {
    const row = await this.conceptRepo.findOneBy({ id });
    if (!row) {
      throw new NotFoundException('Concepto de pago no encontrado');
    }

    const cargos = await this.chargeRepo.count({ where: { conceptId: id } });
    if (cargos > 0) {
      throw new BadRequestException(
        'No se puede eliminar: existen cargos asociados a este concepto',
      );
    }

    await this.conceptRepo.remove(row);
    return { deleted: true, id };
  }

  private async nextConceptCodigo(): Promise<string> {
    const last = await this.conceptRepo
      .createQueryBuilder('c')
      .where("c.codigo LIKE 'CP-%'")
      .orderBy('c.id', 'DESC')
      .getOne();

    if (!last) return 'CP-001';

    const match = last.codigo.match(/^CP-(\d+)$/);
    const num = match ? Number(match[1]) : 0;
    return `CP-${String(num + 1).padStart(3, '0')}`;
  }

  private toConceptResponse(row: PaymentConcept): PaymentConceptResponseDto {
    return {
      id: row.id,
      codigo: row.codigo,
      nombre: row.nombre,
      descripcion: row.descripcion,
      monto: Number(row.monto),
      tipo: row.tipo,
      periodicidad: row.periodicidad,
      nivel: row.nivel,
      activo: row.activo,
      creadoEl: this.formatCreadoEl(row.createdAt ?? new Date()),
    };
  }

  private formatCreadoEl(date: Date): string {
    const months = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  private async seedChargesForStudent(
    student: Student,
    anio: number,
  ): Promise<void> {
    const matCodigo =
      student.nivel === 'Secundaria' ? 'MAT-SEC' : 'MAT-PRIM';
    const mensCodigo =
      student.nivel === 'Secundaria' ? 'MENS-SEC' : 'MENS-PRIM';

    const matConcept = await this.conceptRepo.findOneBy({ codigo: matCodigo });
    const mensConcept = await this.conceptRepo.findOneBy({ codigo: mensCodigo });
    if (!matConcept || !mensConcept) {
      return;
    }

    const matCharge = await this.chargeRepo.save(
      this.chargeRepo.create({
        studentId: student.id,
        conceptId: matConcept.id,
        anioEscolar: anio,
        periodoLabel: `Matrícula ${anio}`,
        monto: matConcept.monto,
        montoPagado: 0,
        fechaVencimiento: `${anio}-03-15`,
        estado: 'pendiente',
      }),
    );

    const matPaid = student.email === 'estudiante@escolar.pe';
    if (matPaid) {
      await this.registerPayment(
        matCharge.id,
        Number(matConcept.monto),
        `${anio}-02-28`,
        'transferencia',
        'OP-2026-00142',
        'Tesorería',
      );
    }

    const hoy = new Date();
    const mesActual = hoy.getMonth();

    for (let m = 0; m < 12; m++) {
      const lastDay = new Date(anio, m + 1, 0).getDate();
      const vencimiento = `${anio}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const label = `${MESES[m]} ${anio}`;

      const charge = await this.chargeRepo.save(
        this.chargeRepo.create({
          studentId: student.id,
          conceptId: mensConcept.id,
          anioEscolar: anio,
          periodoLabel: label,
          monto: mensConcept.monto,
          montoPagado: 0,
          fechaVencimiento: vencimiento,
          estado: 'pendiente',
        }),
      );

      if (m < mesActual - 1) {
        await this.registerPayment(
          charge.id,
          Number(mensConcept.monto),
          `${anio}-${String(m + 1).padStart(2, '0')}-05`,
          m === 0 ? 'efectivo' : 'transferencia',
          `OP-2026-${String(200 + m).padStart(4, '0')}`,
          'Tesorería',
        );
      } else if (m === mesActual - 1 && student.email !== 'c.mendoza@estudiante.pe') {
        await this.registerPayment(
          charge.id,
          Number(mensConcept.monto) / 2,
          `${anio}-${String(m + 1).padStart(2, '0')}-12`,
          'transferencia',
          `OP-2026-${String(300 + m).padStart(4, '0')}`,
          'Tesorería',
        );
      }
    }

    await this.refreshChargeStates(student.id, anio);
  }

  private async registerPayment(
    chargeId: number,
    monto: number,
    fechaPago: string,
    metodoPago: string,
    referencia: string,
    registradoPor: string,
  ): Promise<void> {
    const charge = await this.chargeRepo.findOneByOrFail({ id: chargeId });
    await this.applyPayment(
      charge,
      monto,
      fechaPago,
      metodoPago,
      referencia,
      registradoPor,
      metodoPago === 'visa' ? 'Visa' : '',
      '',
    );
  }

  private async refreshChargeStates(
    studentId: number,
    anio: number,
  ): Promise<void> {
    const charges = await this.chargeRepo.find({
      where: { studentId, anioEscolar: anio },
    });
    for (const charge of charges) {
      const saldo = Math.max(
        Number(charge.monto) - Number(charge.montoPagado),
        0,
      );
      charge.estado = this.resolveEstado(charge, saldo);
      await this.chargeRepo.save(charge);
    }
  }

  private resolveEstado(charge: StudentCharge, saldo: number): ChargeEstado {
    if (saldo <= 0) return 'pagado';
    const pagado = Number(charge.montoPagado);
    if (pagado > 0) return 'parcial';
    const hoy = new Date().toISOString().slice(0, 10);
    if (charge.fechaVencimiento < hoy) return 'vencido';
    return 'pendiente';
  }

  private validateVisaCard(dto: PayVisaDto): void {
    const digits = dto.numeroTarjeta.replace(/\D/g, '');
    if (!digits.startsWith('4')) {
      throw new BadRequestException('Solo se aceptan tarjetas Visa (deben iniciar con 4)');
    }
    if (!this.passesLuhn(digits)) {
      throw new BadRequestException('Número de tarjeta inválido');
    }

    const [mm, yy] = dto.vencimiento.split('/').map(Number);
    const now = new Date();
    const expYear = 2000 + yy;
    const expMonth = mm - 1;
    const expiry = new Date(expYear, expMonth + 1, 0);
    if (expiry < now) {
      throw new BadRequestException('La tarjeta está vencida');
    }

    if (!dto.nombreTitular.trim()) {
      throw new BadRequestException('Ingrese el nombre del titular');
    }
  }

  private passesLuhn(num: string): boolean {
    let sum = 0;
    let alt = false;
    for (let i = num.length - 1; i >= 0; i--) {
      let n = Number(num[i]);
      if (alt) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  private buildVisaReference(numeroTarjeta: string): string {
    const tail = numeroTarjeta.slice(-4);
    const token = Date.now().toString(36).toUpperCase().slice(-6);
    return `VISA-${tail}-${token}`;
  }

  private async nextBoletaNumber(): Promise<string> {
    const count = await this.paymentRepo.count();
    return `B001-${String(count + 1).padStart(8, '0')}`;
  }

  private parseBoletaNumber(numeroBoleta: string): { serie: string; correlativo: string } {
    const [serie = 'B001', correlativo = '00000000'] = numeroBoleta.split('-');
    return { serie, correlativo };
  }

  private async ensurePaymentBoletas(): Promise<void> {
    const payments = await this.paymentRepo.find();
    let seq = payments.filter((p) => p.numeroBoleta).length;
    for (const payment of payments) {
      if (payment.numeroBoleta) continue;
      seq += 1;
      payment.numeroBoleta = `B001-${String(seq).padStart(8, '0')}`;
      await this.paymentRepo.save(payment);
    }
  }

  private async getInstitutionInfo() {
    const institution = await this.institutionRepo.find({ take: 1, order: { id: 'ASC' } });
    const inst = institution[0];
    return {
      nombre: inst?.nombre ?? 'Institución Educativa Escolar',
      siglas: inst?.siglas ?? 'IE Escolar',
      ruc: inst?.ruc ?? '20512345678',
      codigoModular: inst?.codigoModular ?? '1234567',
      direccion: inst?.direccion ?? 'Av. Educación 123, Lima',
    };
  }
}
