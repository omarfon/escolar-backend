import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import type { ExportFormat } from './enrollment-reports.constants';
import {
  buildCsv,
  isGroupHeaderRow,
  type EvaluationReportResponse,
} from '../evaluation-reports/evaluation-reports.util';

@Injectable()
export class EnrollmentReportsExportService {
  async buildBuffer(
    report: EvaluationReportResponse,
    format: ExportFormat,
  ): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
    switch (format) {
      case 'csv':
        return this.buildCsv(report);
      case 'xlsx':
        return this.buildXlsx(report);
      case 'pdf':
        return await this.buildPdf(report);
      default:
        return this.buildCsv(report);
    }
  }

  private buildCsv(report: EvaluationReportResponse) {
    const csv = buildCsv(report.columns, report.items);
    return {
      buffer: Buffer.from(`\uFEFF${csv}`, 'utf-8'),
      mimeType: 'text/csv; charset=utf-8',
      extension: 'csv',
    };
  }

  private buildXlsx(report: EvaluationReportResponse) {
    const header = report.columns.map((c) => c.label);
    const data = report.items.map((row) => {
      if (isGroupHeaderRow(row)) {
        return [row.tituloGrupo ?? row.estudiante ?? 'Grupo'];
      }
      return report.columns.map((c) => row[c.key] ?? '');
    });
    const sheet = XLSX.utils.aoa_to_sheet([header, ...data]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Matricula');
    const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    return {
      buffer,
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
    };
  }

  private async buildPdf(report: EvaluationReportResponse) {
    const buffer = await this.renderPdf(report.meta, report.columns, report.items);
    return { buffer, mimeType: 'application/pdf', extension: 'pdf' };
  }

  private renderPdf(
    meta: EvaluationReportResponse['meta'],
    columns: EvaluationReportResponse['columns'],
    rows: EvaluationReportResponse['items'],
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 36, layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const renderHeader = () => {
        doc.fontSize(14).font('Helvetica-Bold').text('Reporte de matrícula', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(9).font('Helvetica');
        const alcance = meta.alcance?.label ?? meta.institucion.nombre;
        doc.text(
          [
            alcance,
            meta.institucion.dre ? `DRE ${meta.institucion.dre}` : '',
            meta.institucion.ugel ? `UGEL ${meta.institucion.ugel}` : '',
            `Año ${meta.anioEscolar}`,
            meta.bimestre ? `Periodo ${meta.bimestre}` : '',
          ]
            .filter(Boolean)
            .join(' · '),
          { align: 'center' },
        );
        doc.text(
          `Fecha de corte: ${meta.fechaCorte} · Fuente: ${meta.fuente} · ${rows.length} fila(s)`,
          { align: 'center' },
        );
        doc.moveDown(0.6);
      };

      const colWidth = (doc.page.width - 72) / Math.max(columns.length, 1);
      const rowHeight = 12;
      const bottomLimit = doc.page.height - 40;
      const tableWidth = doc.page.width - 72;

      const renderTableHeader = (y: number): number => {
        doc.font('Helvetica-Bold').fontSize(7);
        columns.forEach((col, i) => {
          doc.text(col.label, 36 + i * colWidth, y, {
            width: colWidth - 4,
            lineBreak: false,
          });
        });
        return y + 14;
      };

      renderHeader();
      let y = renderTableHeader(doc.y);
      doc.font('Helvetica').fontSize(7);

      for (const row of rows) {
        if (y + rowHeight > bottomLimit) {
          doc.addPage({ layout: 'landscape' });
          renderHeader();
          y = renderTableHeader(36);
          doc.font('Helvetica').fontSize(7);
        }

        if (isGroupHeaderRow(row)) {
          const title = String(row.tituloGrupo ?? row.estudiante ?? 'Grupo');
          doc.rect(36, y - 1, tableWidth, rowHeight + 2).fill('#EEF2FF');
          doc.fillColor('#312E81').font('Helvetica-Bold').fontSize(8);
          doc.text(title, 40, y, { width: tableWidth - 8, lineBreak: false });
          doc.fillColor('#000000').font('Helvetica').fontSize(7);
          y += rowHeight + 2;
          continue;
        }

        columns.forEach((col, i) => {
          const val = row[col.key] == null ? '' : String(row[col.key]);
          doc.text(val.slice(0, 36), 36 + i * colWidth, y, {
            width: colWidth - 4,
            lineBreak: false,
          });
        });
        y += rowHeight;
      }

      doc.end();
    });
  }
}
