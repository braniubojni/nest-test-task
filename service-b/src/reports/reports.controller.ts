import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GenerateReportDto } from './dto/generate-report.dto';
import { ReportsService } from './reports.service';
import type { Response } from 'express';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate PDF report from time series data' })
  @ApiResponse({ status: 201, description: 'Report generated successfully' })
  async generateReport(@Body() generateDto: GenerateReportDto) {
    return this.reportsService.generateReport(generateDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all generated reports' })
  async listReports() {
    return this.reportsService.listReports();
  }

  @Get(':filename/download')
  @ApiOperation({ summary: 'Download a generated report' })
  async downloadReport(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    try {
      const filePath = await this.reportsService.getReportPath(filename);
      res.download(filePath, filename);
    } catch (error) {
      res.status(HttpStatus.NOT_FOUND).json({ message: 'Report not found' });
    }
  }
}
