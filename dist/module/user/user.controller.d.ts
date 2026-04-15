import { UserService } from "./user.service";
export declare class UserController {
    private userService;
    constructor(userService: UserService);
    getSettings(user: any): Promise<{
        settings: {
            privacyLastSeen: boolean;
            privacyProfilePhoto: boolean;
            allowFriendRequests: boolean;
            notificationMessages: boolean;
            notificationCalls: boolean;
            updatedAt: Date;
        };
    }>;
    saveSettings(user: any, body: any): Promise<{
        message: string;
        settings?: undefined;
    } | {
        message: string;
        settings: {
            privacyLastSeen: boolean;
            privacyProfilePhoto: boolean;
            allowFriendRequests: boolean;
            notificationMessages: boolean;
            notificationCalls: boolean;
            updatedAt: Date;
        };
    }>;
    aiSupport(body: {
        message: string;
    }): {
        message: string;
        data: {
            original: string;
            suggestion: string;
        };
    };
}
//# sourceMappingURL=user.controller.d.ts.map