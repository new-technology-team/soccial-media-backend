import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './report.entity';
import { Post } from '../post/post.entity';
import { Comment } from '../comment/comment.entity';
import { Message } from '../message/message.entity';
import { ObjectId } from 'typeorm';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report, 'mariadb')
    private readonly reportRepo: Repository<Report>,
    @InjectRepository(Post, 'mongodb')
    private readonly postRepo: Repository<Post>,
    @InjectRepository(Comment, 'mongodb')
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(Message, 'mongodb')
    private readonly messageRepo: Repository<Message>,
  ) {}

  async create(data: {
    userId: number;
    targetType: string;
    targetId: string;
    reason: string;
    details?: string;
  }) {
    await this.ensureNotSelfReport(data.userId, data.targetType, data.targetId);

    const report = new Report();
    report.userId = data.userId;
    report.targetType = data.targetType;
    report.targetId = String(data.targetId);
    report.description = data.details || data.reason;
    report.reportType = data.targetType;
    report.status = 'PENDING';
    report.createAt = new Date();
    await this.reportRepo.save(report);
    return { message: 'Report submitted successfully' };
  }

  private async ensureNotSelfReport(
    userId: number,
    targetType: string,
    targetId: string,
  ): Promise<void> {
    switch (targetType) {
      case 'user': {
        const targetUserId = parseInt(targetId, 10);
        if (targetUserId === userId) {
          throw new BadRequestException('Khong the tu bao cao chinh minh');
        }
        return;
      }

      case 'post': {
        let objectId: ObjectId;
        try {
          objectId = new ObjectId(targetId);
        } catch {
          throw new BadRequestException('ID bai viet khong hop le');
        }
        const post = await this.postRepo.findOne({
          where: { _id: objectId } as any,
        });
        if (!post) {
          throw new BadRequestException('Khong tim thay bai viet');
        }
        if (post.owner?.userId === userId) {
          throw new BadRequestException('Khong the bao cao bai viet cua chinh minh');
        }
        return;
      }

      case 'comment': {
        let objectId: ObjectId;
        try {
          objectId = new ObjectId(targetId);
        } catch {
          throw new BadRequestException('ID binh luan khong hop le');
        }
        const comment = await this.commentRepo.findOne({
          where: { _id: objectId } as any,
        });
        if (!comment) {
          throw new BadRequestException('Khong tim thay binh luan');
        }
        if (comment.owner?.userId === userId) {
          throw new BadRequestException('Khong the bao cao binh luan cua chinh minh');
        }
        return;
      }

      case 'message': {
        let objectId: ObjectId;
        try {
          objectId = new ObjectId(targetId);
        } catch {
          throw new BadRequestException('ID tin nhan khong hop le');
        }
        const message = await this.messageRepo.findOne({
          where: { _id: objectId } as any,
        });
        if (!message) {
          throw new BadRequestException('Khong tim thay tin nhan');
        }
        if (message.senderId === userId) {
          throw new BadRequestException('Khong the bao cao tin nhan cua chinh minh');
        }
        return;
      }

      default:
        // Unknown target type — allow and let moderators review
        return;
    }
  }
}
