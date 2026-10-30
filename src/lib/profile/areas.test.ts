import { describe, expect, it } from "vitest";
import { areaIdsForFilter, groupAreas, isBigArea, sortAreas, type ResearchArea } from "./areas";
import {
  avatarFileProblem,
  avatarObjectPath,
  avatarPublicPrefix,
  ownAvatarFileName,
} from "./avatar";

const AREAS: ResearchArea[] = [
  {
    id: 1,
    slug: "ciencias-exatas-e-da-terra",
    name: "Ciências Exatas e da Terra",
    big_area: "Ciências Exatas e da Terra",
  },
  { id: 2, slug: "matematica", name: "Matemática", big_area: "Ciências Exatas e da Terra" },
  {
    id: 5,
    slug: "ciencia-da-computacao",
    name: "Ciência da Computação",
    big_area: "Ciências Exatas e da Terra",
  },
  {
    id: 11,
    slug: "ciencias-biologicas",
    name: "Ciências Biológicas",
    big_area: "Ciências Biológicas",
  },
  { id: 15, slug: "ecologia", name: "Ecologia", big_area: "Ciências Biológicas" },
];

describe("groupAreas", () => {
  it("agrupa por grande área na ordem do catálogo e separa a linha geral", () => {
    const groups = groupAreas([...AREAS].reverse());
    expect(groups.map((g) => g.bigArea)).toEqual([
      "Ciências Exatas e da Terra",
      "Ciências Biológicas",
    ]);
    expect(groups[0]!.general?.id).toBe(1);
    expect(groups[0]!.areas.map((a) => a.id)).toEqual([2, 5]);
    expect(groups[1]!.areas.map((a) => a.slug)).toEqual(["ecologia"]);
  });
});

describe("areaIdsForFilter", () => {
  it("subárea filtra só ela; grande área inclui as subáreas", () => {
    expect(areaIdsForFilter(AREAS, "ecologia")).toEqual([15]);
    expect(areaIdsForFilter(AREAS, "ciencias-exatas-e-da-terra")).toEqual([1, 2, 5]);
    expect(areaIdsForFilter(AREAS, "nao-existe")).toEqual([]);
  });

  it("reconhece a linha de grande área e ordena", () => {
    expect(isBigArea(AREAS[0]!)).toBe(true);
    expect(isBigArea(AREAS[1]!)).toBe(false);
    expect(sortAreas([{ id: 9 }, { id: 3 }]).map((a) => a.id)).toEqual([3, 9]);
  });
});

describe("avatar", () => {
  const uid = "d2000000-0000-4000-8000-000000000001";
  const supabaseUrl = "http://127.0.0.1:54321/";

  it("monta o caminho do objeto e o prefixo público", () => {
    expect(avatarObjectPath(uid, "image/webp", 1761600000000)).toBe(
      `${uid}/avatar-1761600000000.webp`,
    );
    expect(avatarObjectPath(uid, "image/jpeg", 1761600000000)).toBe(
      `${uid}/avatar-1761600000000.jpg`,
    );
    expect(avatarPublicPrefix(supabaseUrl, uid)).toBe(
      `http://127.0.0.1:54321/storage/v1/object/public/avatars/${uid}/`,
    );
  });

  it("aceita só URLs públicas da própria pasta com nome esperado", () => {
    const good = `http://127.0.0.1:54321/storage/v1/object/public/avatars/${uid}/avatar-1761600000000.webp`;
    expect(ownAvatarFileName(good, supabaseUrl, uid)).toBe("avatar-1761600000000.webp");
    expect(
      ownAvatarFileName(
        good.replace(uid, "d1000000-0000-4000-8000-000000000001"),
        supabaseUrl,
        uid,
      ),
    ).toBeNull();
    expect(
      ownAvatarFileName("https://evil.com/avatar-1761600000000.webp", supabaseUrl, uid),
    ).toBeNull();
    expect(ownAvatarFileName(`${good}?x=1`, supabaseUrl, uid)).toBeNull();
    expect(
      ownAvatarFileName(
        `http://127.0.0.1:54321/storage/v1/object/public/avatars/${uid}/../x/avatar-1.webp`,
        supabaseUrl,
        uid,
      ),
    ).toBeNull();
  });

  it("explica problemas no arquivo escolhido", () => {
    expect(avatarFileProblem({ type: "image/gif", size: 10 })).toMatch(/PNG, JPG ou WebP/);
    expect(avatarFileProblem({ type: "image/png", size: 20 * 1024 * 1024 })).toMatch(
      /grande demais/,
    );
    expect(avatarFileProblem({ type: "image/jpeg", size: 500_000 })).toBeNull();
  });
});
