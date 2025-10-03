import { AuditLog } from './schemas/audit-log.schema';

export interface LogsPaginationResult {
  data: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LogsStatistics {
  totalLogs: number;
  byEventType: EventTypeStat[];
  byAction: ActionStat[];
  byService: ServiceStat[];
}

export interface EventTypeStat {
  type: string;
  count: number;
}

export interface ActionStat {
  action: string;
  count: number;
}

export interface ServiceStat {
  service: string;
  count: number;
}

export interface TimeSeriesDataPoint {
  _id: {
    time: string;
    eventType: string;
  };
  count: number;
}

export type TimeSeriesData = TimeSeriesDataPoint[];

export interface RedisMessage {
  id: string;
  data: Record<string, any>;
}
