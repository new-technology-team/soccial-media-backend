import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(1)
  emailOrPhone: string;

  @IsString()
  @MinLength(1)
  password: string;
}
