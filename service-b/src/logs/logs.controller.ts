import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { QueryLogsDto } from './dto/query-logs.dto';
import { LogsService } from './logs.service';
import { LogsPaginationResult } from './types';

@ApiTags('logs')
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  @ApiOperation({ summary: 'Query audit logs with filters' })
  @ApiResponse({ status: 200, description: 'Logs retrieved successfully' })
  async queryLogs(
    @Query() queryDto: QueryLogsDto,
  ): Promise<LogsPaginationResult> {
    return this.logsService.queryLogs(queryDto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get log statistics' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  async getStats(@Query() queryDto: QueryLogsDto) {
    return this.logsService.getStatistics(queryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get log by ID' })
  async findOne(@Param('id') id: string) {
    return this.logsService.findOne(id);
  }
}
