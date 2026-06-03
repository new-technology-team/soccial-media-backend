import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';

@Controller('api/social')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post('reports')
  @UseGuards(JwtAuthGuard)
  create(
    @Body()
    body: {
      targetType: string;
      targetId: string | number;
      reason: string;
      details?: string;
    },
    @Req() req: any,
  ) {
    return this.reportService.create({
      userId: req.user.sub,
      targetType: body.targetType,
      targetId: String(body.targetId),
      reason: body.reason,
      details: body.details,
    });
  }
}
