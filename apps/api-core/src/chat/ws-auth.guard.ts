import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';

/**
 * The handshake is verified once in `handleConnection`, and a socket can outlive
 * the token that opened it by days — so this guard re-reads the deadline that
 * came with it. Without the check, "signed in" would mean "was signed in once",
 * and a 15-minute access token would buy an unbounded session as long as the
 * connection is held open.
 *
 * The socket is closed rather than merely refused: a client whose token has
 * expired has to get a new one and reconnect, and the browser side does exactly
 * that when the server hangs up (see SessionSocketProvider).
 */
@Injectable()
export class WsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();
    if (!client.data?.userId) throw new WsException('Unauthorized');

    const exp = client.data.exp as number | undefined;
    if (exp !== undefined && Date.now() >= exp * 1000) {
      client.disconnect(true);
      throw new WsException('Access token expired');
    }

    return true;
  }
}
