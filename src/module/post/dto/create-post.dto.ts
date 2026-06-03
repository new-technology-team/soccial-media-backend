import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @IsIn(['public', 'private'])
  visibility?: 'public' | 'private' = 'public';

  @IsOptional()
  @IsString()
  mediaUrl?: string;
}
