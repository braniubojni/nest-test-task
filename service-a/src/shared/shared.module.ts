import { Module } from '@nestjs/common';
import { RedisService } from './services/redis.service';
import { EventPublisherService } from './services/event-publisher.service';

@Module({
  providers: [RedisService, EventPublisherService],
  exports: [RedisService, EventPublisherService],
})
export class SharedModule {}
