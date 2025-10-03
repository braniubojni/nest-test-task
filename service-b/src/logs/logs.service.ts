import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QueryLogsDto } from './dto/query-logs.dto';
import { AuditLog } from './schemas/audit-log.schema';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StreamGroupNames, StreamNames } from '../shared/services/types';
import { RedisService } from '../shared/services/redis.service';
import {
  LogsPaginationResult,
  LogsStatistics,
  TimeSeriesData,
  RedisMessage,
} from './types';

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);
  private isConsuming = false;

  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLog>,
    private readonly redisService: RedisService,
  ) {
    // Start consuming immediately
    this.startEventConsumer();
  }

  private async startEventConsumer() {
    this.logger.log('🔄 Starting event consumer...');
    this.consumeEvents();
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  private async consumeEvents() {
    if (this.isConsuming) return;

    this.isConsuming = true;

    try {
      const messages = await this.redisService.xReadMessages(
        StreamNames.PLATFORM_AUDIT_LOGS,
        StreamGroupNames.PLATFORM_AUDIT_LOGS_GROUP,
        10,
      );

      for (const message of messages) {
        try {
          await this.processMessage(message);

          // Acknowledge the message
          await this.redisService.xAck(
            StreamNames.PLATFORM_AUDIT_LOGS,
            StreamGroupNames.PLATFORM_AUDIT_LOGS_GROUP,
            message.id,
          );

          // Optionally delete after processing
          await this.redisService.xDel(
            StreamNames.PLATFORM_AUDIT_LOGS,
            message.id,
          );
        } catch (error) {
          this.logger.error(
            `Failed to process message ${message.id}: ${error.message}`,
          );
        }
      }

      if (messages.length > 0) {
        this.logger.log(`Processed ${messages.length} messages`);
      }
    } catch (error) {
      this.logger.error(`Event consumer error: ${error.message}`);
    } finally {
      this.isConsuming = false;
    }
  }

  private async processMessage(message: RedisMessage): Promise<void> {
    const auditLog = new this.auditLogModel({
      ...message.data,
      messageId: message.id,
      processed: true,
    });

    await auditLog.save();
  }

  async queryLogs(queryDto: QueryLogsDto): Promise<LogsPaginationResult> {
    const {
      eventType,
      entityType,
      action,
      serviceId,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = queryDto;

    const filter: any = {};

    if (eventType) filter.eventType = eventType;
    if (entityType) filter.entityType = entityType;
    if (action) filter.action = action;
    if (serviceId) filter.serviceId = serviceId;

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.auditLogModel.countDocuments(filter),
    ]);

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStatistics(queryDto: QueryLogsDto): Promise<LogsStatistics> {
    interface AuditLogFilter {
      eventType?: string;
      entityType?: string;
      action?: string;
      serviceId?: string;
      timestamp?: {
        $gte?: Date;
        $lte?: Date;
      };
    }

    const filter: AuditLogFilter = {};

    if (queryDto.startDate || queryDto.endDate) {
      filter.timestamp = {};
      if (queryDto.startDate)
        filter.timestamp.$gte = new Date(queryDto.startDate);
      if (queryDto.endDate) filter.timestamp.$lte = new Date(queryDto.endDate);
    }

    const [totalLogs, eventTypeStats, actionStats, serviceStats] =
      await Promise.all([
        this.auditLogModel.countDocuments(filter),
        this.auditLogModel.aggregate([
          { $match: filter },
          { $group: { _id: '$eventType', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        this.auditLogModel.aggregate([
          { $match: filter },
          { $group: { _id: '$action', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        this.auditLogModel.aggregate([
          { $match: filter },
          { $group: { _id: '$serviceId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
      ]);

    return {
      totalLogs,
      byEventType: eventTypeStats.map((s) => ({ type: s._id, count: s.count })),
      byAction: actionStats.map((s) => ({ action: s._id, count: s.count })),
      byService: serviceStats.map((s) => ({ service: s._id, count: s.count })),
    };
  }

  async findOne(id: string): Promise<AuditLog> {
    const log = await this.auditLogModel.findById(id);
    if (!log) {
      throw new NotFoundException(`Log with ID ${id} not found`);
    }
    return log;
  }

  async getTimeSeriesData(
    startDate: Date,
    endDate: Date,
    interval: string = 'hour',
  ): Promise<TimeSeriesData> {
    const groupBy =
      interval === 'day'
        ? { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
        : {
            $dateToString: { format: '%Y-%m-%dT%H:00:00', date: '$timestamp' },
          };

    return this.auditLogModel.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            time: groupBy,
            eventType: '$eventType',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.time': 1 } },
    ]);
  }
}
