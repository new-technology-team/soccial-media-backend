import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemSetting } from './system-setting.entity';
import { SystemSettingService } from './system-setting.service';

@Module({
  imports: [TypeOrmModule.forFeature([SystemSetting], 'mariadb')],
  providers: [SystemSettingService],
  exports: [SystemSettingService],
})
export class SystemSettingModule {}
