import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectId } from 'mongodb';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { emitToConversation } from '../../common/socket/chat-socket';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification, 'mongodb')
    private readonly notifRepo: Repository<Notification>,
  ) {}

  async create(data: {
    userId: number;
    title: string;
    content: string;
    type?: string;
    meta?: Record<string, any> | null;
    link?: string;
  }) {
    const notif = this.notifRepo.create({
      userId: String(data.userId),
      title: data.title,
      content: data.content,
      type: data.type || 'general',
      meta: data.meta || null,
      link: data.link || '',
      createdAt: new Date(),
    });
    const saved = await this.notifRepo.save(notif);

    emitToConversation(`user:${data.userId}`, 'notification:new', {
      id: String((saved as any)._id || ''),
      userId: String(data.userId),
      type: saved.type || 'general',
      title: saved.title,
      body: saved.content,
      link: saved.link,
      meta: saved.meta || null,
      isRead: Boolean(saved.isRead),
      is_read: Boolean(saved.isRead),
      createdAt: saved.createdAt?.toISOString?.() ?? new Date().toISOString(),
    });

    return saved;
  }

  async findByUser(userId: number, limit = 50) {
    return this.notifRepo.find({
      where: { userId: String(userId) },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async markRead(id: string) {
    await this.notifRepo.update(
      { _id: this.toObjectId(id) } as any,
      { isRead: true } as any,
    );
    return { message: 'Notification marked as read' };
  }

  async markAllRead(userId: number) {
    const notifications = await this.notifRepo.find({
      where: { userId: String(userId), isRead: false },
    });
    await Promise.all(
      notifications.map((n) =>
        this.notifRepo.update({ _id: n._id } as any, { isRead: true } as any),
      ),
    );
    return { message: 'All notifications marked as read' };
  }

  private toObjectId(id: string): any {
    if (!ObjectId.isValid(id)) {
      throw new BadRequestException('Notification id khong hop le');
    }
    return new ObjectId(id);
  }
}
