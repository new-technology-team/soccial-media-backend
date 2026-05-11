import {
  IsArray,
  IsString,
  IsNotEmpty,
  ValidateNested,
  IsOptional,
} from "class-validator";
import { Type } from "class-transformer";

export class MessageInputDto {
  @IsString()
  @IsNotEmpty()
  sender: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  timestamp?: Date | string;
}

export class SuggestRepliesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageInputDto)
  messages: MessageInputDto[];

  @IsString()
  @IsNotEmpty()
  currentUserName: string;
}
