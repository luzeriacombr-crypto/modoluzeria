/** Casamento de texto tolerante, usado pela busca global.
 *
 * A versão anterior tratava a frase inteira como UMA string e só fazia
 * comparação exata / começa-com / contém. Na prática isso significava que
 * "pagar asinatura" não achava nada: nenhum rótulo nem palavra-chave contém
 * essa frase literal, e "asinatura" está escrito errado. Aqui a busca passa
 * a quebrar em palavras, ignorar acento, tolerar erro de digitação e casar
 * por radical — "pagar" acha "pagamento", "asinatura" acha "assinatura".
 */

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
}

/** Palavras que não ajudam a distinguir nada — quem digita "onde eu vejo o
 * financeiro" está perguntando por "financeiro", o resto é ruído. */
const STOPWORDS = new Set([
  "a", "o", "as", "os", "um", "uma", "de", "do", "da", "dos", "das", "em", "no",
  "na", "nos", "nas", "pra", "para", "por", "com", "sem", "e", "ou", "que",
  "meu", "minha", "meus", "minhas", "eu", "onde", "como", "quero", "queria",
  "fica", "ficam", "ver", "vejo", "achar", "acho", "abrir", "abre", "ir",
  "tem", "ta", "esta", "isso", "aqui", "la", "mais", "sobre",
]);

export function tokenize(s: string): string[] {
  return normalize(s)
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

/** Distância de edição com teto — para de contar assim que passa do limite,
 * então não paga o custo de comparar palavras que obviamente não casam. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let linhaMin = i;
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + custo);
      if (cur[j] < linhaMin) linhaMin = cur[j];
    }
    if (linhaMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

function prefixoComum(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

/** Quanto uma palavra da busca casa com uma palavra do índice: 0 = não casa,
 * 1 = idêntica. */
export function wordScore(consulta: string, alvo: string): number {
  if (!consulta || !alvo) return 0;
  if (consulta === alvo) return 1;
  // "pag" acha "pagamento"; "assinaturas" acha "assinatura"
  if (alvo.startsWith(consulta)) return 0.92;
  if (consulta.startsWith(alvo) && alvo.length >= 4) return 0.86;
  if (consulta.length >= 4 && alvo.includes(consulta)) return 0.66;

  // Erro de digitação: 1 letra pra palavra curta, 2 pra palavra longa.
  const teto = consulta.length <= 4 ? 1 : 2;
  const d = editDistance(consulta, alvo, teto);
  if (d <= teto) return 0.8 - d * 0.12;

  // Mesmo radical: "pagar"/"pagamento", "assinar"/"assinatura",
  // "cobrar"/"cobrança" — 5 letras iniciais iguais já é sinal forte.
  if (consulta.length >= 5 && alvo.length >= 5 && prefixoComum(consulta, alvo) >= 5) return 0.62;

  return 0;
}

/** Melhor pontuação de uma palavra da busca contra um texto inteiro (que é
 * quebrado em palavras). */
export function bestWordScore(consulta: string, texto: string): number {
  let melhor = 0;
  for (const palavra of normalize(texto).split(/\s+/)) {
    if (!palavra) continue;
    const s = wordScore(consulta, palavra);
    if (s > melhor) melhor = s;
    if (melhor === 1) break;
  }
  return melhor;
}

export type CampoPesado = { texto: string; peso: number };

/**
 * Pontua um conjunto de campos contra a busca. Cada palavra da busca procura
 * seu melhor casamento entre todos os campos; o total é a média ponderada,
 * com bônus quando TODAS as palavras acharam par (quem digita duas palavras
 * espera que as duas contem).
 */
export function scoreFields(campos: CampoPesado[], consulta: string): number {
  const palavras = tokenize(consulta);
  if (palavras.length === 0) return 0;

  let soma = 0;
  let casaram = 0;
  for (const palavra of palavras) {
    let melhor = 0;
    for (const campo of campos) {
      const s = bestWordScore(palavra, campo.texto) * campo.peso;
      if (s > melhor) melhor = s;
    }
    if (melhor > 0) casaram++;
    soma += melhor;
  }
  if (casaram === 0) return 0;

  const media = soma / palavras.length;
  // Casou tudo vale mais que casar metade — evita que uma frase de 3
  // palavras onde só uma bate suba acima de um resultado que bate inteiro.
  const cobertura = casaram / palavras.length;
  return media * (0.55 + 0.45 * cobertura);
}
