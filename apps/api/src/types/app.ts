import type { SchoolActor } from '@repo/shared';
import type { RequestIdVariables } from 'hono/request-id';
import type { AppBindings } from '../env';
import type { Deps } from './deps';

/** Hono generics for this app: Worker bindings + per-request variables. */
export interface AppEnv {
  Bindings: AppBindings;
  Variables: RequestIdVariables & {
    deps: Deps;
    actor: SchoolActor;
  };
}
