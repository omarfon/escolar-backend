import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import type { ExportFormat } from './territorial-reports.constants';
import {
  buildCsv,
  type EvaluationReportResponse,
} from '../evaluation-reports/evaluation-reports.util';

@Injectable()
export class TerritorialReportsExportService {
  async buildBuffer(
    report: EvaluationReportResponse,
    format: ExportFormat,
  ): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
    switch (format) {
      case 'xlsx':
        return this.buildXlsx(report);
      case 'pdf':
        return this.buildPdf(report);
      case 'csv':
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
    const data = report.items.map((row) =>
      report.columns.map((col) => row[col.key] ?? ''),
    );
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    return {
      buffer,
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
    };
  }

  private async buildPdf(report: EvaluationReportResponse) {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    doc.fontSize(14).text('Reporte territorial UGEL/DRE', { align: 'center' });
    doc.moveDown();
    doc.fontSize(9).text(`Fuente: ${report.meta.fuente}`);
    doc.text(`Fecha de corte: ${report.meta.fechaCorte}`);
    doc.moveDown();

    const colWidth = (doc.page.width - 80) / report.columns.length;
    let y = doc.y;
    report.columns.forEach((col, i) => {
      doc.text(String(col.label), 40 + i * colWidth, y, {
        width: colWidth,
        ellipsis: true,
      });
    });
    y += 14;
    for (const row of report.items.slice(0, 200)) {
      report.columns.forEach((col, i) => {
        doc.text(String(row[col.key] ?? ''), 40 + i * colWidth, y, {
          width: colWidth,
          ellipsis: true,
        });
      });
      y += 12;
      if (y > doc.page.height - 50) {
        doc.addPage();
        y = 40;
      }
    }

    doc.end();
    await new Promise<void>((resolve) => doc.on('end', () => resolve()));
    return {
      buffer: Buffer.concat(chunks),
      mimeType: 'application/pdf',
      extension: 'pdf',
    };
  }
}
