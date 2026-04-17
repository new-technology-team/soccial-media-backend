import { Injectable, BadRequestException, UnauthorizedException } from "@nestjs/common";
import { User } from "./user.entity";
import { RegisterDto } from "../auth/dto/register.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { UserStatus } from "../../common/enum/user-status.enum";
import { UserRole } from "../../common/enum/user-role.enum";
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User, 'mariadb')
        private readonly usersRepository: Repository<User>,
    ) { }

    async findOne(userId: number): Promise<User | null> {
        return this.usersRepository.findOne({ where: { userId } });
    }

    async findOneByUsername(username: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { username } });
    }

    async findOneByEmail(email: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { email } });
    }

    async findOneByPhone(phone: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { phone } });
    }

    async findByEmailOrPhone(identifier: string): Promise<User | null> {
        const normalized = String(identifier || '').trim().toLowerCase();
        const byEmail = await this.findOneByEmail(normalized);
        if (byEmail) return byEmail;
        return this.findOneByPhone(String(identifier || '').trim());
    }

    async searchUsers(keyword: string, viewerUserId: number): Promise<User[]> {
        const q = String(keyword || '').trim();
        if (!q) return [];

        return this.usersRepository.find({
            where: [
                { displayName: ILike(`%${q}%`) },
                { email: ILike(`%${q}%`) },
                { phone: ILike(`%${q}%`) },
                { username: ILike(`%${q}%`) },
            ],
            take: 30,
        }).then((rows) => rows.filter((item) => item.userId !== viewerUserId));
    }

    async updateRefreshToken(userId: number, refreshToken: string | null): Promise<void> {
        await this.usersRepository.update({ userId }, { refreshToken: refreshToken || null });
    }

    async updateProfile(userId: number, payload: Partial<Pick<User, 'displayName' | 'avatarUrl' | 'sex' | 'dateOfBirth'>>): Promise<User | null> {
        await this.usersRepository.update({ userId }, payload);
        return this.findOne(userId);
    }

    async updateSettings(
        userId: number,
        payload: Partial<
            Pick<User, 'privacyLastSeen' | 'privacyProfilePhoto' | 'allowFriendRequests' | 'notificationMessages' | 'notificationCalls'>
        >,
    ): Promise<User | null> {
        const next: any = {};
        for (const [key, value] of Object.entries(payload || {})) {
            if (value !== undefined) {
                next[key] = Boolean(value);
            }
        }

        if (Object.keys(next).length > 0) {
            await this.usersRepository.update({ userId }, next);
        }

        return this.findOne(userId);
    }

    async updatePassword(userId: number, plainPassword: string): Promise<void> {
        const hashed = await bcrypt.hash(plainPassword, 10);
        await this.usersRepository.update({ userId }, { password: hashed });
    }

    async updatePasswordByIdentifier(identifier: string, plainPassword: string): Promise<void> {
        const user = await this.findByEmailOrPhone(identifier);
        if (!user) {
            throw new BadRequestException('Tài khoản không tồn tại');
        }
        await this.updatePassword(user.userId, plainPassword);
    }

    async updateVerificationStatus(userId: number, isVerified: boolean): Promise<void> {
        await this.usersRepository.update({ userId }, { isVerified: Boolean(isVerified) });
    }

    async checkPassword(user: User, plainPassword: string): Promise<boolean> {
        if (!user?.password) return false;
        return bcrypt.compare(plainPassword, user.password);
    }

    async create(registerDto: RegisterDto, options?: { isVerified?: boolean }): Promise<User> {
        const existingUser = registerDto.email ? await this.findOneByEmail(registerDto.email) : null;
        if (existingUser) {
            throw new BadRequestException('Email already exists');
        }

        if (registerDto.phone) {
            const existingPhone = await this.findOneByPhone(registerDto.phone);
            if (existingPhone) {
                throw new BadRequestException('Phone already exists');
            }
        }

        const passwordHash = registerDto.password ? await bcrypt.hash(registerDto.password, 10) : null;
        const generatedUsername = registerDto.username || `user_${Date.now()}`;

        const user = this.usersRepository.create({
            email: registerDto.email,
            password: passwordHash,
            username: generatedUsername,
            displayName: registerDto.displayName || generatedUsername,
            sex: registerDto.sex,
            dateOfBirth: registerDto.dateOfBirth,
            phone: registerDto.phone,
            avatarUrl: registerDto.avatarUrl || '',
            isVerified: options?.isVerified ?? true,
            refreshToken: null,
            role: UserRole.USER,
            status: UserStatus.ACTIVE,
        });

        return this.usersRepository.save(user);
    }

    toProfile(user: User) {
        return {
            id: user.userId,
            username: user.username,
            email: user.email || null,
            phone: user.phone || null,
            fullName: user.displayName,
            dateOfBirth: user.dateOfBirth || null,
            gender: user.sex ?? null,
            role: user.role,
            accountStatus: user.status,
            avatarUrl: user.avatarUrl || null,
            isVerified: Boolean(user.isVerified),
        };
    }
}
