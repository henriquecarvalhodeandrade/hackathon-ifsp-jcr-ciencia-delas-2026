import { describe, expect, it } from "vitest";
import {
  avatarFileProblem,
  avatarObjectPath,
  avatarPublicPrefix,
  ownAvatarFileName,
} from "./avatar";

const SUPABASE = "http://127.0.0.1:54321";
const ME = "0b6c3d1e-1111-4222-8333-944455556666";
const OTHER = "9f9f9f9f-aaaa-4bbb-8ccc-dddddddddddd";
const prefix = avatarPublicPrefix(SUPABASE, ME);

describe("avatarObjectPath", () => {
  it("usa a pasta da usuária e a extensão do tipo", () => {
    expect(avatarObjectPath(ME, "image/webp", 1730000000000)).toBe(
      `${ME}/avatar-1730000000000.webp`,
    );
    expect(avatarObjectPath(ME, "image/jpeg", 1730000000000)).toBe(
      `${ME}/avatar-1730000000000.jpg`,
    );
  });
});

describe("ownAvatarFileName", () => {
  it("aceita só a URL pública de um avatar da própria usuária neste projeto", () => {
    expect(ownAvatarFileName(`${prefix}avatar-1730000000000.webp`, SUPABASE, ME)).toBe(
      "avatar-1730000000000.webp",
    );
    expect(ownAvatarFileName(`${prefix}avatar-1730000000000.png`, `${SUPABASE}/`, ME)).toBe(
      "avatar-1730000000000.png",
    );
  });

  it("recusa arquivos de outra pessoa, de outro host ou com nome fora do padrão", () => {
    expect(
      ownAvatarFileName(
        `${avatarPublicPrefix(SUPABASE, OTHER)}avatar-1730000000000.webp`,
        SUPABASE,
        ME,
      ),
    ).toBeNull();
    expect(
      ownAvatarFileName(
        `https://evil.example/storage/v1/object/public/avatars/${ME}/avatar-1730000000000.webp`,
        SUPABASE,
        ME,
      ),
    ).toBeNull();
    expect(
      ownAvatarFileName(`${prefix}../${OTHER}/avatar-1730000000000.webp`, SUPABASE, ME),
    ).toBeNull();
    expect(ownAvatarFileName(`${prefix}avatar-1730000000000.svg`, SUPABASE, ME)).toBeNull();
    expect(ownAvatarFileName(`${prefix}avatar-1730000000000.webp?x=1`, SUPABASE, ME)).toBeNull();
    expect(ownAvatarFileName(`javascript:alert(1)`, SUPABASE, ME)).toBeNull();
    expect(ownAvatarFileName("", SUPABASE, ME)).toBeNull();
  });
});

describe("avatarFileProblem", () => {
  it("aceita PNG, JPG e WebP até 15 MB antes do redimensionamento", () => {
    expect(avatarFileProblem({ type: "image/png", size: 1024 })).toBeNull();
    expect(avatarFileProblem({ type: "image/webp", size: 15 * 1024 * 1024 })).toBeNull();
  });

  it("recusa outros tipos e arquivos enormes", () => {
    expect(avatarFileProblem({ type: "image/svg+xml", size: 100 })).toMatch(/PNG, JPG ou WebP/);
    expect(avatarFileProblem({ type: "image/gif", size: 100 })).toMatch(/PNG, JPG ou WebP/);
    expect(avatarFileProblem({ type: "image/png", size: 15 * 1024 * 1024 + 1 })).toMatch(/15 MB/);
  });
});
