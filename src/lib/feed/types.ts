import type { PostKind } from "./schema";

/** Tipos compartilhados do feed (servidor e cliente). */

export type FeedAuthor = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  career_stage: string | null;
};

export type PortfolioAttachmentView = {
  type: "portfolio";
  id: string;
  kind: string;
  title: string;
  venue: string | null;
  year: number | null;
  /** Só http(s); qualquer outra coisa vira null. */
  url: string | null;
};

export type OpportunityAttachmentView = {
  type: "opportunity";
  id: string;
  kind: string;
  title: string;
  areaName: string | null;
  hasScholarship: boolean;
  scholarshipInfo: string | null;
  isOpen: boolean;
};

export type AttachmentView = PortfolioAttachmentView | OpportunityAttachmentView;

export type FeedPostView = {
  id: string;
  kind: PostKind;
  body: string;
  /** Link externo seguro (http/https) ou null. */
  link: { href: string; host: string } | null;
  createdAt: string;
  edited: boolean;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  /** A usuária atual escreveu a publicação (edita e apaga). */
  isOwner: boolean;
  /** Autora ou moderação (o RLS confere de novo; apagar como moderação fica no Registro). */
  canDelete: boolean;
  /** null quando o perfil não está visível (ex.: conta apagada). */
  author: FeedAuthor | null;
  attachment: AttachmentView | null;
};

export type FeedCommentView = {
  id: string;
  postId: string;
  body: string;
  createdAt: string;
  edited: boolean;
  author: FeedAuthor | null;
  /** A usuária atual escreveu o comentário (edita e apaga). */
  isOwner: boolean;
  /** Autora do comentário, autora da publicação ou moderação (o RLS confere de novo). */
  canDelete: boolean;
};

/** Opção do <select> de anexo no compositor (valor = encodeAttachment). */
export type AttachmentOption = { value: string; label: string };

export type ComposerAttachments = {
  portfolio: AttachmentOption[];
  opportunities: AttachmentOption[];
};

/** Quem está vendo o feed (autora do comentário otimista, avatar do compositor). */
export type FeedViewer = { id: string; name: string; avatarUrl: string | null };
