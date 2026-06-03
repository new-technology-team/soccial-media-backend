import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from './system-setting.entity';

export type AdminSystemSettings = Record<
  'otp' | 'register' | 'session' | 'auto' | 'notify' | 'rate' | 'device' | 'logging' | 'maintenance',
  boolean
>;

@Injectable()
export class SystemSettingService {
  private readonly adminConsoleKey = 'admin_console';

  constructor(
    @InjectRepository(SystemSetting, 'mariadb')
    private readonly systemSettingRepository: Repository<SystemSetting>,
  ) {}

  defaultAdminSettings(): AdminSystemSettings {
    return {
      otp: true,
      register: true,
      session: false,
      auto: true,
      notify: true,
      rate: true,
      device: true,
      logging: true,
      maintenance: false,
    };
  }

  async getAdminSettings(): Promise<{ settings: AdminSystemSettings; updatedAt: Date | null }> {
    const row = await this.systemSettingRepository.findOne({ where: { key: this.adminConsoleKey } });
    let saved: Partial<AdminSystemSettings> = {};
    try {
      saved = row?.value ? JSON.parse(row.value) : {};
    } catch {
      saved = {};
    }

    return {
      settings: {
        ...this.defaultAdminSettings(),
        ...saved,
      },
      updatedAt: row?.updatedAt || null,
    };
  }

  async updateAdminSettings(input: Record<string, unknown>): Promise<AdminSystemSettings> {
    const defaults = this.defaultAdminSettings();
    const next = { ...defaults };
    for (const key of Object.keys(defaults) as Array<keyof AdminSystemSettings>) {
      if (input?.[key] !== undefined) {
        next[key] = Boolean(input[key]);
      }
    }

    await this.systemSettingRepository.save(
      this.systemSettingRepository.create({
        key: this.adminConsoleKey,
        value: JSON.stringify(next),
      }),
    );
    return next;
  }
}
