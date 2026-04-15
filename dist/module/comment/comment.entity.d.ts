import { ObjectId } from "typeorm";
export declare class Comment {
    _id: ObjectId;
    postId: string;
    userId: number;
    content: string;
    file: string | null;
    status: string;
    reactions: any[];
    createdAt: Date;
    updatedAt: Date;
}
