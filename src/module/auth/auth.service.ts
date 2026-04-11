
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
    constructor(
        private userService: UserService,
        private jwtService: JwtService
    ) { }

    async login(loginDto: LoginDto): Promise<any> {
        const user = await this.userService.findOneByUsername(loginDto.username);
        if (user?.password !== loginDto.password) {
            throw new UnauthorizedException();
        }
        const payload = { sub: user.userId, username: user.username };
        return {
            // 💡 Here the JWT secret key that's used for signing the payload 
            // is the key that was passed in the JwtModule
            access_token: await this.jwtService.signAsync(payload),
        };
    }

    async register(registerDto: RegisterDto): Promise<any> {
        const user = await this.userService.findOneByEmail(registerDto.email);
        if (user) {
            throw new UnauthorizedException('Email already exists');
        }
        const newUser = await this.userService.create(registerDto);
        const payload = { sub: newUser.userId, username: newUser.username };
        return {
            access_token: await this.jwtService.signAsync(payload),
        };
    }
}
