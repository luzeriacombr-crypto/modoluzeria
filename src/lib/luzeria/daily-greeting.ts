export type Greeting = { word: string; language: string; country: string };

const GREETINGS: Greeting[] = [
  { word: "Olá", language: "português", country: "Brasil" },
  { word: "Hello", language: "inglês", country: "Estados Unidos" },
  { word: "Hola", language: "espanhol", country: "Espanha" },
  { word: "Bonjour", language: "francês", country: "França" },
  { word: "Ciao", language: "italiano", country: "Itália" },
  { word: "Hallo", language: "alemão", country: "Alemanha" },
  { word: "こんにちは", language: "japonês", country: "Japão" },
  { word: "안녕하세요", language: "coreano", country: "Coreia do Sul" },
  { word: "你好", language: "mandarim", country: "China" },
  { word: "Привет", language: "russo", country: "Rússia" },
  { word: "مرحبا", language: "árabe", country: "Arábia Saudita" },
  { word: "Hej", language: "sueco", country: "Suécia" },
  { word: "Merhaba", language: "turco", country: "Turquia" },
  { word: "Γειά σου", language: "grego", country: "Grécia" },
  { word: "नमस्ते", language: "hindi", country: "Índia" },
  { word: "Ahoj", language: "tcheco", country: "República Tcheca" },
  { word: "Cześć", language: "polonês", country: "Polônia" },
  { word: "Sawubona", language: "zulu", country: "África do Sul" },
  { word: "Kamusta", language: "filipino", country: "Filipinas" },
  { word: "สวัสดี", language: "tailandês", country: "Tailândia" },
  { word: "Habari", language: "suaíli", country: "Quênia" },
  { word: "שלום", language: "hebraico", country: "Israel" },
  { word: "Xin chào", language: "vietnamita", country: "Vietnã" },
  { word: "Halo", language: "indonésio", country: "Indonésia" },
  { word: "Goddag", language: "dinamarquês", country: "Dinamarca" },
  { word: "Hei", language: "norueguês", country: "Noruega" },
  { word: "Kia ora", language: "maori", country: "Nova Zelândia" },
  { word: "Sannu", language: "hauçá", country: "Nigéria" },
  { word: "Bună", language: "romeno", country: "Romênia" },
  { word: "Szia", language: "húngaro", country: "Hungria" },
  { word: "Dobrý deň", language: "eslovaco", country: "Eslováquia" },
  { word: "Sveiki", language: "lituano", country: "Lituânia" },
  { word: "Tere", language: "estoniano", country: "Estônia" },
  { word: "Molo", language: "xhosa", country: "África do Sul" },
  { word: "Yassou", language: "grego cipriota", country: "Chipre" },
  { word: "Vitejte", language: "tcheco (variante)", country: "Chéquia" },
  { word: "Namaskar", language: "nepalês", country: "Nepal" },
  { word: "Sain baina uu", language: "mongol", country: "Mongólia" },
  { word: "Talofa", language: "samoano", country: "Samoa" },
];

/** Same greeting for everyone all day — rotates once daily, like Flickr's old homepage. */
export function getDailyGreeting(date: Date = new Date()): Greeting {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86_400_000);
  return GREETINGS[dayOfYear % GREETINGS.length];
}
