import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  encryptedMasterKey?: string;
  storageUsed: number;
  planId?: mongoose.Types.ObjectId;
  stripeCustomerId?: string;
  isAdmin?: boolean;
  disabledAt?: Date | null;
  deletedRetentionDays?: number;
  totpSecret?: string;
  totpEnabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    encryptedMasterKey: { type: String },
    storageUsed: { type: Number, default: 0 },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan' },
    stripeCustomerId: { type: String },
    isAdmin: { type: Boolean, default: false },
    disabledAt: { type: Date, default: null },
    deletedRetentionDays: { type: Number, default: 30 },
    totpSecret: { type: String },
    totpEnabled: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

userSchema.index({ email: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
