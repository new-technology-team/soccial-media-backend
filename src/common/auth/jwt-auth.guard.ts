import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { User } from '../../module/user/user.entity';
import { UserStatus } from '../enum/user-status.enum';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    @InjectDataSource('mariadb')
    private readonly mariaDataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = String(request.headers?.authorization || '');

    if (!authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authorization.slice(7).trim();
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_ACCESS_SECRET || 'secretKey',
      });
      const userId = Number((payload as any)?.id || 0);
      if (!userId) {
        throw new UnauthorizedException('Invalid token');
      }

      const user = await this.mariaDataSource.getRepository(User).findOne({ where: { userId } });
      if (!user) {
        throw new UnauthorizedException('Account not found');
      }

      const revokedStatuses = [UserStatus.BLOCKED, UserStatus.HIDDEN, UserStatus.DELETED, UserStatus.LOCKED];
      const isTempLocked = user.status === UserStatus.TEMP_LOCKED &&
        (!user.lockedUntil || new Date(user.lockedUntil).getTime() > Date.now());
      if (revokedStatuses.includes(user.status) || isTempLocked) {
        throw new UnauthorizedException('Account is not available');
      }

      request.user = {
        ...(payload as any),
        role: user.role,
        accountStatus: user.status,
        permissions: typeof (user as any).permissions === 'string'
          ? (user as any).permissions.split(',').map((item: string) => item.trim()).filter(Boolean)
          : [],
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid token');
    }
  }
}
