import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import { LogsService } from './logs.service';
import { AuditLog } from './schemas/audit-log.schema';
import { RedisService } from '../shared/services/redis.service';
import { QueryLogsDto } from './dto/query-logs.dto';
import { LogsPaginationResult, LogsStatistics, RedisMessage } from './types';

describe('LogsService', () => {
  let service: LogsService;
  let model: Model<AuditLog>;
  let redisService: RedisService;

  const mockAuditLog = {
    _id: '507f1f77bcf86cd799439011',
    eventType: 'PRODUCT_CREATED',
    entityId: 'product-123',
    entityType: 'Product',
    action: 'CREATE',
    data: { name: 'Test Product', price: 100 },
    timestamp: new Date('2024-01-15T10:00:00Z'),
    serviceId: 'service-a',
    userId: 'user-123',
    messageId: 'msg-123',
    processed: true,
  };

  const mockAuditLogModel = {
    new: jest.fn().mockResolvedValue(mockAuditLog),
    constructor: jest.fn().mockResolvedValue(mockAuditLog),
    find: jest.fn(),
    findById: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    create: jest.fn(),
    exec: jest.fn(),
    save: jest.fn(),
  };

  const mockRedisService = {
    xReadMessages: jest.fn().mockResolvedValue([]), // Return empty array by default
    xAck: jest.fn(),
    xDel: jest.fn(),
  };

  beforeEach(async () => {
    // Reset mocks before creating the module
    jest.clearAllMocks();
    mockRedisService.xReadMessages.mockResolvedValue([]); // Prevent constructor issues

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogsService,
        {
          provide: getModelToken(AuditLog.name),
          useValue: mockAuditLogModel,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<LogsService>(LogsService);
    model = module.get<Model<AuditLog>>(getModelToken(AuditLog.name));
    redisService = module.get<RedisService>(RedisService);

    // Clear all mocks after module creation
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('queryLogs', () => {
    it('should return paginated logs with default pagination', async () => {
      const queryDto: QueryLogsDto = {};
      const mockLogs = [mockAuditLog];
      const mockTotal = 1;

      const findChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockLogs),
      };

      mockAuditLogModel.find.mockReturnValue(findChain);
      mockAuditLogModel.countDocuments.mockResolvedValue(mockTotal);

      const result: LogsPaginationResult = await service.queryLogs(queryDto);

      expect(result).toEqual({
        data: mockLogs,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      });
      expect(mockAuditLogModel.find).toHaveBeenCalledWith({});
      expect(findChain.sort).toHaveBeenCalledWith({ timestamp: -1 });
      expect(findChain.skip).toHaveBeenCalledWith(0);
      expect(findChain.limit).toHaveBeenCalledWith(20);
    });

    it('should filter logs by eventType', async () => {
      const queryDto: QueryLogsDto = { eventType: 'PRODUCT_CREATED' };
      const mockLogs = [mockAuditLog];

      const findChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockLogs),
      };

      mockAuditLogModel.find.mockReturnValue(findChain);
      mockAuditLogModel.countDocuments.mockResolvedValue(1);

      await service.queryLogs(queryDto);

      expect(mockAuditLogModel.find).toHaveBeenCalledWith({
        eventType: 'PRODUCT_CREATED',
      });
    });

    it('should filter logs by multiple parameters', async () => {
      const queryDto: QueryLogsDto = {
        eventType: 'PRODUCT_CREATED',
        entityType: 'Product',
        action: 'CREATE',
        serviceId: 'service-a',
      };

      const findChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockAuditLog]),
      };

      mockAuditLogModel.find.mockReturnValue(findChain);
      mockAuditLogModel.countDocuments.mockResolvedValue(1);

      await service.queryLogs(queryDto);

      expect(mockAuditLogModel.find).toHaveBeenCalledWith({
        eventType: 'PRODUCT_CREATED',
        entityType: 'Product',
        action: 'CREATE',
        serviceId: 'service-a',
      });
    });

    it('should filter logs by date range', async () => {
      const queryDto: QueryLogsDto = {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };

      const findChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockAuditLog]),
      };

      mockAuditLogModel.find.mockReturnValue(findChain);
      mockAuditLogModel.countDocuments.mockResolvedValue(1);

      await service.queryLogs(queryDto);

      expect(mockAuditLogModel.find).toHaveBeenCalledWith({
        timestamp: {
          $gte: new Date('2024-01-01'),
          $lte: new Date('2024-12-31'),
        },
      });
    });

    it('should handle custom pagination parameters', async () => {
      const queryDto: QueryLogsDto = {
        page: 2,
        limit: 10,
      };

      const findChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockAuditLog]),
      };

      mockAuditLogModel.find.mockReturnValue(findChain);
      mockAuditLogModel.countDocuments.mockResolvedValue(25);

      const result = await service.queryLogs(queryDto);

      expect(findChain.skip).toHaveBeenCalledWith(10); // (2-1) * 10
      expect(findChain.limit).toHaveBeenCalledWith(10);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
    });
  });

  describe('getStatistics', () => {
    it('should return statistics for all logs', async () => {
      const queryDto: QueryLogsDto = {};
      const mockEventTypeStats = [
        { _id: 'PRODUCT_CREATED', count: 10 },
        { _id: 'PRODUCT_UPDATED', count: 5 },
      ];
      const mockActionStats = [
        { _id: 'CREATE', count: 10 },
        { _id: 'UPDATE', count: 5 },
      ];
      const mockServiceStats = [
        { _id: 'service-a', count: 8 },
        { _id: 'service-b', count: 7 },
      ];

      mockAuditLogModel.countDocuments.mockResolvedValue(15);
      mockAuditLogModel.aggregate
        .mockResolvedValueOnce(mockEventTypeStats)
        .mockResolvedValueOnce(mockActionStats)
        .mockResolvedValueOnce(mockServiceStats);

      const result: LogsStatistics = await service.getStatistics(queryDto);

      expect(result).toEqual({
        totalLogs: 15,
        byEventType: [
          { type: 'PRODUCT_CREATED', count: 10 },
          { type: 'PRODUCT_UPDATED', count: 5 },
        ],
        byAction: [
          { action: 'CREATE', count: 10 },
          { action: 'UPDATE', count: 5 },
        ],
        byService: [
          { service: 'service-a', count: 8 },
          { service: 'service-b', count: 7 },
        ],
      });
    });

    it('should filter statistics by date range', async () => {
      const queryDto: QueryLogsDto = {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };

      mockAuditLogModel.countDocuments.mockResolvedValue(10);
      mockAuditLogModel.aggregate.mockResolvedValue([]);

      await service.getStatistics(queryDto);

      const expectedFilter = {
        timestamp: {
          $gte: new Date('2024-01-01'),
          $lte: new Date('2024-12-31'),
        },
      };

      expect(mockAuditLogModel.countDocuments).toHaveBeenCalledWith(
        expectedFilter,
      );
      expect(mockAuditLogModel.aggregate).toHaveBeenCalledWith([
        { $match: expectedFilter },
        { $group: { _id: '$eventType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
    });

    it('should handle empty statistics', async () => {
      const queryDto: QueryLogsDto = {};

      mockAuditLogModel.countDocuments.mockResolvedValue(0);
      mockAuditLogModel.aggregate.mockResolvedValue([]);

      const result = await service.getStatistics(queryDto);

      expect(result).toEqual({
        totalLogs: 0,
        byEventType: [],
        byAction: [],
        byService: [],
      });
    });
  });

  describe('findOne', () => {
    it('should return a log by id', async () => {
      const logId = '507f1f77bcf86cd799439011';
      mockAuditLogModel.findById.mockResolvedValue(mockAuditLog);

      const result = await service.findOne(logId);

      expect(result).toEqual(mockAuditLog);
      expect(mockAuditLogModel.findById).toHaveBeenCalledWith(logId);
    });

    it('should throw NotFoundException when log is not found', async () => {
      const logId = '507f1f77bcf86cd799439011';
      mockAuditLogModel.findById.mockResolvedValue(null);

      await expect(service.findOne(logId)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(logId)).rejects.toThrow(
        `Log with ID ${logId} not found`,
      );
    });
  });

  describe('getTimeSeriesData', () => {
    it('should return time series data with hourly interval', async () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-01T23:59:59Z');
      const mockTimeSeriesData = [
        {
          _id: { time: '2024-01-01T10:00:00', eventType: 'PRODUCT_CREATED' },
          count: 5,
        },
        {
          _id: { time: '2024-01-01T11:00:00', eventType: 'PRODUCT_UPDATED' },
          count: 3,
        },
      ];

      mockAuditLogModel.aggregate.mockResolvedValue(mockTimeSeriesData);

      const result = await service.getTimeSeriesData(
        startDate,
        endDate,
        'hour',
      );

      expect(result).toEqual(mockTimeSeriesData);
      expect(mockAuditLogModel.aggregate).toHaveBeenCalledWith([
        {
          $match: {
            timestamp: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              time: {
                $dateToString: {
                  format: '%Y-%m-%dT%H:00:00',
                  date: '$timestamp',
                },
              },
              eventType: '$eventType',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.time': 1 } },
      ]);
    });

    it('should return time series data with daily interval', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const mockTimeSeriesData = [
        {
          _id: { time: '2024-01-01', eventType: 'PRODUCT_CREATED' },
          count: 15,
        },
        {
          _id: { time: '2024-01-02', eventType: 'PRODUCT_UPDATED' },
          count: 10,
        },
      ];

      mockAuditLogModel.aggregate.mockResolvedValue(mockTimeSeriesData);

      const result = await service.getTimeSeriesData(startDate, endDate, 'day');

      expect(result).toEqual(mockTimeSeriesData);
      expect(mockAuditLogModel.aggregate).toHaveBeenCalledWith([
        {
          $match: {
            timestamp: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              time: {
                $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
              },
              eventType: '$eventType',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.time': 1 } },
      ]);
    });

    it('should default to hourly interval when not specified', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02');

      mockAuditLogModel.aggregate.mockResolvedValue([]);

      await service.getTimeSeriesData(startDate, endDate);

      const aggregateCall = mockAuditLogModel.aggregate.mock.calls[0][0];
      const groupStage = aggregateCall.find((stage: any) => stage.$group);

      expect(groupStage.$group._id.time.$dateToString.format).toBe(
        '%Y-%m-%dT%H:00:00',
      );
    });
  });

  describe('processMessage (private method)', () => {
    it('should process and save a message from Redis stream', async () => {
      const mockMessage: RedisMessage = {
        id: 'msg-456',
        data: {
          eventType: 'PRODUCT_UPDATED',
          entityId: 'product-456',
          entityType: 'Product',
          action: 'UPDATE',
          data: { name: 'Updated Product' },
          timestamp: new Date('2024-01-16T12:00:00Z'),
          serviceId: 'service-a',
          userId: 'user-456',
        },
      };

      const mockSave = jest.fn().mockResolvedValue(mockAuditLog);
      const mockAuditLogInstance = {
        ...mockMessage.data,
        messageId: mockMessage.id,
        processed: true,
        save: mockSave,
      };

      // Replace the model in the service with a constructor function
      (service as any).auditLogModel = jest.fn(() => mockAuditLogInstance);

      // Access the private method through bracket notation
      await (service as any).processMessage(mockMessage);

      expect(mockSave).toHaveBeenCalled();
      expect((service as any).auditLogModel).toHaveBeenCalledWith({
        ...mockMessage.data,
        messageId: mockMessage.id,
        processed: true,
      });
    });
  });

  describe('consumeEvents (private method with cron)', () => {
    it('should not process if already consuming', async () => {
      // Set the isConsuming flag to true
      (service as any).isConsuming = true;

      await (service as any).consumeEvents();

      expect(mockRedisService.xReadMessages).not.toHaveBeenCalled();
    });

    it('should process messages from Redis stream', async () => {
      const mockMessages: RedisMessage[] = [
        {
          id: 'msg-1',
          data: {
            eventType: 'PRODUCT_CREATED',
            entityId: 'product-1',
            entityType: 'Product',
            action: 'CREATE',
            timestamp: new Date(),
            serviceId: 'service-a',
          },
        },
      ];

      mockRedisService.xReadMessages.mockResolvedValue(mockMessages);
      mockRedisService.xAck.mockResolvedValue(true);
      mockRedisService.xDel.mockResolvedValue(true);

      const mockSave = jest.fn().mockResolvedValue(mockAuditLog);
      const mockAuditLogInstance = {
        save: mockSave,
      };

      // Replace the model in the service with a constructor function
      (service as any).auditLogModel = jest.fn(() => mockAuditLogInstance);

      // Ensure isConsuming is false
      (service as any).isConsuming = false;

      await (service as any).consumeEvents();

      expect(mockRedisService.xReadMessages).toHaveBeenCalled();
      expect(mockRedisService.xAck).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'msg-1',
      );
      expect(mockRedisService.xDel).toHaveBeenCalledWith(
        expect.any(String),
        'msg-1',
      );
    });

    it('should handle errors when processing messages', async () => {
      const mockMessages: RedisMessage[] = [
        {
          id: 'msg-error',
          data: {
            eventType: 'INVALID',
            entityId: 'invalid',
            entityType: 'Invalid',
            action: 'ERROR',
            timestamp: new Date(),
            serviceId: 'service-error',
          },
        },
      ];

      mockRedisService.xReadMessages.mockResolvedValue(mockMessages);

      const mockSave = jest.fn().mockRejectedValue(new Error('Database error'));
      const mockAuditLogInstance = {
        save: mockSave,
      };

      // Replace the model in the service with a constructor function
      (service as any).auditLogModel = jest.fn(() => mockAuditLogInstance);

      (service as any).isConsuming = false;

      // Should not throw, just log the error
      await expect((service as any).consumeEvents()).resolves.not.toThrow();

      expect(mockRedisService.xReadMessages).toHaveBeenCalled();
    });

    it('should reset isConsuming flag after processing', async () => {
      mockRedisService.xReadMessages.mockResolvedValue([]);

      (service as any).isConsuming = false;

      await (service as any).consumeEvents();

      expect((service as any).isConsuming).toBe(false);
    });
  });
});
