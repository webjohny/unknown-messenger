import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';

/**
 * Gateway handlers reuse the HTTP building blocks — the ValidationPipe, and
 * services that throw ForbiddenException — so what reaches a socket is usually
 * an HttpException. Nest does not recognise those on the WS side and reports
 * every one of them as "Internal server error", which tells a client nothing
 * about a message it was refused: a rejected type, a room it left and a genuine
 * crash all read the same.
 *
 * Only HttpExceptions are unwrapped. They are deliberate answers, already
 * written for a caller to read. Anything else keeps the generic wording,
 * because an unexpected failure has no business describing itself to a client.
 */
@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    if (!(exception instanceof HttpException)) {
      super.catch(exception, host);
      return;
    }

    const response = exception.getResponse();
    const message =
      typeof response === 'string'
        ? response
        : ((response as { message?: string | string[] }).message ?? exception.message);

    super.catch(new WsException(Array.isArray(message) ? message.join('; ') : message), host);
  }
}
