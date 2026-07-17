import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  privacyLastSeen?: boolean;

  @IsOptional()
  @IsBoolean()
  privacyProfilePhoto?: boolean;

  @IsOptional()
  @IsBoolean()
  allowFriendRequests?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationMessages?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationCalls?: boolean;
}
