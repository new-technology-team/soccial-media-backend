import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './report.entity';

const DEFAULT_MODERATOR_PERMISSIONS = [
	'manage_posts',
	'manage_reports',
	'manage_comments',
	'manage_users',
];

function normalizePermissions(value: any, fallback: string[] = []) {
	const raw = Array.isArray(value)
		? value
		: typeof value === 'string'
			? value.split(',')
			: fallback;
	return Array.from(new Set(raw.map((item: any) => String(item || '').trim()).filter(Boolean)));
}

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report, 'mariadb')
    private readonly reportRepo: Repository<Report>,
  ) {}

  async create(data: {
    userId: number;
    targetType: string;
    targetId: string;
    reason: string;
    details?: string;
  }) {
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
}
