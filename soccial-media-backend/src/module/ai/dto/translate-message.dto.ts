import { IsString, IsNotEmpty, IsIn } from 'class-validator';

// Danh sách ngôn ngữ hỗ trợ — thêm vào đây khi muốn mở rộng
export const SUPPORTED_LANGUAGES = [
  'Tiếng Việt',
  'Tiếng Anh',
  'Tiếng Nhật',
  'Tiếng Hàn',
  'Tiếng Trung',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export class TranslateMessageDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(SUPPORTED_LANGUAGES, {
    message: `targetLanguage phải là một trong: ${SUPPORTED_LANGUAGES.join(', ')}`,
  })
  targetLanguage: SupportedLanguage;
}
