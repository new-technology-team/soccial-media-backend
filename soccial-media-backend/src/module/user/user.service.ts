import { Injectable, BadRequestException } from '@nestjs/common';
import { User } from './user.entity';
import { RegisterDto } from '../auth/dto/register.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User, 'mariadb')
    private readonly usersRepository: Repository<User>,
  ) {}

  async findOne(userId: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { userId } });
  }

  async findOneByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } as any });
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findOneByPhone(phone: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { phone } });
  }

  async findByIds(userIds: number[]): Promise<User[]> {
    if (!userIds.length) return [];
    return this.usersRepository
      .createQueryBuilder('user')
      .where('user.userId IN (:...ids)', { ids: userIds })
      .getMany();
  }

  async search(keyword: string, limit = 20): Promise<User[]> {
    const qb = this.usersRepository.createQueryBuilder('user');
    qb.where('user.username LIKE :kw', { kw: `%${keyword}%` })
      .orWhere('user.fullName LIKE :kw', { kw: `%${keyword}%` })
      .orWhere('user.email LIKE :kw', { kw: `%${keyword}%` })
      .limit(limit);
    return qb.getMany();
  }

  async create(data: {
    username: string;
    email: string;
    password: string;
    fullName: string;
    sex?: number;
    dateOfBirth?: string | Date;
    phone?: string;
    avatarUrl?: string;
  }): Promise<User> {
    const user = this.usersRepository.create({
      email: data.email,
      password: data.password,
      username: data.username,
      fullName: data.fullName,
      sex: data.sex ?? 0,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      phone: data.phone || '',
      avatarUrl: data.avatarUrl || '',
    });

    return this.usersRepository.save(user);
  }

  async update(userId: number, data: Partial<{
    fullName: string;
    avatarUrl: string;
    dateOfBirth: Date;
    sex: number;
    password: string;
    phone: string;
  }>): Promise<User> {
    const user = await this.findOne(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (data.fullName !== undefined) user.fullName = data.fullName;
    if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
    if (data.dateOfBirth !== undefined) user.dateOfBirth = data.dateOfBirth;
    if (data.sex !== undefined) user.sex = data.sex;
    if (data.password !== undefined) user.password = data.password;
    if (data.phone !== undefined) user.phone = data.phone;

    return this.usersRepository.save(user);
  }

  async updateSettings(userId: number, data: Partial<{
    privacyLastSeen: boolean;
    privacyProfilePhoto: boolean;
    allowFriendRequests: boolean;
    notificationMessages: boolean;
    notificationCalls: boolean;
  }>): Promise<User> {
    const user = await this.findOne(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (data.privacyLastSeen !== undefined) {
      user.privacyLastSeen = Boolean(data.privacyLastSeen);
    }
    if (data.privacyProfilePhoto !== undefined) {
      user.privacyProfilePhoto = Boolean(data.privacyProfilePhoto);
    }
    if (data.allowFriendRequests !== undefined) {
      user.allowFriendRequests = Boolean(data.allowFriendRequests);
    }
    if (data.notificationMessages !== undefined) {
      user.notificationMessages = Boolean(data.notificationMessages);
    }
    if (data.notificationCalls !== undefined) {
      user.notificationCalls = Boolean(data.notificationCalls);
    }

    return this.usersRepository.save(user);
  }
}
