import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../../generated/maria'; 

@Injectable()
export class MariaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}