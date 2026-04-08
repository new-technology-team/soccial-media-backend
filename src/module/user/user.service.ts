import { Injectable, BadRequestException, UnauthorizedException } from "@nestjs/common";
import { MariaService } from "../../prisma/maria/maria.service";
import { User } from "../../../generated/maria"; 

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
}