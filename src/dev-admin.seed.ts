import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';

import { UserRole } from './common/enum/user-role.enum';
import { UserStatus } from './common/enum/user-status.enum';
import { User } from './module/user/user.entity';

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'admin123@';

@Injectable()
export class DevAdminSeed implements OnApplicationBootstrap {
  private readonly logger = new Logger(DevAdminSeed.name);

  constructor(
    @InjectDataSource('mariadb')
    private readonly dataSource: DataSource,
  ) {}

  async onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'production' || process.env.DISABLE_DEV_ADMIN_SEED === 'true') {
      return;
    }

    try {
      const usersRepository = this.dataSource.getRepository(User);
      const password = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
      const existing = await usersRepository.findOne({ where: { username: DEFAULT_ADMIN_USERNAME } });

      if (existing) {
        await usersRepository.update(
          { userId: existing.userId },
          {
            displayName: 'Quản trị viên',
            password,
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
            isVerified: true,
          },
        );
        this.logger.log('Đã cập nhật tài khoản quản trị viên mặc định cho môi trường phát triển.');
        return;
      }

      await usersRepository.save(
        usersRepository.create({
          username: DEFAULT_ADMIN_USERNAME,
          displayName: 'Quản trị viên',
          email: null,
          phone: null,
          password,
          avatarUrl: '',
          isVerified: true,
          refreshToken: null,
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
        }),
      );
      this.logger.log('Đã tạo tài khoản quản trị viên mặc định cho môi trường phát triển.');
    } catch (error) {
      this.logger.warn(`Không thể tạo tài khoản quản trị viên mặc định: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
