import { IsString, IsOptional } from 'class-validator';

export class CreateCommentDto {
  content: string;
  parentId?: string;
}
