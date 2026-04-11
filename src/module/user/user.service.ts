import { Injectable, BadRequestException, UnauthorizedException } from "@nestjs/common";
import { MariaService } from "../../prisma/maria/maria.service";
import { User } from "../../../generated/maria"; 
import { RegisterDto } from "../auth/dto/registerDto";

@Injectable()
export class UserService {
    constructor(
        private readonly mariaService: MariaService
    ) { }

    async findOne(userId: number): Promise<User | null> {
        return this.mariaService.user.findUnique({ where: { userId } });
    }

    async findOneByUsername(username: string): Promise<User | null> {
        return this.mariaService.user.findUnique({ where: { username } });
    }

    async findOneByEmail(email: string): Promise<User | null> {
        return this.mariaService.user.findUnique({ where: { email } });
    }

    async create(registerDto: RegisterDto): Promise<User> {
        const existingUser = await this.findOneByEmail(registerDto.email);
        if (existingUser) {
            throw new BadRequestException('Email already exists');
        }
        return this.mariaService.user.create({
            data: {
                email: registerDto.email,
                password: registerDto.password,
                username: registerDto.username,
                displayName: registerDto.displayName,
                sex: registerDto.sex,
                phone: registerDto.phone,
                role: 'USER',
            },
        });
    }
}