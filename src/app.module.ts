import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from "./module/user/user.module";
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './module/auth/auth.module';
import { PostModule } from './module/post/post.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './module/user/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      port: 3306,
      username: 'root',
      password: '123456',
      database: 'social_media',
      synchronize: true,
      entities: [User],
    }),
    TypeOrmModule.forRoot({
      type: 'mongodb',
      port: 27017,
      username: 'root',
      password: '123456',
      database: 'social_media',
      synchronize: true,
      entities: [],
    }),
    UserModule,
    AuthModule,
    PostModule
  ],
  controllers: [AppController],
  providers: [AppService],
})

export class AppModule {

}
