export type Greeting = { word: string; language: string; countryPhrase: string; flag: string };

const GREETINGS: Greeting[] = [
  { word: "Olá", language: "português", countryPhrase: "do Brasil", flag: "🇧🇷" },
  { word: "Hi", language: "inglês", countryPhrase: "dos Estados Unidos", flag: "🇺🇸" },
  { word: "Hola", language: "espanhol", countryPhrase: "da Espanha", flag: "🇪🇸" },
  { word: "Bonjour", language: "francês", countryPhrase: "da França", flag: "🇫🇷" },
  { word: "Ciao", language: "italiano", countryPhrase: "da Itália", flag: "🇮🇹" },
  { word: "Hallo", language: "alemão", countryPhrase: "da Alemanha", flag: "🇩🇪" },
  { word: "こんにちは", language: "japonês", countryPhrase: "do Japão", flag: "🇯🇵" },
  { word: "안녕하세요", language: "coreano", countryPhrase: "da Coreia do Sul", flag: "🇰🇷" },
  { word: "你好", language: "mandarim", countryPhrase: "da China", flag: "🇨🇳" },
  { word: "Привет", language: "russo", countryPhrase: "da Rússia", flag: "🇷🇺" },
  { word: "مرحبا", language: "árabe", countryPhrase: "da Arábia Saudita", flag: "🇸🇦" },
  { word: "Hej", language: "sueco", countryPhrase: "da Suécia", flag: "🇸🇪" },
  { word: "Merhaba", language: "turco", countryPhrase: "da Turquia", flag: "🇹🇷" },
  { word: "Γειά σου", language: "grego", countryPhrase: "da Grécia", flag: "🇬🇷" },
  { word: "नमस्ते", language: "hindi", countryPhrase: "da Índia", flag: "🇮🇳" },
  { word: "Ahoj", language: "tcheco", countryPhrase: "da República Tcheca", flag: "🇨🇿" },
  { word: "Cześć", language: "polonês", countryPhrase: "da Polônia", flag: "🇵🇱" },
  { word: "Sawubona", language: "zulu", countryPhrase: "da África do Sul", flag: "🇿🇦" },
  { word: "Kamusta", language: "filipino", countryPhrase: "das Filipinas", flag: "🇵🇭" },
  { word: "สวัสดี", language: "tailandês", countryPhrase: "da Tailândia", flag: "🇹🇭" },
  { word: "Habari", language: "suaíli", countryPhrase: "do Quênia", flag: "🇰🇪" },
  { word: "שלום", language: "hebraico", countryPhrase: "de Israel", flag: "🇮🇱" },
  { word: "Xin chào", language: "vietnamita", countryPhrase: "do Vietnã", flag: "🇻🇳" },
  { word: "Halo", language: "indonésio", countryPhrase: "da Indonésia", flag: "🇮🇩" },
  { word: "Goddag", language: "dinamarquês", countryPhrase: "da Dinamarca", flag: "🇩🇰" },
  { word: "Hei", language: "norueguês", countryPhrase: "da Noruega", flag: "🇳🇴" },
  { word: "Kia ora", language: "maori", countryPhrase: "da Nova Zelândia", flag: "🇳🇿" },
  { word: "Sannu", language: "hauçá", countryPhrase: "da Nigéria", flag: "🇳🇬" },
  { word: "Bună", language: "romeno", countryPhrase: "da Romênia", flag: "🇷🇴" },
  { word: "Szia", language: "húngaro", countryPhrase: "da Hungria", flag: "🇭🇺" },
  { word: "Dobrý deň", language: "eslovaco", countryPhrase: "da Eslováquia", flag: "🇸🇰" },
  { word: "Sveiki", language: "lituano", countryPhrase: "da Lituânia", flag: "🇱🇹" },
  { word: "Tere", language: "estoniano", countryPhrase: "da Estônia", flag: "🇪🇪" },
  { word: "Molo", language: "xhosa", countryPhrase: "da África do Sul", flag: "🇿🇦" },
  { word: "Halló", language: "islandês", countryPhrase: "da Islândia", flag: "🇮🇸" },
  { word: "Moi", language: "finlandês", countryPhrase: "da Finlândia", flag: "🇫🇮" },
  { word: "Namaskar", language: "nepalês", countryPhrase: "do Nepal", flag: "🇳🇵" },
  { word: "Sain baina uu", language: "mongol", countryPhrase: "da Mongólia", flag: "🇲🇳" },
  { word: "Talofa", language: "samoano", countryPhrase: "de Samoa", flag: "🇼🇸" },
];

/** Same greeting for everyone all day — rotates once daily, like Flickr's old homepage. */
export function getDailyGreeting(date: Date = new Date()): Greeting {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86_400_000);
  return GREETINGS[dayOfYear % GREETINGS.length];
}
