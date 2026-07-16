import type { TrpcClient } from '../../../shared/api/trpc'
import { sampleCode } from '../../../entities/snippet';

/** Создаёт сниппет-пример с указанным языком. */
// TODO: бэкенд возвращает `id?` и `language: string`, а useMutation ожидает строгие типы.
// Временное решение: as Promise<{ id: number }> и language as 'ruby' | 'java' | ...,
// когда бэкенд поправит — убрать.
export const createExampleSnippet = (trpc: TrpcClient, language: string, userId: number) =>
  trpc.snippets.createSnippet.mutate({
    name: `example-${language}`,
    code: sampleCode[language] ?? '',
    language: language as 'ruby' | 'java' | 'php' | 'python' | 'javascript' | 'html',
    userId,
  }) as Promise<{ id: number }>;