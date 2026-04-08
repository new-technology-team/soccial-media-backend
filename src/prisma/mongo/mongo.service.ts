import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../../generated/mongo'; 
@Injectable()
export class MongoService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}