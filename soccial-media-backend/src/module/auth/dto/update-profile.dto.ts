import { IsDateString, IsOptional, IsString, Matches, Length } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9._]+$/, {
    message: 'Username chỉ được chứa chữ cái, số, dấu chấm và gạch dưới',
  })
  @Length(3, 30)
  username?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  coverUrl?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  gender?: string;
}
