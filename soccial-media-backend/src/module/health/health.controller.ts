import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  HealthCheck as HealthCheckDecorator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheckDecorator()
  check() {
    return this.health.check([
      () => this.db.pingCheck('mariadb', { timeout: 3000 }),
    ]);
  }
}
