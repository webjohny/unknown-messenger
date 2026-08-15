import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { Message, RoomMember } from '../database/entities';
import { RoomsModule } from '../rooms/rooms.module';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { WsAuthGuard } from './ws-auth.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Message, RoomMember]), AuthModule, RoomsModule],
  providers: [ChatGateway, ChatService, WsAuthGuard],
  exports: [ChatGateway, ChatService],
})
export class ChatModule {}
