import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  IsDateString,
  Matches,
  Length,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9._]+$/, {
    message: 'Username chỉ được chứa chữ cái, số, dấu chấm và gạch dưới',
  })
  @Length(3, 30, {
    message: 'Username phải từ 3 đến 30 ký tự',
  })
  username: string;

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
