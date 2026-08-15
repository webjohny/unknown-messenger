import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';

/**
 * The handshake is verified once in `handleConnection`; this guard only asserts
 * that the resulting identity is still attached to the socket.
 */
@Injectable()
export class WsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();
    if (!client.data?.userId) throw new WsException('Unauthorized');
    return true;
  }
}
