// Nativo · acervo por cliente: a IA olha publicações de um cliente (posts e carrossel) e devolve o perfil
// visual + um acervo de modelos no formato "blocos por região", que o Nativo monta no navegador.
// Este arquivo é só o núcleo (sem banco, sem login): recebe o cliente de IA já escolhido (chave da
// pessoa ou da plataforma) e as imagens. Quem decide quem pode usar é nativo-acervo.server.ts.
import { z } from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type Anthropic from "@anthropic-ai/sdk";
import { explainAiError } from "./ai-client.server";

export const NATIVO_MODEL = "claude-opus-5-5";

// Fontes que o Nativo tem (chave interna → como descrever pra IA). Os nomes aqui são só pra IA escolher.
export const NATIVO_FONTES = {
  classico: "Simples — sans limpa (Instrument Sans 600)",
  leve: "Leve — sans fina e moderna (Inter Tight 400)",
  grotesca: "Grotesca — sans pesada e compacta (Inter Tight 700)",
  geometrica: "Geométrica — sans redonda e forte (Poppins 700)",
  larga: "Larga — sans larga e forte (Montserrat 700)",
  arredondada: "Arredondada — sans gordinha (Nunito 800)",
  moderno: "Estreita — condensada (Barlow Condensed 600)",
  forte: "Pôster — condensada pesada em caixa alta (Anton)",
  literatura: "Livro — serifa clássica de livro (Libre Caslon)",
  editorial: "Editorial — serifa elegante de alto contraste, fina (Instrument Serif)",
  editorialItalico: "Editorial itálico — a mesma, em itálico",
  elegante: "Elegante — serifa itálica marcante (Playfair Display itálico)",
  serifaForte: "Serifa forte — serifa pesada de revista (Playfair Display 800)",
  maquina: "Datilo — máquina de escrever (Courier Prime)",
  caneta: "Caneta — letra de mão casual (Indie Flower)",
  pincel: "Pincel — script de pincel (Yellowtail)",
} as const;
const fonte = z.enum(Object.keys(NATIVO_FONTES) as [keyof typeof NATIVO_FONTES, ...(keyof typeof NATIVO_FONTES)[]]);

const Bloco = z.object({
  papel: z.enum(["titulo", "subtitulo", "corpo", "lista", "chamada", "rotulo", "arroba", "numero"]),
  texto: z.string(),
  estilo: z.enum(["nenhum", "fundo", "suave", "vidro", "etiqueta", "painel", "contorno", "pilula", "balao"]),
  cor: z.string().describe("cor da letra em hex #RRGGBB"),
  cor_fundo: z.string().describe("cor do fundo do texto em hex (#RRGGBB) quando o estilo tem fundo; senão string vazia"),
});
const Slide = z.object({
  fundo_cor: z.string().describe("cor de fundo em hex quando não tem foto (ou por trás da foto)"),
  foto: z.enum(["nenhuma", "cheia"]),
  escurecer: z.number().describe("0 a 60: véu escuro por cima da foto pra o texto ler bem"),
  degrade: z.number().describe("0 a 80: degradê escuro de baixo pra cima (como a foto com texto na base)"),
  monograma: z.boolean().describe("marca d'água grande e clarinha do logo/monograma da marca no fundo"),
  regiao: z.enum(["topo", "meio", "base"]),
  alinhamento: z.enum(["esquerda", "centro"]),
  blocos: z.array(Bloco),
  assinatura: z.enum(["nenhuma", "arroba", "logo"]),
});
const Post = z.object({
  nome: z.string().describe("nome curto do modelo, ex.: 'Frase com foto na base'"),
  objetivo: z.string().describe("pra que serve este post, em uma frase"),
  tipo: z.enum(["post", "carrossel"]),
  slides: z.array(Slide),
});
export const AcervoSchema = z.object({
  perfil: z.object({
    marca: z.string(),
    arroba: z.string(),
    nicho: z.string(),
    tom_de_voz: z.string(),
    temas: z.array(z.string()),
    paleta: z.array(z.object({ hex: z.string(), uso: z.string() })),
    fonte_titulo: fonte,
    fonte_texto: fonte,
    elementos_visuais: z.array(z.string()),
    nao_da_pra_fazer_ainda: z.array(z.string()).describe("recursos vistos nas referências que o Nativo ainda não tem"),
  }),
  posts: z.array(Post),
});
export type Acervo = z.infer<typeof AcervoSchema>;

function sistema(temLogo: boolean) {
  return `Você é designer e social media de uma agência brasileira. Vai analisar publicações reais de um cliente e montar um acervo de modelos de post pro editor "Nativo".

O que o Nativo consegue fazer (use só isto):
- Formato post de feed 4:5 (1080×1350). Fundo de cor sólida OU foto cheia (a pessoa troca pela dela depois), com véu escuro ("escurecer") e degradê escuro na base.
- Marca d'água do monograma/logo da marca, grande e clarinha, no fundo ("monograma"). ${temLogo ? "A marca TEM logo cadastrado: pode usar monograma e assinatura \"logo\"." : "A marca NÃO tem logo cadastrado: use monograma=false e assinatura \"arroba\" ou \"nenhuma\"."}
- Blocos de texto empilhados numa região (topo, meio ou base), alinhados à esquerda ou ao centro. O Nativo calcula tamanhos e espaçamentos.
- Papéis dos blocos: titulo (grande), subtitulo, corpo, lista (itens em linhas separadas com \\n), chamada (CTA curto), rotulo (palavra pequena acima do título), arroba (@ do perfil, pequeno), numero (número grande, ex. "01").
- Estilos de texto: nenhum (só a letra), fundo (caixa atrás do texto), suave (caixa translúcida), vidro (vidro fosco), etiqueta (faixa por linha), painel (cartão arredondado atrás de um bloco grande de texto — bom pra listas e explicações), contorno (letra com contorno), pilula (cápsula redonda), balao (balão de fala).
- Fontes disponíveis (escolha pela semelhança com a identidade do cliente):
${Object.entries(NATIVO_FONTES).map(([k, v]) => `  ${k}: ${v}`).join("\n")}
- Assinatura no rodapé: nenhuma, arroba ou logo.

Regras:
- As imagens vêm identificadas: primeiro os "posts estáticos" e depois os slides de UM "carrossel", na ordem. Use todas pra entender a identidade e a linguagem.
- Textos NOVOS em português do Brasil, na linguagem e no tom do cliente — não copie frases das referências.
- Mantenha a identidade: mesma paleta (hex exatos tirados das imagens), mesmas fontes equivalentes, mesmo jeito de compor.
- Varie os formatos: frase forte com foto, pergunta provocativa, explicação em lista, mito × verdade, bastidores, chamada pra agendar etc.
- Títulos curtos (até ~6 palavras), corpo enxuto. Contraste bom entre texto e fundo.
- Área da saúde/estética: nada de promessa de resultado, antes e depois, preço ou "o melhor"; tom educativo e acolhedor.
- Não imite interface de app de terceiros (nada de "< Notas", "OK", barras de ferramentas de apps). Um cartão "painel" com o texto resolve.
- Carrossel: capa forte, slides de conteúdo e um slide final com chamada.
- Monte 7 posts estáticos e 3 carrosséis (de 4 a 6 slides cada).
- Liste em nao_da_pra_fazer_ainda os recursos das referências que o Nativo ainda não tem (ex.: moldura de foto tipo polaroid, palavras em negrito dentro de um parágrafo).`;
}

export type ImagemRef = { tipo: "post" | "carrossel"; mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string };

export async function gerarAcervo(
  ai: Anthropic,
  p: { cliente: string; arroba?: string; temLogo: boolean; imagens: ImagemRef[] },
): Promise<{ acervo: Acervo; input: number; output: number }> {
  const posts = p.imagens.filter((i) => i.tipo === "post");
  const slides = p.imagens.filter((i) => i.tipo === "carrossel");
  const content: any[] = [];
  posts.forEach((im, k) => {
    content.push({ type: "text", text: `Post estático ${k + 1} de ${posts.length}:` });
    content.push({ type: "image", source: { type: "base64", media_type: im.mediaType, data: im.data } });
  });
  slides.forEach((im, k) => {
    content.push({ type: "text", text: `Carrossel — slide ${k + 1} de ${slides.length}:` });
    content.push({ type: "image", source: { type: "base64", media_type: im.mediaType, data: im.data } });
  });
  content.push({
    type: "text",
    text: `Cliente: "${p.cliente}"${p.arroba ? ` (${p.arroba})` : ""}. Acima: ${posts.length} posts estáticos e 1 carrossel de ${slides.length} slides. Analise a identidade e monte o acervo.`,
  });

  const body: any = {
    model: NATIVO_MODEL,
    max_tokens: 16000,
    output_config: { effort: "high", format: zodOutputFormat(AcervoSchema) },
    system: sistema(p.temLogo),
    messages: [{ role: "user", content }],
  };

  let res: any;
  try {
    // Com a proteção de recusa do Claude ligada (se o modelo recusar por política, a API tenta o modelo de reserva).
    res = await (ai as any).beta.messages.parse({ ...body, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
  } catch (e: any) {
    // Chave/conta sem acesso a esse recurso beta: tenta de novo sem ele (o erro da chave em si é explicado abaixo).
    if (e?.status === 400 && /fallback|beta/i.test(String(e?.message ?? ""))) {
      try { res = await (ai as any).messages.parse(body); } catch (e2: any) { throw new Error(explainAiError(e2)); }
    } else throw new Error(explainAiError(e));
  }
  if (res.stop_reason === "refusal") throw new Error("A IA recusou analisar essas imagens. Tente com outras publicações do cliente.");
  if (res.stop_reason === "max_tokens") throw new Error("A resposta da IA veio cortada. Tente de novo.");
  const acervo = res.parsed_output as Acervo | null;
  if (!acervo || !Array.isArray(acervo.posts) || acervo.posts.length === 0) throw new Error("A IA devolveu algo fora do formato esperado. Tente de novo.");
  return { acervo, input: res.usage?.input_tokens ?? 0, output: res.usage?.output_tokens ?? 0 };
}
