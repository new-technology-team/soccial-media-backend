import { ObjectId } from "typeorm";
export declare class Notification {
    _id: ObjectId;
    userId: number;
    type: string;
    title: string;
    body: string;
    meta: any;
    isRead: boolean;
    createdAt: Date;
}
