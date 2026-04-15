"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const user_entity_1 = require("./user.entity");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_status_enum_1 = require("../../common/enum/user-status.enum");
const user_role_enum_1 = require("../../common/enum/user-role.enum");
const bcrypt = __importStar(require("bcryptjs"));
let UserService = class UserService {
    constructor(usersRepository) {
        this.usersRepository = usersRepository;
    }
    async findOne(userId) {
        return this.usersRepository.findOne({ where: { userId } });
    }
    async findOneByUsername(username) {
        return this.usersRepository.findOne({ where: { username } });
    }
    async findOneByEmail(email) {
        return this.usersRepository.findOne({ where: { email } });
    }
    async findOneByPhone(phone) {
        return this.usersRepository.findOne({ where: { phone } });
    }
    async findByEmailOrPhone(identifier) {
        const normalized = String(identifier || '').trim().toLowerCase();
        const byEmail = await this.findOneByEmail(normalized);
        if (byEmail)
            return byEmail;
        return this.findOneByPhone(String(identifier || '').trim());
    }
    async searchUsers(keyword, viewerUserId) {
        const q = String(keyword || '').trim();
        if (!q)
            return [];
        return this.usersRepository.find({
            where: [
                { displayName: (0, typeorm_2.ILike)(`%${q}%`) },
                { email: (0, typeorm_2.ILike)(`%${q}%`) },
                { phone: (0, typeorm_2.ILike)(`%${q}%`) },
                { username: (0, typeorm_2.ILike)(`%${q}%`) },
            ],
            take: 30,
        }).then((rows) => rows.filter((item) => item.userId !== viewerUserId));
    }
    async updateRefreshToken(userId, refreshToken) {
        await this.usersRepository.update({ userId }, { refreshToken: refreshToken || null });
    }
    async updateProfile(userId, payload) {
        await this.usersRepository.update({ userId }, payload);
        return this.findOne(userId);
    }
    async updateSettings(userId, payload) {
        const next = {};
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
    async updatePassword(userId, plainPassword) {
        const hashed = await bcrypt.hash(plainPassword, 10);
        await this.usersRepository.update({ userId }, { password: hashed });
    }
    async updatePasswordByIdentifier(identifier, plainPassword) {
        const user = await this.findByEmailOrPhone(identifier);
        if (!user) {
            throw new common_1.BadRequestException('Tài khoản không tồn tại');
        }
        await this.updatePassword(user.userId, plainPassword);
    }
    async updateVerificationStatus(userId, isVerified) {
        await this.usersRepository.update({ userId }, { isVerified: Boolean(isVerified) });
    }
    async checkPassword(user, plainPassword) {
        if (!user?.password)
            return false;
        return bcrypt.compare(plainPassword, user.password);
    }
    async create(registerDto, options) {
        const existingUser = registerDto.email ? await this.findOneByEmail(registerDto.email) : null;
        if (existingUser) {
            throw new common_1.BadRequestException('Email already exists');
        }
        if (registerDto.phone) {
            const existingPhone = await this.findOneByPhone(registerDto.phone);
            if (existingPhone) {
                throw new common_1.BadRequestException('Phone already exists');
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
            role: user_role_enum_1.UserRole.USER,
            status: user_status_enum_1.UserStatus.ACTIVE,
        });
        return this.usersRepository.save(user);
    }
    toProfile(user) {
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
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User, 'mariadb')),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], UserService);
//# sourceMappingURL=user.service.js.map