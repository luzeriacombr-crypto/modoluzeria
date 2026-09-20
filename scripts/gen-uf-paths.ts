/**
 * Gera src/lib/luzeria/brazil-uf-paths.ts a partir da malha oficial de UFs do
 * IBGE. Roda uma vez só — o resultado é commitado; nada disso acontece em
 * runtime.
 *
 *   bun scripts/gen-uf-paths.ts
 *
 * TOL (graus) controla a simplificação e MIN_AREA o descarte de ilhas.
 */
import { writeFileSync } from "fs";

const CODE_TO_UF: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
  "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
  "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
  "41": "PR", "42": "SC", "43": "RS",
  "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};

const UF_NAMES_SRC: Record<string, string> = {
  RO: "Rondônia", AC: "Acre", AM: "Amazonas", RR: "Roraima", PA: "Pará", AP: "Amapá", TO: "Tocantins",
  MA: "Maranhão", PI: "Piauí", CE: "Ceará", RN: "Rio Grande do Norte", PB: "Paraíba", PE: "Pernambuco",
  AL: "Alagoas", SE: "Sergipe", BA: "Bahia",
  MG: "Minas Gerais", ES: "Espírito Santo", RJ: "Rio de Janeiro", SP: "São Paulo",
  PR: "Paraná", SC: "Santa Catarina", RS: "Rio Grande do Sul",
  MS: "Mato Grosso do Sul", MT: "Mato Grosso", GO: "Goiás", DF: "Distrito Federal",
};

type Pt = [number, number];

// Douglas-Peucker em graus — o suficiente pra tirar o ruído de costa sem
// descaracterizar o contorno de nenhum estado.
function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts;
  const sqTol = tol * tol;
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxSq = 0;
    let idx = -1;
    const [x1, y1] = pts[first];
    const [x2, y2] = pts[last];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = dx * dx + dy * dy;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = pts[i];
      let t = len ? ((px - x1) * dx + (py - y1) * dy) / len : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x1 + t * dx - px;
      const ey = y1 + t * dy - py;
      const sq = ex * ex + ey * ey;
      if (sq > maxSq) { maxSq = sq; idx = i; }
    }
    if (maxSq > sqTol && idx > 0) {
      keep[idx] = true;
      stack.push([first, idx], [idx, last]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

function ringArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  }
  return Math.abs(a / 2);
}

const TOL = Number(process.env.TOL ?? 0.035);
// Ilhas oceânicas pequenas (Fernando de Noronha, Trindade, Abrolhos…) só
// esticam o enquadramento — o mapa fica melhor sem elas.
const MIN_AREA = Number(process.env.MIN_AREA ?? 0.03);

const IBGE_URL =
  "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&intrarregiao=UF&qualidade=intermediaria";
const gj = await fetch(IBGE_URL).then((r) => r.json());

// 1) Extrai os anéis externos de cada UF, já simplificados e filtrados.
const ufRings = new Map<string, Pt[][]>();
for (const f of gj.features) {
  const uf = CODE_TO_UF[f.properties.codarea];
  if (!uf) throw new Error(`código IBGE sem UF: ${f.properties.codarea}`);
  const polys: Pt[][][] = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rings: Pt[][] = [];
  for (const poly of polys) {
    const outer = poly[0] as Pt[];
    if (ringArea(outer) < MIN_AREA) continue;
    const s = simplify(outer, TOL);
    if (s.length >= 4) rings.push(s);
  }
  if (!rings.length) throw new Error(`UF sem anel visível: ${uf}`);
  ufRings.set(uf, rings);
}

// 2) Mercator, que é como todo mundo está acostumado a ver o Brasil.
// Em "graus", pra ficar na mesma escala da longitude.
const merc = (lat: number) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const rings of ufRings.values()) {
  for (const r of rings) for (const [lon, lat] of r) {
    const y = -merc(lat);
    if (lon < minX) minX = lon;
    if (lon > maxX) maxX = lon;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
}
const W = 1000;
const scale = W / (maxX - minX);
const H = Math.round((maxY - minY) * scale);

// 3) Vira path SVG com 1 casa decimal — mais que isso é peso à toa num
// desenho de 1000px de largura.
const paths: Record<string, string> = {};
for (const [uf, rings] of ufRings) {
  paths[uf] = rings.map((r) =>
    r.map(([lon, lat], i) => {
      const x = ((lon - minX) * scale).toFixed(1);
      const y = ((-merc(lat) - minY) * scale).toFixed(1);
      return `${i ? "L" : "M"}${x} ${y}`;
    }).join("") + "Z"
  ).join("");
}

const order = Object.values(CODE_TO_UF);
const out = `// GERADO AUTOMATICAMENTE — não edite à mão.
// Fonte: malha territorial de UFs do IBGE (qualidade intermediária),
// simplificada (tolerância ${TOL}°) e projetada em Mercator.
// Regenerar: veja o script em scripts/gen-uf-paths.ts.

export const BRAZIL_MAP_VIEWBOX = "0 0 ${W} ${H}";

export const UF_NAMES: Record<string, string> = {
${order.map((uf) => `  ${uf}: "${UF_NAMES_SRC[uf]}",`).join("\n")}
};

/** Contorno de cada UF, no viewBox acima. */
export const UF_PATHS: Record<string, string> = {
${order.map((uf) => `  ${uf}: "${paths[uf]}",`).join("\n")}
};

export const UF_LIST = Object.keys(UF_PATHS);
`;

writeFileSync("src/lib/luzeria/brazil-uf-paths.ts", out);
console.log(`viewBox 0 0 ${W} ${H} — ${(out.length / 1024).toFixed(1)} KB`);
for (const uf of order) console.log(`  ${uf}: ${(paths[uf].length / 1024).toFixed(1)} KB`);
