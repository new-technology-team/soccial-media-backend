import { UserRole } from "../../common/enum/user-role.enum";
import { UserStatus } from "../../common/enum/user-status.enum";
export declare class User {
    userId: number;
    username: string | null;
    displayName: string;
    sex: number | null;
    email: string | null;
    dateOfBirth: Date | null;
    phone: string | null;
    password: string | null;
    avatarUrl: string | null;
    isVerified: boolean;
    refreshToken: string | null;
    privacyLastSeen: boolean;
    privacyProfilePhoto: boolean;
    allowFriendRequests: boolean;
    notificationMessages: boolean;
    notificationCalls: boolean;
    role: UserRole;
    status: UserStatus;
}
//# sourceMappingURL=user.entity.d.ts.map