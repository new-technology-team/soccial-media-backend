import { Module } from "@nestjs/common";
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from "@nestjs/typeorm";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { ChatAnalysisService } from "./chat-analysis.service";
import { AiMessage } from "./ai-message.entity";
import { AiProviders } from './ai.provider';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([AiMessage], 'mongodb')],
  controllers: [AiController],
  providers: [
    ...AiProviders,
    AiService,
    ChatAnalysisService],
  // exports: [AiService, ChatAnalysisService],
})
export class AiModule { }
