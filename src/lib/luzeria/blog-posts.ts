/** Tipos do conteúdo do blog — o conteúdo em si mora na tabela blog_posts
 * (banco), não mais hardcoded aqui. Ver blog-admin.functions.ts pro CRUD e
 * blog-ai-format.ts pro conversor de texto formatado por IA nesses blocos. */

export type BlogBlock =
  | { type: "lead"; text: string }
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "quote"; text: string }
  | { type: "callout"; title?: string; text: string }
  | { type: "list"; items: string[] }
  | { type: "rankedList"; items: { title: string; text: string }[] };
