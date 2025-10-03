import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class AuditLog extends Document {
  @Prop({ required: true, index: true })
  eventType: string;

  @Prop({ index: true })
  entityId: string;

  @Prop({ required: true, index: true })
  entityType: string;

  @Prop({ required: true, index: true })
  action: string;

  @Prop({ type: Object })
  data: Record<string, any>;

  @Prop({ required: true, index: true })
  timestamp: Date;

  @Prop({ required: true, index: true })
  serviceId: string;

  @Prop()
  userId: string;

  @Prop({ required: true })
  messageId: string;

  @Prop({ default: false })
  processed: boolean;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ timestamp: -1, eventType: 1 });
AuditLogSchema.index({ serviceId: 1, timestamp: -1 });
AuditLogSchema.index({ entityType: 1, action: 1, timestamp: -1 });
