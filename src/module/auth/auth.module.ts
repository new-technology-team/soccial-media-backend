
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthOtp } from './auth-otp.entity';

@Module({
    imports: [
        JwtModule.register({
            global: true,
            secret: "secretKey",
            signOptions: { expiresIn: '7200s' },
            verifyOptions: { algorithms: ['HS256'] },
        }),
        TypeOrmModule.forFeature([AuthOtp], 'mariadb'),
        UserModule
    ],
    providers: [AuthService],
    controllers: [AuthController],
    exports: [AuthService],
})
export class AuthModule { }
