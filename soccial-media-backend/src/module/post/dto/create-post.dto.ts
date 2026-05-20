import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';

export class CreatePostDto {
  title?: string;
  content: string;
  visibility?: 'public' | 'private' = 'public';
  mediaUrl?: string;
}
