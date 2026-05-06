import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';

export class CreatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @IsEnum(['public', 'private'])
  visibility?: 'public' | 'private' = 'public';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mediaUrl?: string;
}
