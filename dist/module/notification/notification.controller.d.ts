import { NotificationService } from "./notification.service";
export declare class NotificationController {
    private readonly notificationService;
    constructor(notificationService: NotificationService);
    getNotifications(user: any, limit?: string): Promise<{
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
    readNotification(user: any, id: string): Promise<{
        message: string;
    }>;
    readAll(user: any): Promise<{
        message: string;
    }>;
}
//# sourceMappingURL=notification.controller.d.ts.map