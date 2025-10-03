import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { AuditEvent, StreamNames } from './types';

@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);

  constructor(private readonly redisService: RedisService) {}

  async publishEvent(event: AuditEvent): Promise<void> {
    try {
      const enrichedEvent = {
        ...event,
        serviceId: 'service-a',
        timestamp: event.timestamp || new Date(),
      };

      const messageId = await this.redisService.xAddMessage(
        StreamNames.PLATFORM_AUDIT_LOGS,
        enrichedEvent,
      );

      if (messageId) {
        this.logger.debug(`Event published: ${event.eventType} [${messageId}]`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to publish event: ${error.message}`,
        error.stack,
      );
    }
  }
}
