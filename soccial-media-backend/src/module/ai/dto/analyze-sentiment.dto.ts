import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MessageInputDto } from './suggest-replies.dto';

export class AnalyzeSentimentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageInputDto)
  messages: MessageInputDto[];
}
