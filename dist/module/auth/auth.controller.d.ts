import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    login(loginDto: LoginDto): Promise<any>;
    register(registerDto: RegisterDto): Promise<any>;
    verifyRegistration(body: {
        emailOrPhone: string;
        code: string;
    }): Promise<{
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
            accountStatus: import("../../common/enum/user-status.enum").UserStatus;
            avatarUrl: string | null;
            isVerified: boolean;
        };
        message: string;
    }>;
    resendVerification(body: {
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
    getDesktopPairingStatus(id: string, secret: string): Promise<{
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
            accountStatus: import("../../common/enum/user-status.enum").UserStatus;
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
    approveDesktopPairing(user: any, body: {
        pairingCode: string;
    }): Promise<{
        message: string;
        pairingId: number;
        pairingCode: string;
    }>;
    refresh(body: {
        refreshToken: string;
    }): Promise<{
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
            accountStatus: import("../../common/enum/user-status.enum").UserStatus;
            avatarUrl: string | null;
            isVerified: boolean;
        };
    }>;
    me(user: any): Promise<{
        user: {
            id: number;
            username: string | null;
            email: string | null;
            phone: string | null;
            fullName: string;
            dateOfBirth: Date | null;
            gender: number | null;
            role: import("../../common/enum/user-role.enum").UserRole;
            accountStatus: import("../../common/enum/user-status.enum").UserStatus;
            avatarUrl: string | null;
            isVerified: boolean;
        };
    }>;
    updateProfile(user: any, body: any): Promise<{
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
            accountStatus: import("../../common/enum/user-status.enum").UserStatus;
            avatarUrl: string | null;
            isVerified: boolean;
        };
    }>;
    changePassword(user: any, body: {
        currentPassword: string;
        newPassword: string;
    }): Promise<{
        message: string;
    }>;
    logout(user: any): Promise<{
        message: string;
    }>;
    avatarUploadUrl(user: any, body: {
        fileName: string;
        contentType: string;
    }): Promise<{
        uploadUrl: string;
        fileUrl: string;
        expiresIn: number;
        contentType: string;
        note: string;
    }>;
    avatarUploadBase64(user: any, body: {
        fileName: string;
        contentType: string;
        base64Data: string;
    }): Promise<{
        message: string;
        fileUrl: string;
        contentType: string;
    }>;
}
//# sourceMappingURL=auth.controller.d.ts.map