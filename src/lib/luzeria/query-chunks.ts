/** `.in("id", ids)` vira parte da URL do PostgREST: com ~300+ ids ela passa do limite e o Supabase recusa a consulta.
 * Quem tem centenas de itens atribuídos (histórico de meses) via lista vazia e zeros na produtividade, sem erro nenhum.
 * Roda a consulta em blocos e junta o resultado; se algum bloco falhar, o erro sobe (em vez de virar lista vazia). */
export async function queryInChunks<T>(
  ids: string[],
  run: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  size = 100,
): Promise<T[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
  const parts = await Promise.all(chunks.map(async (c) => {
    const { data, error } = await run(c);
    if (error) throw new Error(error.message);
    return data ?? [];
  }));
  return parts.flat();
}
