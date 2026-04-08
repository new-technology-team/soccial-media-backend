
import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/loginDto';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('login')
    login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }
}
