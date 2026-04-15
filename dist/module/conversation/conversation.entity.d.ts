import { ObjectId } from "typeorm";
export declare class Conversation {
    _id: ObjectId;
    type: string;
    name: string;
    avatarUrl: string | null;
    createdBy: number;
    createdAt: Date;
    updatedAt: Date;
    members: any[];
    lastMessage: any;
}
//# sourceMappingURL=conversation.entity.d.ts.map