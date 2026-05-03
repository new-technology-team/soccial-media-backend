import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { ChatAnalysisService } from "./chat-analysis.service";
import { AiMessage } from "./ai-message.entity";

@Module({
  imports: [TypeOrmModule.forFeature([AiMessage], 'mongodb')],
  controllers: [AiController],
  providers: [AiService, ChatAnalysisService],
  exports: [AiService, ChatAnalysisService],
})
export class AiModule {}
