import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { SystemSettingModule } from '../system-setting/system-setting.module';

@Module({
    imports: [
        JwtModule.register({
            global: true,
            secret: "secretKey",
            signOptions: { expiresIn: '7200s' },
            verifyOptions: { algorithms: ['HS256'] },
        }),
        UserModule,
        SystemSettingModule,
    ],
    providers: [AuthService],
    controllers: [AuthController],
    exports: [AuthService],
})
export class AuthModule { }
