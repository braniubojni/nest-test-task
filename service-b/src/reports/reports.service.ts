import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LogsService } from '../logs/logs.service';
import { AuditLog } from '../logs/schemas/audit-log.schema';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { GenerateReportDto } from './dto/generate-report.dto';
import { PDFReportData } from './types';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly reportsDir = './reports';
  private readonly chartCanvas: ChartJSNodeCanvas;

  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLog>,
    private readonly logsService: LogsService,
  ) {
    this.chartCanvas = new ChartJSNodeCanvas({ width: 800, height: 400 });
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    try {
      await fs.mkdir(this.reportsDir, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create reports directory: ${error.message}`);
    }
  }

  async generateReport(generateDto: GenerateReportDto) {
    this.logger.log('Generating PDF report...');

    const startDate = new Date(generateDto.startDate);
    const endDate = new Date(generateDto.endDate);

    // Fetch time series data
    const timeSeriesData = await this.logsService.getTimeSeriesData(
      startDate,
      endDate,
      generateDto.interval,
    );

    // Fetch statistics
    const stats = await this.logsService.getStatistics({
      startDate: generateDto.startDate,
      endDate: generateDto.endDate,
    });

    // Generate filename
    const timestamp = Date.now();
    const filename = `audit-report-${timestamp}.pdf`;
    const filePath = path.join(this.reportsDir, filename);

    // Create PDF
    await this.createPDF(filePath, {
      title: generateDto.title || 'Audit Log Report',
      startDate,
      endDate,
      timeSeriesData,
      stats,
    });

    this.logger.log(`Report generated: ${filename}`);

    return {
      success: true,
      filename,
      downloadUrl: `/reports/${filename}/download`,
      generatedAt: new Date(),
    };
  }

  private async createPDF(filePath: string, data: PDFReportData) {
    return new Promise<void>(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const stream = doc.pipe(fsSync.createWriteStream(filePath));

        // Title
        doc
          .fontSize(24)
          .font('Helvetica-Bold')
          .text(data.title, { align: 'center' });
        doc.moveDown();

        // Date range
        doc
          .fontSize(12)
          .font('Helvetica')
          .text(
            `Report Period: ${data.startDate.toLocaleDateString()} - ${data.endDate.toLocaleDateString()}`,
            {
              align: 'center',
            },
          );
        doc.moveDown(2);

        // Summary Statistics
        doc.fontSize(18).font('Helvetica-Bold').text('Summary Statistics');
        doc.moveDown();

        doc.fontSize(12).font('Helvetica');
        doc.text(`Total Events: ${data.stats.totalLogs}`);
        doc.moveDown();

        // Event Type Breakdown
        doc.fontSize(14).font('Helvetica-Bold').text('Events by Type:');
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica');

        for (const item of data.stats.byEventType.slice(0, 10)) {
          doc.text(`  • ${item.type}: ${item.count} events`);
        }
        doc.moveDown();

        // Action Breakdown
        doc.fontSize(14).font('Helvetica-Bold').text('Events by Action:');
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica');

        for (const item of data.stats.byAction) {
          doc.text(`  • ${item.action}: ${item.count} events`);
        }
        doc.moveDown();

        // Service Breakdown
        doc.fontSize(14).font('Helvetica-Bold').text('Events by Service:');
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica');

        for (const item of data.stats.byService) {
          doc.text(`  • ${item.service}: ${item.count} events`);
        }
        doc.moveDown(2);

        // Generate and add chart
        if (data.timeSeriesData.length > 0) {
          doc.addPage();
          doc.fontSize(18).font('Helvetica-Bold').text('Time Series Analysis');
          doc.moveDown();

          const chartImage = await this.generateChart(data.timeSeriesData);
          doc.image(chartImage, 50, doc.y, { width: 500 });
          doc.moveDown(15);
        }

        // Add details table
        doc.addPage();
        doc
          .fontSize(18)
          .font('Helvetica-Bold')
          .text('Detailed Time Series Data');
        doc.moveDown();

        // Table headers
        doc.fontSize(10).font('Helvetica-Bold');
        const tableTop = doc.y;
        doc.text('Time', 50, tableTop);
        doc.text('Event Type', 200, tableTop);
        doc.text('Count', 450, tableTop);
        doc.moveDown();

        // Table rows
        doc.fontSize(9).font('Helvetica');
        let y = doc.y;

        for (const item of data.timeSeriesData.slice(0, 30)) {
          if (y > 700) {
            doc.addPage();
            y = 50;
          }

          doc.text(item._id.time, 50, y);
          doc.text(item._id.eventType, 200, y);
          doc.text(item.count.toString(), 450, y);
          y += 20;
        }

        // Footer
        const pages = doc.bufferedPageRange();
        for (let i = pages.start; i < pages.start + pages.count; i++) {
          doc.switchToPage(i);
          doc
            .fontSize(8)
            .text(
              `Page ${i - pages.start + 1} of ${pages.count} | Generated: ${new Date().toLocaleString()}`,
              50,
              doc.page.height - 50,
              { align: 'center' },
            );
        }

        doc.end();

        stream.on('finish', () => resolve());
        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  private async generateChart(timeSeriesData: any[]): Promise<Buffer> {
    // Prepare data for chart
    const eventTypes = [...new Set(timeSeriesData.map((d) => d._id.eventType))];
    const times = [...new Set(timeSeriesData.map((d) => d._id.time))].sort();

    const datasets = eventTypes.map((eventType, index) => {
      const data = times.map((time) => {
        const item = timeSeriesData.find(
          (d) => d._id.time === time && d._id.eventType === eventType,
        );
        return item ? item.count : 0;
      });

      return {
        label: eventType,
        data,
        borderColor: this.getColor(index),
        backgroundColor: this.getColor(index, 0.1),
        borderWidth: 2,
        fill: true,
      };
    });

    const configuration = {
      type: 'line',
      data: {
        labels: times,
        datasets,
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Events Over Time',
            font: { size: 16 },
          },
          legend: {
            display: true,
            position: 'bottom',
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Event Count',
            },
          },
          x: {
            title: {
              display: true,
              text: 'Time',
            },
          },
        },
      },
    };

    return await this.chartCanvas.renderToBuffer(configuration as any);
  }

  private getColor(index: number, alpha: number = 1): string {
    const colors = [
      `rgba(54, 162, 235, ${alpha})`,
      `rgba(255, 99, 132, ${alpha})`,
      `rgba(75, 192, 192, ${alpha})`,
      `rgba(255, 206, 86, ${alpha})`,
      `rgba(153, 102, 255, ${alpha})`,
      `rgba(255, 159, 64, ${alpha})`,
    ];
    return colors[index % colors.length];
  }

  async listReports() {
    try {
      const files = await fs.readdir(this.reportsDir);
      const reports = await Promise.all(
        files
          .filter((f) => f.endsWith('.pdf'))
          .map(async (file) => {
            const stats = await fs.stat(path.join(this.reportsDir, file));
            return {
              filename: file,
              size: stats.size,
              created: stats.birthtime,
              downloadUrl: `/reports/${file}/download`,
            };
          }),
      );

      return {
        reports: reports.sort(
          (a, b) => b.created.getTime() - a.created.getTime(),
        ),
        count: reports.length,
      };
    } catch (error) {
      this.logger.error(`Failed to list reports: ${error.message}`);
      return { reports: [], count: 0 };
    }
  }

  async getReportPath(filename: string): Promise<string> {
    const filePath = path.join(this.reportsDir, filename);

    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      throw new NotFoundException('Report not found');
    }
  }
}
