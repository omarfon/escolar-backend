import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { LibretaDto } from './report-cards.service';

@Injectable()
export class ReportCardsPdfService {
  buildSingle(libreta: LibretaDto, institucion: InstitucionPdfInfo): Promise<Buffer> {
    return this.buildDocument([libreta], institucion);
  }

  buildSalon(libretas: LibretaDto[], institucion: InstitucionPdfInfo): Promise<Buffer> {
    return this.buildDocument(libretas, institucion);
  }

  private buildDocument(
    libretas: LibretaDto[],
    inst: InstitucionPdfInfo,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      libretas.forEach((lib, idx) => {
        if (idx > 0) doc.addPage();
        this.renderLibreta(doc, lib, inst);
      });

      doc.end();
    });
  }

  private renderLibreta(
    doc: PDFKit.PDFDocument,
    lib: LibretaDto,
    inst: InstitucionPdfInfo,
  ): void {
    const headerY = 40;
    const headerH = 88;
    doc.fillColor('#312e81').rect(40, headerY, 515, headerH).fill();

    doc.fillColor('#ffffff').fontSize(13).font('Helvetica-Bold');
    const titulo = inst.siglas
      ? `${inst.nombre} (${inst.siglas})`
      : inst.nombre || 'Institución Educativa';
    doc.text(titulo, 55, headerY + 10, { width: 360 });

    doc.fontSize(8).font('Helvetica');
    const linea2 = [
      inst.codigoModular ? `Cód. Modular: ${inst.codigoModular}` : '',
      inst.ruc ? `RUC: ${inst.ruc}` : '',
      inst.tipoGestion ? this.capitalize(inst.tipoGestion) : '',
    ]
      .filter(Boolean)
      .join(' · ');
    if (linea2) doc.text(linea2, 55, headerY + 28, { width: 360 });

    const linea3 = [
      inst.ugel ? `UGEL ${inst.ugel}` : '',
      inst.dre ? `DRE ${inst.dre}` : '',
      [inst.distrito, inst.provincia].filter(Boolean).join(', '),
    ]
      .filter(Boolean)
      .join(' · ');
    if (linea3) doc.text(linea3, 55, headerY + 40, { width: 360 });

    if (inst.direccion) {
      doc.text(inst.direccion, 55, headerY + 52, { width: 360 });
    }

    const linea5 = [
      inst.resolucion ? `RVM ${inst.resolucion}` : '',
      `Año Lectivo ${inst.anioLectivo}`,
      `Nivel ${lib.nivel}`,
      `${lib.bimestre}° Bimestre`,
    ]
      .filter(Boolean)
      .join(' · ');
    doc.text(linea5, 55, headerY + (inst.direccion ? 64 : 52), { width: 360 });

    doc.fontSize(22).font('Helvetica-Bold');
    doc.text(`B${lib.bimestre}`, 480, headerY + 28, { width: 60, align: 'right' });

    doc.fillColor('#111827').fontSize(11).font('Helvetica-Bold');
    let y = headerY + headerH + 18;
    doc.text(`Alumno(a): ${lib.alumno}`, 40, y);
    doc.text(`Grado: ${lib.grado} "${lib.seccion}"`, 320, y);
    y += 20;
    doc.font('Helvetica');
    doc.text(`Estado: ${this.estadoLabel(lib.estado)}`, 40, y);
    if (lib.promedioGlobal) {
      doc.text(`Promedio B${lib.bimestre}: ${lib.promedioGlobal}`, 320, y);
    }
    y += 28;

    for (const area of lib.areas) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e3a8a');
      doc.text(`${area.emoji} ${area.nombre}`, 40, y);
      y += 14;

      doc.font('Helvetica-Bold').fontSize(7).fillColor('#6b7280');
      doc.text('Competencia', 48, y, { width: 300 });
      let colX = 360;
      const colW = Math.min(36, Math.floor(150 / Math.max(lib.bimestresVisibles.length, 1)));
      for (const b of lib.bimestresVisibles) {
        doc.text(`B${b}`, colX, y, { width: colW, align: 'center' });
        colX += colW;
      }
      y += 12;

      doc.font('Helvetica').fontSize(8).fillColor('#374151');
      for (const c of area.competencias) {
        if (y > 720) {
          doc.addPage();
          y = 40;
        }
        doc.text(c.codigo, 48, y, { width: 36 });
        doc.text(c.nombre, 88, y, { width: 260 });
        colX = 360;
        for (const b of lib.bimestresVisibles) {
          const nivel = c.niveles[b] ?? '–';
          doc.text(nivel, colX, y, { width: colW, align: 'center' });
          colX += colW;
        }
        y += 14;
      }

      if (y > 720) {
        doc.addPage();
        y = 40;
      }
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#1e3a8a');
      doc.text('Promedio área', 48, y, { width: 260 });
      colX = 360;
      for (const b of lib.bimestresVisibles) {
        const prom = area.promediosPorBimestre[b] ?? '–';
        doc.text(prom, colX, y, { width: colW, align: 'center' });
        colX += colW;
      }
      y += 16;
    }

    if (lib.bimestresVisibles.length) {
      if (y > 700) {
        doc.addPage();
        y = 40;
      }
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#111827');
      doc.text('Promedio general:', 40, y);
      let colX = 120;
      const colW = 36;
      for (const b of lib.bimestresVisibles) {
        const prom = lib.promediosPorBimestre[b] ?? '–';
        doc.text(`B${b}: ${prom}`, colX, y, { width: 50 });
        colX += 54;
      }
      y += 20;
    }

    if (lib.observaciones) {
      if (y > 680) {
        doc.addPage();
        y = 40;
      }
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827');
      doc.text('Observaciones:', 40, y);
      y += 12;
      doc.font('Helvetica').fontSize(9).text(lib.observaciones, 40, y, { width: 515 });
      y += 40;
    }

    if (y > 650) {
      doc.addPage();
      y = 40;
    }

    y = Math.max(y + 10, 640);
    doc.fontSize(8).fillColor('#6b7280');
    this.renderFirma(doc, lib.firmaDirector, 40, y);
    this.renderFirma(doc, lib.firmaTutor, 300, y);

    if (inst.telefono || inst.email) {
      doc.fontSize(7).fillColor('#9ca3af');
      const contacto = [inst.telefono, inst.email].filter(Boolean).join(' · ');
      doc.text(contacto, 40, 780, { width: 515, align: 'center' });
    }
  }

  private renderFirma(
    doc: PDFKit.PDFDocument,
    firma: LibretaDto['firmaDirector'],
    x: number,
    y: number,
  ): void {
    doc.moveTo(x, y + 40).lineTo(x + 180, y + 40).stroke('#9ca3af');
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9);
    doc.text(firma.nombre || '—', x, y + 44, { width: 180 });
    doc.font('Helvetica').fontSize(8).fillColor('#6b7280');
    doc.text(firma.cargo, x, y + 56, { width: 180 });
    if (firma.firmado && firma.fechaFirma) {
      doc.text(`Firmado: ${firma.fechaFirma}`, x, y + 68, { width: 180 });
    }
  }

  private estadoLabel(estado: string): string {
    if (estado === 'firmada') return 'Firmada';
    if (estado === 'generada') return 'Generada';
    return 'Pendiente';
  }

  private capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}

export interface InstitucionPdfInfo {
  nombre: string;
  siglas: string;
  codigoModular: string;
  ruc: string;
  tipoGestion: string;
  ugel: string;
  dre: string;
  resolucion: string;
  direccion: string;
  distrito: string;
  provincia: string;
  region: string;
  telefono: string;
  email: string;
  director: string;
  subdirector: string;
  anioLectivo: string;
  tipoPeriodo: string;
}
