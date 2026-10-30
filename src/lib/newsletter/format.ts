/** Lista de autoras em pt-BR: "Ana, Bia e Carla" · "Ana, Bia, Carla, Dani e mais 3". */
export function formatAuthorsList(authors: readonly string[], max = 4): string {
  const list = authors.map((a) => a.trim()).filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0]!;
  if (list.length <= max) return `${list.slice(0, -1).join(", ")} e ${list[list.length - 1]}`;
  return `${list.slice(0, max).join(", ")} e mais ${list.length - max}`;
}
