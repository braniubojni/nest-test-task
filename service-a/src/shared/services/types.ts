export const StreamNames = {
  PLATFORM_AUDIT_LOGS: 'platform:audit:logs',
} as const;

export const StreamGroupNames = {
  PLATFORM_AUDIT_LOGS_GROUP: 'audit-logs-consumer-group',
} as const;

export interface AuditEvent {
  eventType: string;
  entityId?: string;
  entityType: string;
  action: string;
  data?: any;
  timestamp: Date;
  serviceId?: string;
  userId?: string;
}
