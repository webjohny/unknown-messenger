import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { Invite, Message, Room, RoomMember } from '../database/entities';
import { RoomsModule } from '../rooms/rooms.module';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invite, Room, RoomMember, Message]),
    AuthModule,
    RoomsModule,
    ChatModule,
  ],
  controllers: [InvitesController],
  providers: [InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}
