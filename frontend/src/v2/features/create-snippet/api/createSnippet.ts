import type { TrpcClient } from '../../../shared/api/trpc'
import { type FormData } from '../types'

/** Запрашивает сгенерированное случайное имя сниппета у бэкенда. */
export const generateSnippetName = ( trpc: TrpcClient ) => trpc.snippets.generateSnippetName.query();
  
/** Создаёт сниппет на бэкенде с переданными данными формы. */
export const createSnippet = (trpc: TrpcClient, data: FormData ) => trpc.snippets.createSnippet.mutate(data)
