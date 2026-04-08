import { Module } from '@nestjs/common';
import { MariaService } from './maria/maria.service';
import { MongoService } from './mongo/mongo.service';

@Module({
  providers: [MariaService, MongoService],
  exports: [MariaService, MongoService],
})
export class PrismaModule {}