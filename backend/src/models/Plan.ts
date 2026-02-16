import mongoose, { Document, Schema } from 'mongoose';

export interface IPlan extends Document {
  name: string;
  stripePriceId: string;
  storageLimitBytes: number;
  checkoutUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<IPlan>(
  {
    name: { type: String, required: true },
    stripePriceId: { type: String, required: true, unique: true },
    storageLimitBytes: { type: Number, required: true },
    checkoutUrl: { type: String },
  },
  { timestamps: true, versionKey: false }
);

export const Plan = mongoose.model<IPlan>('Plan', planSchema);
