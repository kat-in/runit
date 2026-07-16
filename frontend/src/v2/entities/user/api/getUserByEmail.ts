import type { TrpcClient } from '../../../shared/api/trpc';

/** Загружает пользователя по email. */
export const getUserByEmail = (trpc: TrpcClient, email: string) =>
  trpc.users.getUserByEmail.query(email);
