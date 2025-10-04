import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID as uuidv4 } from 'node:crypto';
import Redis from 'ioredis';
import { delay } from '../../common/utils';
import { StreamGroupNames, StreamNames } from './types';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleInit {
  private readonly redisClient: Redis;
  private isRedisClientConnected = false;
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly configService: ConfigService) {
    this.redisClient = new Redis({
      host: this.configService.get('REDIS_HOST') || 'localhost',
      port: parseInt(this.configService.get('REDIS_PORT') || '6379'),
      retryStrategy: (times) => {
        if (times <= 3) {
          this.logger.log(`Retrying Redis connection, attempt ${times}`);
          return 2000;
        }
        return null;
      },
    });

    this.redisClient.on('connect', () => {
      this.logger.log('🚀 Redis successfully connected.');
      this.isRedisClientConnected = true;
    });

    this.redisClient.on('error', (error: Error) => {
      this.logger.error('Unable to connect to Redis.', error.message);
      this.isRedisClientConnected = false;
    });
  }

  async onModuleInit() {
    // Ensure consumer group exists
    await this.ensureStreamGroup(
      StreamNames.PLATFORM_AUDIT_LOGS,
      StreamGroupNames.PLATFORM_AUDIT_LOGS_GROUP,
    );
  }

  async xAddMessage(
    stream: string,
    message: Record<string, any>,
  ): Promise<string> {
    try {
      if (!this.isRedisClientConnected) {
        this.logger.warn('Redis not connected, skipping message');
        return '';
      }

      const result = await this.redisClient.xadd(
        stream,
        '*',
        'data',
        JSON.stringify(message),
      );
      return result || '';
    } catch (error) {
      this.logger.error(
        `Failed to add message to stream ${stream}: ${error.message}`,
      );
      return '';
    }
  }

  async xReadMessages(
    streamName: string,
    groupName: string,
    count = 10,
  ): Promise<any[]> {
    try {
      if (!this.isRedisClientConnected) return [];

      const consumerName = uuidv4();
      const messages = await this.redisClient.xreadgroup(
        'GROUP',
        groupName,
        consumerName,
        'COUNT',
        count.toString(),
        'STREAMS',
        streamName,
        '>',
      );

      if (messages && messages.length > 0) {
        return (messages as any)[0][1].map(
          ([id, fields]: [string, string[]]) => ({
            id,
            data: JSON.parse(fields[1]),
          }),
        );
      }
    } catch (error) {
      if (error.message.includes('NOGROUP')) {
        await this.ensureStreamGroup(streamName, groupName);
        return [];
      }
      this.logger.error(
        `Failed to read messages from stream ${streamName}: ${error.message}`,
      );
    }
    return [];
  }

  async xAck(
    streamName: string,
    groupName: string,
    messageId: string,
  ): Promise<boolean> {
    try {
      if (!this.isRedisClientConnected) return false;
      const result = await this.redisClient.xack(
        streamName,
        groupName,
        messageId,
      );
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Failed to acknowledge message ${messageId}: ${error.message}`,
      );
      return false;
    }
  }

  async xDel(stream: string, messageId: string): Promise<boolean> {
    if (!this.isRedisClientConnected) return false;

    for (let i = 0; i < 5; i++) {
      try {
        if (i > 0) await delay(2000);
        const result = await this.redisClient.xdel(stream, messageId);
        if (result === 1) return true;
      } catch (error) {
        this.logger.error(
          `Failed to delete message ${messageId} from stream ${stream}: ${error.message}`,
        );
      }
    }
    return false;
  }

  private async ensureStreamGroup(
    streamName: string,
    groupName: string,
  ): Promise<void> {
    try {
      const exists = await this.groupExists(streamName, groupName);
      if (!exists) {
        await this.redisClient.xgroup(
          'CREATE',
          streamName,
          groupName,
          '$',
          'MKSTREAM',
        );
        this.logger.log(
          `Created consumer group ${groupName} for stream ${streamName}`,
        );
      }
    } catch (error) {
      if (!error.message.includes('BUSYGROUP')) {
        this.logger.error(`Failed to create consumer group: ${error.message}`);
      }
    }
  }

  private async groupExists(
    streamName: string,
    groupName: string,
  ): Promise<boolean> {
    try {
      const groups = (await this.redisClient.xinfo(
        'GROUPS',
        streamName,
      )) as any[];
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        if (group[1] === groupName) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  getClient(): Redis {
    return this.redisClient;
  }
}
