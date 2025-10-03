import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { QueryLogsDto } from './dto/query-logs.dto';
import { LogsPaginationResult } from './types';

describe('LogsController', () => {
  let controller: LogsController;
  let logsService: jest.Mocked<LogsService>;

  const mockLogsService = {
    queryLogs: jest.fn(),
    getStatistics: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LogsController],
      providers: [
        {
          provide: LogsService,
          useValue: mockLogsService,
        },
      ],
    }).compile();

    controller = module.get<LogsController>(LogsController);
    logsService = module.get(LogsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('queryLogs', () => {
    const mockQueryDto: QueryLogsDto = {
      eventType: 'PRODUCT_CREATED',
      entityType: 'Product',
      action: 'CREATE',
      serviceId: 'service-a',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      page: 1,
      limit: 20,
    };

    const mockLogsResponse: LogsPaginationResult = {
      data: [
        {
          _id: '507f1f77bcf86cd799439011',
          eventType: 'PRODUCT_CREATED',
          entityType: 'Product',
          action: 'CREATE',
          serviceId: 'service-a',
          timestamp: new Date('2024-06-15T10:30:00Z'),
          entityId: 'product-123',
          userId: 'user-456',
          data: { name: 'Test Product' },
          messageId: 'msg-123',
          processed: true,
        } as any,
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    };

    it('should return logs with all query parameters', async () => {
      logsService.queryLogs.mockResolvedValue(mockLogsResponse);

      const result = await controller.queryLogs(mockQueryDto);

      expect(logsService.queryLogs).toHaveBeenCalledWith(mockQueryDto);
      expect(result).toEqual(mockLogsResponse);
    });

    it('should return logs with minimal query parameters', async () => {
      const minimalQuery: QueryLogsDto = { page: 1, limit: 10 };
      const minimalResponse = {
        ...mockLogsResponse,
        pagination: { ...mockLogsResponse.pagination, limit: 10 },
      };

      logsService.queryLogs.mockResolvedValue(minimalResponse as any);

      const result = await controller.queryLogs(minimalQuery);

      expect(logsService.queryLogs).toHaveBeenCalledWith(minimalQuery);
      expect(result).toEqual(minimalResponse);
    });

    it('should return empty results when no logs match', async () => {
      const emptyResponse = {
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      };

      logsService.queryLogs.mockResolvedValue(emptyResponse as any);

      const result = await controller.queryLogs(mockQueryDto);

      expect(logsService.queryLogs).toHaveBeenCalledWith(mockQueryDto);
      expect(result).toEqual(emptyResponse);
    });

    it('should handle service errors properly', async () => {
      const error = new Error('Database connection failed');
      logsService.queryLogs.mockRejectedValue(error);

      await expect(controller.queryLogs(mockQueryDto)).rejects.toThrow(
        'Database connection failed',
      );
      expect(logsService.queryLogs).toHaveBeenCalledWith(mockQueryDto);
    });

    it('should work with date range filters', async () => {
      const dateRangeQuery: QueryLogsDto = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        page: 1,
        limit: 20,
      };

      logsService.queryLogs.mockResolvedValue(mockLogsResponse);

      const result = await controller.queryLogs(dateRangeQuery);

      expect(logsService.queryLogs).toHaveBeenCalledWith(dateRangeQuery);
      expect(result).toEqual(mockLogsResponse);
    });

    it('should work with single filter parameters', async () => {
      const singleFilterQuery: QueryLogsDto = {
        eventType: 'USER_LOGIN',
        page: 1,
        limit: 20,
      };

      logsService.queryLogs.mockResolvedValue(mockLogsResponse);

      const result = await controller.queryLogs(singleFilterQuery);

      expect(logsService.queryLogs).toHaveBeenCalledWith(singleFilterQuery);
      expect(result).toEqual(mockLogsResponse);
    });
  });

  describe('getStats', () => {
    const mockQueryDto: QueryLogsDto = {
      startDate: '2024-01-01',
      endDate: '2024-12-31',
    };

    const mockStatsResponse = {
      totalLogs: 150,
      byEventType: [
        { type: 'PRODUCT_CREATED', count: 50 },
        { type: 'USER_LOGIN', count: 40 },
        { type: 'ORDER_PLACED', count: 35 },
        { type: 'USER_LOGOUT', count: 25 },
      ],
      byAction: [
        { action: 'CREATE', count: 60 },
        { action: 'READ', count: 45 },
        { action: 'UPDATE', count: 30 },
        { action: 'DELETE', count: 15 },
      ],
      byService: [
        { service: 'service-a', count: 80 },
        { service: 'service-b', count: 40 },
        { service: 'service-c', count: 30 },
      ],
    };

    it('should return statistics with query parameters', async () => {
      logsService.getStatistics.mockResolvedValue(mockStatsResponse as any);

      const result = await controller.getStats(mockQueryDto);

      expect(logsService.getStatistics).toHaveBeenCalledWith(mockQueryDto);
      expect(result).toEqual(mockStatsResponse);
    });

    it('should return statistics without query parameters', async () => {
      const emptyQuery: QueryLogsDto = {};
      logsService.getStatistics.mockResolvedValue(mockStatsResponse as any);

      const result = await controller.getStats(emptyQuery);

      expect(logsService.getStatistics).toHaveBeenCalledWith(emptyQuery);
      expect(result).toEqual(mockStatsResponse);
    });

    it('should return zero statistics when no data exists', async () => {
      const emptyStatsResponse = {
        totalLogs: 0,
        byEventType: [],
        byAction: [],
        byService: [],
      };

      logsService.getStatistics.mockResolvedValue(emptyStatsResponse as any);

      const result = await controller.getStats(mockQueryDto);

      expect(logsService.getStatistics).toHaveBeenCalledWith(mockQueryDto);
      expect(result).toEqual(emptyStatsResponse);
    });

    it('should handle service errors during statistics retrieval', async () => {
      const error = new Error('Aggregation pipeline failed');
      logsService.getStatistics.mockRejectedValue(error);

      await expect(controller.getStats(mockQueryDto)).rejects.toThrow(
        'Aggregation pipeline failed',
      );
      expect(logsService.getStatistics).toHaveBeenCalledWith(mockQueryDto);
    });

    it('should work with date range for statistics', async () => {
      const dateRangeQuery: QueryLogsDto = {
        startDate: '2024-06-01',
        endDate: '2024-06-30',
      };

      logsService.getStatistics.mockResolvedValue(mockStatsResponse);

      const result = await controller.getStats(dateRangeQuery);

      expect(logsService.getStatistics).toHaveBeenCalledWith(dateRangeQuery);
      expect(result).toEqual(mockStatsResponse);
    });
  });

  describe('findOne', () => {
    const mockLogId = '507f1f77bcf86cd799439011';
    const mockLog = {
      _id: mockLogId,
      eventType: 'PRODUCT_CREATED',
      entityType: 'Product',
      action: 'CREATE',
      serviceId: 'service-a',
      timestamp: new Date('2024-06-15T10:30:00Z'),
      entityId: 'product-123',
      userId: 'user-456',
      metadata: { name: 'Test Product' },
      messageId: 'msg-123',
      processed: true,
    };

    it('should return a single log by ID', async () => {
      logsService.findOne.mockResolvedValue(mockLog as any);

      const result = await controller.findOne(mockLogId);

      expect(logsService.findOne).toHaveBeenCalledWith(mockLogId);
      expect(result).toEqual(mockLog);
    });

    it('should throw NotFoundException when log is not found', async () => {
      const notFoundError = new NotFoundException(
        `Log with ID ${mockLogId} not found`,
      );
      logsService.findOne.mockRejectedValue(notFoundError);

      await expect(controller.findOne(mockLogId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.findOne(mockLogId)).rejects.toThrow(
        `Log with ID ${mockLogId} not found`,
      );
      expect(logsService.findOne).toHaveBeenCalledWith(mockLogId);
    });

    it('should handle invalid ObjectId format', async () => {
      const invalidId = 'invalid-id';
      const error = new Error('Invalid ObjectId format');
      logsService.findOne.mockRejectedValue(error);

      await expect(controller.findOne(invalidId)).rejects.toThrow(
        'Invalid ObjectId format',
      );
      expect(logsService.findOne).toHaveBeenCalledWith(invalidId);
    });

    it('should handle database connection errors', async () => {
      const error = new Error('Database connection lost');
      logsService.findOne.mockRejectedValue(error);

      await expect(controller.findOne(mockLogId)).rejects.toThrow(
        'Database connection lost',
      );
      expect(logsService.findOne).toHaveBeenCalledWith(mockLogId);
    });

    it('should work with different valid ObjectId formats', async () => {
      const anotherValidId = '507f191e810c19729de860ea';
      const anotherMockLog = { ...mockLog, _id: anotherValidId };

      logsService.findOne.mockResolvedValue(anotherMockLog as any);

      const result = await controller.findOne(anotherValidId);

      expect(logsService.findOne).toHaveBeenCalledWith(anotherValidId);
      expect(result).toEqual(anotherMockLog);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle multiple concurrent requests', async () => {
      const query1: QueryLogsDto = { eventType: 'USER_LOGIN' };
      const query2: QueryLogsDto = { eventType: 'PRODUCT_CREATED' };
      const query3: QueryLogsDto = { action: 'DELETE' };

      const mockResponse1 = {
        data: [{ eventType: 'USER_LOGIN' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      const mockResponse2 = {
        data: [{ eventType: 'PRODUCT_CREATED' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      const mockResponse3 = {
        data: [{ action: 'DELETE' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      logsService.queryLogs
        .mockResolvedValueOnce(mockResponse1 as any)
        .mockResolvedValueOnce(mockResponse2 as any)
        .mockResolvedValueOnce(mockResponse3 as any);

      const [result1, result2, result3] = await Promise.all([
        controller.queryLogs(query1),
        controller.queryLogs(query2),
        controller.queryLogs(query3),
      ]);

      expect(logsService.queryLogs).toHaveBeenCalledTimes(3);
      expect(result1).toEqual(mockResponse1);
      expect(result2).toEqual(mockResponse2);
      expect(result3).toEqual(mockResponse3);
    });

    it('should maintain service method isolation', async () => {
      const queryDto: QueryLogsDto = { eventType: 'TEST' };
      const logId = '507f1f77bcf86cd799439011';

      const mockQueryResponse = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
      const mockStatsResponse = {
        totalLogs: 0,
        byEventType: [],
        byAction: [],
        byService: [],
      };
      const mockLog = { _id: logId, eventType: 'TEST' };

      logsService.queryLogs.mockResolvedValue(mockQueryResponse as any);
      logsService.getStatistics.mockResolvedValue(mockStatsResponse as any);
      logsService.findOne.mockResolvedValue(mockLog as any);

      await controller.queryLogs(queryDto);
      await controller.getStats(queryDto);
      await controller.findOne(logId);

      expect(logsService.queryLogs).toHaveBeenCalledWith(queryDto);
      expect(logsService.getStatistics).toHaveBeenCalledWith(queryDto);
      expect(logsService.findOne).toHaveBeenCalledWith(logId);
    });
  });
});
