import { toast } from "sonner";

type DbErrorLike = { message?: string | null; code?: string | null } | null | undefined;

/** Traduz os erros mais comuns do Postgres/Supabase/Auth pra um texto que a
 * pessoa entende e resolve sozinha, sem precisar chamar suporte. Quando não
 * reconhece o erro, usa o fallback — nunca mostra o texto técnico cru na
 * tela. O texto técnico original ainda chega no Sentry via
 * reportHandledError (quem chama isso continua passando o erro original pra
 * lá), então nada se perde pra investigar depois. */
export function friendlyDbError(error: DbErrorLike, fallback: string): string {
  const raw = error?.message ?? "";
  const code = error?.code ?? "";

  // Erro de validação (zod) cruza o server function como uma string JSON
  // crua das issues (ex: '[{"code":"custom","message":"Nome inválido.",
  // "path":["name"]}]') — sem isso a pessoa via esse JSON ilegível na tela
  // em vez da mensagem de verdade.
  if (raw.trim().startsWith("[")) {
    try {
      const issues = JSON.parse(raw);
      if (Array.isArray(issues) && issues.length > 0) {
        const messages = [...new Set(issues.map((i: any) => i?.message).filter(Boolean))];
        if (messages.length > 0) return messages.join(" ");
      }
    } catch {
      // não era JSON de verdade — segue pras checagens normais abaixo
    }
  }

  if (code === "23505" || /duplicate key value violates unique constraint/i.test(raw)) {
    return "Já existe um registro com essas informações.";
  }
  if (code === "23503" || /violates foreign key constraint/i.test(raw)) {
    return "Não deu pra concluir porque isso está ligado a outro registro.";
  }
  if (code === "23502" || /null value in column .* violates not-null constraint/i.test(raw)) {
    return "Faltou preencher um campo obrigatório.";
  }
  if (code === "42501" || /violates row-level security policy/i.test(raw)) {
    return "Você não tem permissão pra fazer essa ação.";
  }
  if (/failed to fetch|network ?error|load failed/i.test(raw)) {
    return "Sem conexão com o servidor. Verifica sua internet e tenta de novo.";
  }
  if (/user already registered/i.test(raw)) {
    return "Já existe uma conta com esse e-mail.";
  }
  if (/password should be at least/i.test(raw)) {
    return "A senha é muito curta — usa pelo menos 6 caracteres.";
  }
  if (/invalid login credentials/i.test(raw)) {
    return "E-mail ou senha incorretos.";
  }
  if (/email not confirmed/i.test(raw)) {
    return "Esse e-mail ainda não foi confirmado.";
  }
  if (/the resource already exists/i.test(raw)) {
    return "Já existe um arquivo com esse nome.";
  }
  if (/payload too large|exceeded the maximum allowed size/i.test(raw)) {
    return "O arquivo é grande demais.";
  }
  if (/invalid mime type|mime type .* is not supported/i.test(raw)) {
    return "Esse tipo de arquivo não é aceito.";
  }
  return fallback;
}

/** Atalho pros onError espalhados pelo app: traduz e já joga no toast. */
export function toastFriendlyError(error: DbErrorLike, fallback: string) {
  toast.error(friendlyDbError(error, fallback));
}
