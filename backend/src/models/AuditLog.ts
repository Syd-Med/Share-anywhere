import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAuditLog extends Document {
  adminId: Types.ObjectId;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
