import { Injectable, BadRequestException, UnauthorizedException } from "@nestjs/common";
import { User } from "./user.entity";
import { RegisterDto } from "../auth/dto/register.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserStatus } from "../../common/enum/user-status.enum";
import { UserRole } from "../../common/enum/user-role.enum";

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User)
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

    async create(registerDto: RegisterDto): Promise<User> {
        const existingUser = await this.findOneByEmail(registerDto.email);
        if (existingUser) {
            throw new BadRequestException('Email already exists');
        }

        const user = this.usersRepository.create({
            email: registerDto.email,
            password: registerDto.password,
            username: registerDto.username,
            displayName: registerDto.displayName,
            sex: registerDto.sex,
            dateOfBirth: registerDto.dateOfBirth,
            phone: registerDto.phone,
            avatarUrl: '',
            role: UserRole.USER,
            status: UserStatus.ACTIVE,
        });

        return this.usersRepository.save(user);
    }
}