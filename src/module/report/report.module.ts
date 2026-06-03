import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { Report } from './report.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Report], 'mariadb')],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
