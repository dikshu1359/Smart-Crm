import mongoose from 'mongoose';

export const MessageSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, index: true },
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    senderRole: { type: String, enum: ['admin', 'teacher', 'student'], required: true },
    recipientId: { type: String, required: true, index: true },
    recipientName: { type: String, required: true },
    recipientRole: { type: String, enum: ['admin', 'teacher', 'student'], required: true },
    text: { type: String, default: '' },
    content: { type: String, default: '' },
    message: { type: String, default: '' },
    attachments: { type: Array, default: [] },
    callData: { type: mongoose.Schema.Types.Mixed, default: null },
    read: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
