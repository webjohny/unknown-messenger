import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChatModule } from '../chat/chat.module';
import { User } from '../database/entities';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  // ChatModule is what carries a rename to the rooms the user is sitting in.
  imports: [TypeOrmModule.forFeature([User]), ChatModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
