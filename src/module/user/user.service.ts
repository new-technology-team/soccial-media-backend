import { Injectable, BadRequestException, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "./user.entity";
import { Repository } from "typeorm";

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User)
        private usersRepository: Repository<User>
    ) { }

    async findOne(userId: number): Promise<User | null> {
        return this.usersRepository.findOneBy({ userId });
    }

    async findOneByUsername(username: string): Promise<User | null> {
        return this.usersRepository.findOneBy({ username });
    }

    async findOneEmail(email: string): Promise<User | null> {
        return this.usersRepository.findOneBy({ email });
    }
}