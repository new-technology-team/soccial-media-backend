import { ObjectId } from "typeorm";
export declare class Post {
    _id: ObjectId;
    content: string;
    mediaUrl: string | null;
    visibility: string;
    status: string;
    authorId: number;
    createdAt: Date;
    updatedAt: Date;
    reactions: any[];
    commentCount: number;
}
//# sourceMappingURL=post.entity.d.ts.map