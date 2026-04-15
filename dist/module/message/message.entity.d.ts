import { ObjectId } from "typeorm";
export declare class Message {
    _id: ObjectId;
    conversationId: string;
    senderId: number;
    type: string;
    text: string | null;
    mediaUrl: string | null;
    fileName: string | null;
    mimeType: string | null;
    fileSize: number | null;
    meta: any;
    reactions: any[];
    createdAt: Date;
    updatedAt: Date;
    isRecalled: boolean;
}
//# sourceMappingURL=message.entity.d.ts.map