import type { TrpcClient } from '../../../shared/api/trpc';

/** Удаляет пользователя по id. */
export const deleteUser = (trpc: TrpcClient, id: number) =>
  trpc.users.deleteUser.mutate({ id });
