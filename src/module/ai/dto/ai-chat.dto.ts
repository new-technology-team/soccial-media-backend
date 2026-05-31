import { IsString, IsOptional, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

/** Một lượt trong lịch sử hội thoại */
export class ChatHistoryEntryDto {
  @IsIn(['user', 'model'])
  role: 'user' | 'model';

  @IsString()
  text: string;
}

/** Body gửi lên khi chat với AI */
export class AiChatDto {
  @IsString()
  message: string;

  /** Lịch sử hội thoại từ phía client (tuỳ chọn – client có thể tự quản lý) */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryEntryDto)
  history?: ChatHistoryEntryDto[];
}
