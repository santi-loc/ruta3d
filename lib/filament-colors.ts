export const filamentColorOptions = [
  "Negro", "Blanco", "Gris", "Rojo", "Naranja", "Amarillo", "Verde", "Azul", "Natural",
] as const;

export type FilamentColor = (typeof filamentColorOptions)[number];

type ColorMatch = {
  color: FilamentColor;
  confidence: "declarado" | "normalizado";
};

const declaredColorAliases: Array<[FilamentColor, string[]]> = [
  ["Negro", ["negro", "black"]], ["Blanco", ["blanco", "white"]], ["Gris", ["gris", "gray", "grey"]],
  ["Rojo", ["rojo", "red"]], ["Naranja", ["naranja", "orange"]], ["Amarillo", ["amarillo", "yellow"]],
  ["Verde", ["verde", "green"]], ["Azul", ["azul", "blue"]],
  // Natural es un acabado propio del filamento; no equivale a blanco.
  ["Natural", ["natural"]],
];

const normalizedColorAliases: Array<[FilamentColor, string[]]> = [
  ["Negro", ["onyx", "carbon", "midnight"]], ["Blanco", ["ivory", "marfil"]], ["Gris", ["silver", "plata"]],
  ["Rojo", ["crimson", "scarlet"]], ["Naranja", ["coral"]], ["Verde", ["lime", "olive", "oliva"]],
  ["Azul", ["sky", "ocean", "cielo"]],
];

function includesWholeAlias(text: string, alias: string) {
  return new RegExp(`(^|[^a-z0-9])${alias}($|[^a-z0-9])`, "i").test(text);
}

export function detectFilamentColor(text: string): ColorMatch | null {
  return detectFilamentColors(text)[0] ?? null;
}

export function detectFilamentColors(text: string): ColorMatch[] {
  const matches: ColorMatch[] = [];

  for (const [color, aliases] of declaredColorAliases) {
    if (aliases.some((alias) => includesWholeAlias(text, alias))) {
      matches.push({ color, confidence: "declarado" });
    }
  }
  for (const [color, aliases] of normalizedColorAliases) {
    if (!matches.some((match) => match.color === color) && aliases.some((alias) => includesWholeAlias(text, alias))) {
      matches.push({ color, confidence: "normalizado" });
    }
  }

  return matches;
}
