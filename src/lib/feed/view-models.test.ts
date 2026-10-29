import { describe, expect, it } from "vitest";
import {
  externalLink,
  opportunityOption,
  portfolioOption,
  toCommentView,
  toPostView,
  type CommentRow,
  type PostRow,
} from "./view-models";

const ME = "d1000000-0000-4000-8000-000000000001";
const OTHER = "d2000000-0000-4000-8000-000000000002";
const POST_ID = "e1000000-0000-4000-8000-000000000001";
const ITEM_ID = "f1000000-0000-4000-8000-000000000001";

const author = {
  id: OTHER,
  full_name: "Marina Souza",
  avatar_url: null,
  headline: "Docente de Física",
  career_stage: "professor",
};

function postRow(overrides: Partial<PostRow> = {}): PostRow {
  return {
    id: POST_ID,
    author_id: OTHER,
    kind: "project",
    body: "Novo projeto!",
    link_url: null,
    like_count: 3,
    comment_count: 1,
    created_at: "2026-10-28T12:00:00+00:00",
    updated_at: "2026-10-28T12:00:00+00:00",
    author,
    portfolio_item: null,
    opportunity: null,
    ...overrides,
  };
}

describe("externalLink", () => {
  it("aceita http(s) e mostra o domínio sem www", () => {
    expect(externalLink("https://www.scielo.br/j/abc")).toEqual({
      href: "https://www.scielo.br/j/abc",
      host: "scielo.br",
    });
  });

  it("descarta esquemas perigosos, vazios e lixo", () => {
    expect(externalLink("javascript:alert(1)")).toBeNull();
    expect(externalLink("data:text/html,oi")).toBeNull();
    expect(externalLink("não é link")).toBeNull();
    expect(externalLink(null)).toBeNull();
  });
});

describe("toPostView", () => {
  it("monta a publicação com curtida, autoria e contadores", () => {
    const view = toPostView(postRow({ link_url: "https://exemplo.org/x" }), {
      viewerId: ME,
      likedIds: new Set([POST_ID]),
    });
    expect(view).toMatchObject({
      id: POST_ID,
      kind: "project",
      likeCount: 3,
      commentCount: 1,
      likedByMe: true,
      isOwner: false,
      canDelete: false,
      edited: false,
      link: { href: "https://exemplo.org/x", host: "exemplo.org" },
      author: { id: OTHER, full_name: "Marina Souza" },
      attachment: null,
    });
  });

  it("marca a própria publicação, editada, e protege tipo e contadores", () => {
    const view = toPostView(
      postRow({
        author_id: ME,
        kind: "outro",
        like_count: -1,
        updated_at: "2026-10-28T12:05:00+00:00",
      }),
      { viewerId: ME, likedIds: new Set() },
    );
    expect(view.isOwner).toBe(true);
    expect(view.canDelete).toBe(true);
    expect(view.kind).toBe("update");
    expect(view.likeCount).toBe(0);
    expect(view.edited).toBe(true);
    expect(view.likedByMe).toBe(false);
  });

  it("anexo de portfólio: só link http(s)", () => {
    const view = toPostView(
      postRow({
        portfolio_item: {
          id: ITEM_ID,
          kind: "article",
          title: "Artigo",
          venue: "Revista",
          year: 2025,
          url: "javascript:alert(1)",
        },
      }),
      { viewerId: ME, likedIds: new Set() },
    );
    expect(view.attachment).toEqual({
      type: "portfolio",
      id: ITEM_ID,
      kind: "article",
      title: "Artigo",
      venue: "Revista",
      year: 2025,
      url: null,
    });
  });

  it("anexo de vaga: área, bolsa e status", () => {
    const view = toPostView(
      postRow({
        opportunity: {
          id: ITEM_ID,
          kind: "ic",
          title: "IC em astrofísica",
          has_scholarship: true,
          scholarship_info: "PIBIC",
          status: "closed",
          area: { name: "Física" },
        },
      }),
      { viewerId: ME, likedIds: new Set() },
    );
    expect(view.attachment).toEqual({
      type: "opportunity",
      id: ITEM_ID,
      kind: "ic",
      title: "IC em astrofísica",
      areaName: "Física",
      hasScholarship: true,
      scholarshipInfo: "PIBIC",
      isOpen: false,
    });
  });
});

describe("moderação", () => {
  it("apaga publicações e comentários de outras pessoas, sem virar autora", () => {
    const post = toPostView(postRow(), {
      viewerId: ME,
      likedIds: new Set(),
      viewerIsModerator: true,
    });
    expect(post.isOwner).toBe(false);
    expect(post.canDelete).toBe(true);
    const comment = toCommentView(
      {
        id: ITEM_ID,
        post_id: POST_ID,
        author_id: OTHER,
        body: "Oi",
        created_at: "2026-10-28T12:00:00+00:00",
        updated_at: "2026-10-28T12:00:00+00:00",
        author,
      },
      { viewerId: ME, postAuthorId: OTHER, viewerIsModerator: true },
    );
    expect(comment.isOwner).toBe(false);
    expect(comment.canDelete).toBe(true);
  });
});

describe("toCommentView", () => {
  const comment: CommentRow = {
    id: ITEM_ID,
    post_id: POST_ID,
    author_id: OTHER,
    body: "Parabéns!",
    created_at: "2026-10-28T12:00:00+00:00",
    updated_at: "2026-10-28T12:00:00+00:00",
    author,
  };

  it("autora do comentário edita e apaga", () => {
    const view = toCommentView(
      { ...comment, author_id: ME },
      { viewerId: ME, postAuthorId: OTHER },
    );
    expect(view.isOwner).toBe(true);
    expect(view.canDelete).toBe(true);
  });

  it("autora da publicação só apaga", () => {
    const view = toCommentView(comment, { viewerId: ME, postAuthorId: ME });
    expect(view.isOwner).toBe(false);
    expect(view.canDelete).toBe(true);
  });

  it("as demais não editam nem apagam", () => {
    const view = toCommentView(comment, { viewerId: ME, postAuthorId: OTHER });
    expect(view.isOwner).toBe(false);
    expect(view.canDelete).toBe(false);
  });
});

describe("opções de anexo", () => {
  it("rotula itens do portfólio e vagas", () => {
    expect(
      portfolioOption({ id: ITEM_ID, kind: "award", title: "Prêmio Jovem Cientista", year: 2024 }),
    ).toEqual({
      value: `portfolio:${ITEM_ID}`,
      label: "Prêmio · Prêmio Jovem Cientista (2024)",
    });
    expect(
      portfolioOption({ id: ITEM_ID, kind: "project", title: "Robótica", year: null }).label,
    ).toBe("Projeto · Robótica");
    expect(
      opportunityOption({ id: ITEM_ID, kind: "tcc", title: "TCC em IA", status: "closed" }),
    ).toEqual({
      value: `opportunity:${ITEM_ID}`,
      label: "TCC · TCC em IA (encerrada)",
    });
  });
});
