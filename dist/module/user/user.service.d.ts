import { User } from "./user.entity";
import { RegisterDto } from "../auth/dto/register.dto";
import { Repository } from "typeorm";
import { UserStatus } from "../../common/enum/user-status.enum";
import { UserRole } from "../../common/enum/user-role.enum";
export declare class UserService {
    private readonly usersRepository;
    constructor(usersRepository: Repository<User>);
    findOne(userId: number): Promise<User | null>;
    findOneByUsername(username: string): Promise<User | null>;
    findOneByEmail(email: string): Promise<User | null>;
    findOneByPhone(phone: string): Promise<User | null>;
    findByEmailOrPhone(identifier: string): Promise<User | null>;
    searchUsers(keyword: string, viewerUserId: number): Promise<User[]>;
    updateRefreshToken(userId: number, refreshToken: string | null): Promise<void>;
    updateProfile(userId: number, payload: Partial<Pick<User, 'displayName' | 'avatarUrl' | 'sex' | 'dateOfBirth'>>): Promise<User | null>;
    updateSettings(userId: number, payload: Partial<Pick<User, 'privacyLastSeen' | 'privacyProfilePhoto' | 'allowFriendRequests' | 'notificationMessages' | 'notificationCalls'>>): Promise<User | null>;
    updatePassword(userId: number, plainPassword: string): Promise<void>;
    updatePasswordByIdentifier(identifier: string, plainPassword: string): Promise<void>;
    updateVerificationStatus(userId: number, isVerified: boolean): Promise<void>;
    checkPassword(user: User, plainPassword: string): Promise<boolean>;
    create(registerDto: RegisterDto, options?: {
        isVerified?: boolean;
    }): Promise<User>;
    toProfile(user: User): {
        id: number;
        username: string | null;
        email: string | null;
        phone: string | null;
        fullName: string;
        dateOfBirth: Date | null;
        gender: number | null;
        role: UserRole;
        accountStatus: UserStatus;
        avatarUrl: string | null;
        isVerified: boolean;
    };
}
