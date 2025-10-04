import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { StreamGroupNames, StreamNames } from './types';
import { randomUUID as uuidv4 } from 'node:crypto';
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
    await this.ensureStreamGroup(
      StreamNames.PLATFORM_AUDIT_LOGS,
      StreamGroupNames.PLATFORM_AUDIT_LOGS_GROUP,
    );
  }

  async xReadMessages(
    streamName: string,
    groupName: string,
    count = 10,
  ): Promise<any[]> {
    try {
      if (!this.isRedisClientConnected) return [];

      const consumerName = uuidv4();
      const messages = (await this.redisClient.xreadgroup(
        'GROUP',
        groupName,
        consumerName,
        'COUNT',
        count.toString(),
        'STREAMS',
        streamName,
        '>',
      )) as [string, [string, string[]][]][] | null;

      if (messages && messages.length > 0) {
        // Convert the raw Redis response to a more readable structure
        const [stream, entries] = messages[0];
        return entries.map(([id, fields]) => ({
          id,
          data: JSON.parse(fields[1]),
        }));
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
    try {
      const result = await this.redisClient.xdel(stream, messageId);
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Failed to delete message ${messageId}: ${error.message}`,
      );
      return false;
    }
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
        if (group[1] === groupName) return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
