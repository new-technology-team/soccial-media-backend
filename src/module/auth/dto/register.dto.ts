import { IsString, IsEmail, IsOptional, MinLength, IsDateString } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsOptional()
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  emailOrPhone?: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  sex?: number;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}
