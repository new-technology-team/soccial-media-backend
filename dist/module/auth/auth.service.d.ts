import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserStatus } from '../../common/enum/user-status.enum';
import { Repository } from 'typeorm';
import { AuthOtp } from './auth-otp.entity';
export declare class AuthService {
    private userService;
    private jwtService;
    private readonly otpRepository;
    private static pairingMap;
    private static pairingCounter;
    constructor(userService: UserService, jwtService: JwtService, otpRepository: Repository<AuthOtp>);
    private isEmail;
    private normalizeIdentifier;
    private createNumericCode;
    private createPairingCode;
    private addMinutes;
    private get authFlags();
    private sendOtp;
    private saveOtp;
    private consumeOtp;
    private issueTokens;
    login(loginDto: LoginDto): Promise<any>;
    register(registerDto: RegisterDto): Promise<any>;
    verifyRegistration(body: {
        emailOrPhone: string;
        code: string;
    }): Promise<{
        accessToken: any;
        refreshToken: any;
        user: {
            id: number;
            username: string | null;
            email: string | null;
            phone: string | null;
            fullName: string;
            dateOfBirth: Date | null;
            gender: number | null;
            role: import("../../common/enum/user-role.enum").UserRole;
            accountStatus: UserStatus;
            avatarUrl: string | null;
            isVerified: boolean;
        };
        message: string;
    }>;
    resendVerificationCode(body: {
        emailOrPhone: string;
    }): Promise<{
        message: string;
        otpSent: boolean;
        otpChannel: string;
        otpReason: string;
        otpError: any;
        verificationCode: string;
        otpDestination?: undefined;
    } | {
        message: string;
        otpSent: boolean;
        otpChannel: string;
        otpDestination: string;
        otpReason: string;
        verificationCode: string | undefined;
        otpError?: undefined;
    }>;
    forgotPassword(body: {
        emailOrPhone: string;
    }): Promise<{
        message: string;
        otpSent: boolean;
        otpChannel: string;
        otpReason: string;
        otpError: any;
        resetCode: string;
        otpDestination?: undefined;
    } | {
        message: string;
        otpSent: boolean;
        otpChannel: string;
        otpDestination: string;
        otpReason: string;
        resetCode: string | undefined;
        otpError?: undefined;
    }>;
    resetPassword(body: {
        emailOrPhone: string;
        code: string;
        newPassword: string;
    }): Promise<{
        message: string;
    }>;
    createDesktopPairingRequest(): Promise<{
        pairingId: number;
        pairingCode: string;
        secretToken: string;
        status: "pending" | "approved" | "rejected" | "expired" | "consumed";
        expiresAt: Date;
        pollIntervalMs: number;
    }>;
    getDesktopPairingStatus(id: number, secret: string): Promise<{
        status: string;
        accessToken: string;
        refreshToken: string;
        user: {
            id: number;
            username: string | null;
            email: string | null;
            phone: string | null;
            fullName: string;
            dateOfBirth: Date | null;
            gender: number | null;
            role: import("../../common/enum/user-role.enum").UserRole;
            accountStatus: UserStatus;
            avatarUrl: string | null;
            isVerified: boolean;
        } | null;
        expiresAt?: undefined;
    } | {
        status: "pending" | "approved" | "rejected" | "expired" | "consumed";
        expiresAt: Date;
        accessToken?: undefined;
        refreshToken?: undefined;
        user?: undefined;
    }>;
    approveDesktopPairing(actorId: number, pairingCode: string): Promise<{
        message: string;
        pairingId: number;
        pairingCode: string;
    }>;
    private sanitizeFileName;
    getAvatarUploadUrl(actorId: number, body: {
        fileName: string;
        contentType: string;
    }): Promise<{
        uploadUrl: string;
        fileUrl: string;
        expiresIn: number;
        contentType: string;
        note: string;
    }>;
    uploadAvatarBase64(actorId: number, body: {
        fileName: string;
        contentType: string;
        base64Data: string;
    }): Promise<{
        message: string;
        fileUrl: string;
        contentType: string;
    }>;
    me(userId: number): Promise<{
        user: {
            id: number;
            username: string | null;
            email: string | null;
            phone: string | null;
            fullName: string;
            dateOfBirth: Date | null;
            gender: number | null;
            role: import("../../common/enum/user-role.enum").UserRole;
            accountStatus: UserStatus;
            avatarUrl: string | null;
            isVerified: boolean;
        };
    }>;
    updateProfile(userId: number, body: any): Promise<{
        message: string;
        user: {
            id: number;
            username: string | null;
            email: string | null;
            phone: string | null;
            fullName: string;
            dateOfBirth: Date | null;
            gender: number | null;
            role: import("../../common/enum/user-role.enum").UserRole;
            accountStatus: UserStatus;
            avatarUrl: string | null;
            isVerified: boolean;
        };
    }>;
    refresh(refreshToken: string): Promise<{
        accessToken: any;
        refreshToken: any;
        user: {
            id: number;
            username: string | null;
            email: string | null;
            phone: string | null;
            fullName: string;
            dateOfBirth: Date | null;
            gender: number | null;
            role: import("../../common/enum/user-role.enum").UserRole;
            accountStatus: UserStatus;
            avatarUrl: string | null;
            isVerified: boolean;
        };
    }>;
    logout(userId: number): Promise<{
        message: string;
    }>;
    changePassword(userId: number, currentPassword: string, newPassword: string): Promise<{
        message: string;
    }>;
}
//# sourceMappingURL=auth.service.d.ts.map