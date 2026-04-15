import { Repository } from "typeorm";
import { Notification } from "./notification.entity";
export declare class NotificationService {
    private readonly notificationRepository;
    constructor(notificationRepository: Repository<Notification>);
    createNotification(payload: {
        userId: number;
        type: string;
        title: string;
        body: string;
        meta?: any;
    }): Promise<Notification>;
    listByUser(userId: number, limit?: number): Promise<{
        notifications: {
            id: string;
            userId: any;
            type: any;
            title: any;
            body: any;
            meta: any;
            isRead: boolean;
            createdAt: any;
        }[];
    }>;
    markRead(userId: number, id: string): Promise<{
        message: string;
    }>;
    markAllRead(userId: number): Promise<{
        message: string;
    }>;
}
