import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Reads the bearer token when one is offered and lets the request through when
 * it is not. The invite endpoints need exactly this: the same call has to work
 * for a signed-in user, who keeps their name, and for a stranger, who is handed
 * a guest identity instead.
 *
 * A token that is present but broken still fails — silently downgrading someone
 * whose session merely expired would quietly replace their name with `user3737`.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>();
    if (!request.headers.authorization) return true;
    return super.canActivate(context);
  }
}
