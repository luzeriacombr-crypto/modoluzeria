export type Verse = { text: string; reference: string };

/** Versículos na versão Almeida Revista e Corrigida (ARC). */
const VERSES: Verse[] = [
  { text: "Tudo posso naquele que me fortalece.", reference: "Filipenses 4:13" },
  { text: "Porque para Deus nada é impossível.", reference: "Lucas 1:37" },
  { text: "O Senhor é o meu pastor; nada me faltará.", reference: "Salmos 23:1" },
  { text: "Porque eu bem sei os pensamentos que tenho a vosso respeito, diz o Senhor; pensamentos de paz, e não de mal, para vos dar o fim que esperais.", reference: "Jeremias 29:11" },
  { text: "Tudo tem o seu tempo determinado, e há tempo para todo o propósito debaixo do céu.", reference: "Eclesiastes 3:1" },
  { text: "Entrega o teu caminho ao Senhor; confia nele, e ele o fará.", reference: "Salmos 37:5" },
  { text: "Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus; eu te esforço, e te ajudo.", reference: "Isaías 41:10" },
  { text: "Confia no Senhor de todo o teu coração, e não te estribes no teu próprio entendimento.", reference: "Provérbios 3:5" },
  { text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.", reference: "João 3:16" },
  { text: "Bem-aventurado o homem que não anda segundo o conselho dos ímpios.", reference: "Salmos 1:1" },
  { text: "Alegrai-vos sempre no Senhor; outra vez digo, alegrai-vos.", reference: "Filipenses 4:4" },
  { text: "Não andeis ansiosos por coisa alguma; antes as vossas petições sejam em tudo conhecidas diante de Deus.", reference: "Filipenses 4:6" },
  { text: "E a paz de Deus, que excede todo o entendimento, guardará os vossos corações e os vossos sentimentos em Cristo Jesus.", reference: "Filipenses 4:7" },
  { text: "Esforça-te, e tem bom ânimo; não temas, nem te espantes, porque o Senhor teu Deus é contigo, por onde quer que andares.", reference: "Josué 1:9" },
  { text: "Mas os que esperam no Senhor renovarão as forças, subirão com asas como águias; correrão, e não se cansarão; caminharão, e não se fatigarão.", reference: "Isaías 40:31" },
  { text: "Deleita-te também no Senhor, e ele te concederá os desejos do teu coração.", reference: "Salmos 37:4" },
  { text: "O amor é sofredor, é benigno; o amor não é invejoso; o amor não trata com leviandade, não se ensoberbece.", reference: "1 Coríntios 13:4" },
  { text: "Porque onde estiver o vosso tesouro, aí estará também o vosso coração.", reference: "Mateus 6:21" },
  { text: "Buscai primeiro o reino de Deus, e a sua justiça, e todas estas coisas vos serão acrescentadas.", reference: "Mateus 6:33" },
  { text: "Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.", reference: "Mateus 11:28" },
  { text: "Tudo o que fizerdes, fazei-o de todo o coração, como ao Senhor, e não aos homens.", reference: "Colossenses 3:23" },
  { text: "E sabemos que todas as coisas contribuem juntamente para o bem daqueles que amam a Deus.", reference: "Romanos 8:28" },
  { text: "Não que já a tenha alcançado, ou que seja perfeito; mas vou prosseguindo, para ver se alcanço aquilo para que também fui alcançado por Cristo Jesus.", reference: "Filipenses 3:12" },
  { text: "O Senhor é a minha luz e a minha salvação; a quem temerei?", reference: "Salmos 27:1" },
  { text: "Lâmpada para os meus pés é a tua palavra, e luz para o meu caminho.", reference: "Salmos 119:105" },
  { text: "Porque eu, o Senhor teu Deus, te tomo pela tua mão direita, e te digo: Não temas, eu te ajudo.", reference: "Isaías 41:13" },
  { text: "Graças a Deus pelo seu dom inefável!", reference: "2 Coríntios 9:15" },
  { text: "Sede fortes e corajosos; não temais, nem vos assombreis diante deles, porque o Senhor teu Deus é o que vai contigo.", reference: "Deuteronômio 31:6" },
  { text: "Ele dá força ao cansado, e multiplica as forças ao que não tem nenhum vigor.", reference: "Isaías 40:29" },
  { text: "Porque as armas da nossa milícia não são carnais, mas, sim, poderosas em Deus, para destruição das fortalezas.", reference: "2 Coríntios 10:4" },
  { text: "Regozijai-vos na esperança, sede pacientes na tribulação, perseverai na oração.", reference: "Romanos 12:12" },
  { text: "Mas o fruto do Espírito é: amor, gozo, paz, longanimidade, benignidade, bondade, fé, mansidão, temperança.", reference: "Gálatas 5:22-23" },
  { text: "Este é o dia que fez o Senhor; regozijemo-nos, e alegremo-nos nele.", reference: "Salmos 118:24" },
  { text: "Não vos amoldeis a este mundo, mas transformai-vos pela renovação do vosso entendimento.", reference: "Romanos 12:2" },
  { text: "Se Deus é por nós, quem será contra nós?", reference: "Romanos 8:31" },
  { text: "Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.", reference: "1 Pedro 5:7" },
  { text: "Porque eu sei em quem tenho crido, e estou certo de que é poderoso para guardar o meu depósito até àquele dia.", reference: "2 Timóteo 1:12" },
  { text: "O Senhor te abençoe, e te guarde; o Senhor faça resplandecer o seu rosto sobre ti, e tenha misericórdia de ti.", reference: "Números 6:24-25" },
  { text: "Porque a palavra de Deus é viva, e eficaz, e mais penetrante do que espada alguma de dois gumes.", reference: "Hebreus 4:12" },
  { text: "E conhecereis a verdade, e a verdade vos libertará.", reference: "João 8:32" },
];

/** Mesmo versículo para todos o dia inteiro — rotaciona uma vez ao dia. */
export function getDailyVerse(date: Date = new Date()): Verse {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86_400_000);
  return VERSES[dayOfYear % VERSES.length];
}
