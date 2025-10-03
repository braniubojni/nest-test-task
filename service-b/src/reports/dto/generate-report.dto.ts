import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ReportInterval } from '../types';

export class GenerateReportDto {
  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2024-12-31' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ example: 'day', enum: ReportInterval })
  @IsOptional()
  @IsEnum(ReportInterval)
  interval?: ReportInterval = ReportInterval.DAY;

  @ApiPropertyOptional({ example: 'Audit Log Report' })
  @IsOptional()
  @IsString()
  title?: string = 'Audit Log Report';
}
