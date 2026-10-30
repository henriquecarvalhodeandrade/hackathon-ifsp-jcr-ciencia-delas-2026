import { describe, expect, it } from "vitest";
import {
  AVAILABILITY_MARKER,
  EMPTY_PROFILE_VALUES,
  TRAJECTORY_MARKER,
  profileToFormValues,
  readSectionValues,
  updateToFormValues,
} from "./form-values";
import { missingOnboardingStep, parseProfileSection, uniqueTags } from "./schemas";

function form(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [key, value] of entries) fd.append(key, value);
  return fd;
}

describe("seção Sobre você", () => {
  it("valida e converte vazios em null", () => {
    const result = parseProfileSection("sobre", {
      full_name: "  Ana Clara Souza ",
      pronouns: "ela/dela",
      headline: "",
      institution: "IFSP — Câmpus Jacareí",
      city: " Jacareí ",
      state: "SP",
      career_stage: "undergraduate",
    });
    expect(result).toEqual({
      success: true,
      update: {
        full_name: "Ana Clara Souza",
        pronouns: "ela/dela",
        headline: null,
        institution: "IFSP — Câmpus Jacareí",
        city: "Jacareí",
        state: "SP",
        career_stage: "undergraduate",
      },
    });
  });

  it("aponta nome curto, fase ausente e UF inválida", () => {
    const result = parseProfileSection("sobre", {
      ...EMPTY_PROFILE_VALUES,
      full_name: "A",
      state: "ZZ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.full_name?.[0]).toMatch(/nome completo/);
      expect(result.fieldErrors.career_stage?.[0]).toMatch(/fase da carreira/);
      expect(result.fieldErrors.state?.[0]).toMatch(/estado/);
    }
  });

  it("respeita os limites de tamanho do banco", () => {
    const result = parseProfileSection("sobre", {
      ...EMPTY_PROFILE_VALUES,
      full_name: "Ana Souza",
      career_stage: "phd",
      headline: "x".repeat(161),
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors.headline?.[0]).toMatch(/160/);
  });
});

describe("seção Sua pesquisa", () => {
  it("devolve áreas (sem repetição) e links normalizados", () => {
    const result = parseProfileSection("pesquisa", {
      area_ids: ["5", "12", "5"],
      keywords: ["Visão Computacional", " python ", "visão computacional", ""],
      bio: "Pesquiso visão computacional.",
      lattes_url: "lattes.cnpq.br/123",
      orcid: "https://orcid.org/0000-0002-1825-0097",
      linkedin_url: "",
      website_url: "",
    });
    expect(result).toEqual({
      success: true,
      areaIds: [5, 12],
      update: {
        keywords: ["visão computacional", "python"],
        bio: "Pesquiso visão computacional.",
        lattes_url: "https://lattes.cnpq.br/123",
        orcid: "0000-0002-1825-0097",
        linkedin_url: null,
        website_url: null,
      },
    });
  });

  it("exige de 1 a 5 áreas e no máximo 15 palavras-chave", () => {
    const none = parseProfileSection("pesquisa", { ...EMPTY_PROFILE_VALUES, area_ids: [] });
    expect(none.success).toBe(false);
    if (!none.success) expect(none.fieldErrors.area_ids?.[0]).toMatch(/pelo menos uma/);

    const many = parseProfileSection("pesquisa", {
      ...EMPTY_PROFILE_VALUES,
      area_ids: ["1", "2", "3", "4", "5", "6"],
      keywords: Array.from({ length: 16 }, (_, i) => `tema ${i}`),
    });
    expect(many.success).toBe(false);
    if (!many.success) {
      expect(many.fieldErrors.area_ids?.[0]).toMatch(/no máximo 5/);
      expect(many.fieldErrors.keywords?.[0]).toMatch(/15/);
    }
  });

  it("recusa ids de área que não são números e links inválidos", () => {
    const result = parseProfileSection("pesquisa", {
      ...EMPTY_PROFILE_VALUES,
      area_ids: ["1; drop"],
      lattes_url: "https://evil.com",
      orcid: "0000-0002-1825-0098",
      website_url: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.area_ids).toBeDefined();
      expect(result.fieldErrors.lattes_url?.[0]).toMatch(/Lattes/);
      expect(result.fieldErrors.orcid?.[0]).toMatch(/não confere/);
      expect(result.fieldErrors.website_url?.[0]).toMatch(/https/);
    }
  });
});

describe("seção Mentoria", () => {
  const base = { ...EMPTY_PROFILE_VALUES };

  it("sem participar da mentoria só grava as duas chaves", () => {
    const result = parseProfileSection("mentoria", {
      ...base,
      mentorship_topics: [],
      meeting_formats: [],
      languages: [],
      mentoring_offer: "texto antigo que não deve ser apagado",
    });
    expect(result).toEqual({
      success: true,
      update: { seeks_mentorship: false, is_mentor: false },
    });
  });

  it("mentoranda grava objetivos e preferências", () => {
    const result = parseProfileSection("mentoria", {
      ...base,
      seeks_mentorship: true,
      mentoring_goals: "Quero publicar meu primeiro artigo.",
      mentorship_topics: ["escrita-cientifica", "bolsas-editais"],
      meeting_formats: ["online"],
      languages: ["pt", "en"],
    });
    expect(result).toEqual({
      success: true,
      update: {
        seeks_mentorship: true,
        is_mentor: false,
        mentoring_goals: "Quero publicar meu primeiro artigo.",
        mentorship_topics: ["escrita-cientifica", "bolsas-editais"],
        meeting_formats: ["online"],
        languages: ["pt", "en"],
      },
    });
  });

  it("mentora precisa contar como ajuda e informar vagas válidas", () => {
    const result = parseProfileSection("mentoria", {
      ...base,
      is_mentor: true,
      mentoring_offer: "curto",
      mentor_capacity: "50",
      mentorship_topics: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.mentoring_offer?.[0]).toMatch(/20 caracteres/);
      expect(result.fieldErrors.mentor_capacity?.[0]).toMatch(/entre 1 e 20/);
      expect(result.fieldErrors.mentorship_topics?.[0]).toMatch(/pelo menos um tema/);
    }
  });

  it("mentora válida grava oferta, vagas e disponibilidade quando enviada", () => {
    const result = parseProfileSection("mentoria", {
      ...base,
      is_mentor: true,
      mentoring_offer: "Ajudo com escrita de projetos e editais da FAPESP.",
      mentor_capacity: "3",
      mentor_available: false,
      mentorship_topics: ["bolsas-editais"],
      meeting_formats: ["online", "hybrid"],
      languages: ["pt"],
    });
    expect(result).toEqual({
      success: true,
      update: {
        seeks_mentorship: false,
        is_mentor: true,
        mentoring_offer: "Ajudo com escrita de projetos e editais da FAPESP.",
        mentor_capacity: 3,
        mentor_available: false,
        mentorship_topics: ["bolsas-editais"],
        meeting_formats: ["online", "hybrid"],
        languages: ["pt"],
      },
    });
  });

  it("recusa temas, formatos e idiomas fora do catálogo", () => {
    const result = parseProfileSection("mentoria", {
      ...base,
      seeks_mentorship: true,
      mentorship_topics: ["astrologia"],
      meeting_formats: ["telepatia"],
      languages: ["klingon"],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.mentorship_topics).toBeDefined();
      expect(result.fieldErrors.meeting_formats).toBeDefined();
      expect(result.fieldErrors.languages).toBeDefined();
    }
  });
});

describe("seção Privacidade e IA", () => {
  it("grava o consentimento", () => {
    expect(parseProfileSection("privacidade", { ai_consent: true })).toEqual({
      success: true,
      update: { ai_consent: true },
    });
  });
});

describe("readSectionValues", () => {
  it("lê checkboxes, listas e a marca de disponibilidade", () => {
    const withMarker = readSectionValues(
      "mentoria",
      form([
        ["is_mentor", "on"],
        ["mentorship_topics", "networking"],
        ["mentorship_topics", "oratoria"],
        [AVAILABILITY_MARKER, "1"],
      ]),
    );
    expect(withMarker.is_mentor).toBe(true);
    expect(withMarker.seeks_mentorship).toBe(false);
    expect(withMarker.mentorship_topics).toEqual(["networking", "oratoria"]);
    expect(withMarker.mentor_available).toBe(false);

    const withoutMarker = readSectionValues("mentoria", form([["is_mentor", "on"]]));
    expect(withoutMarker).not.toHaveProperty("mentor_available");
  });

  it("lê só os campos da seção", () => {
    const values = readSectionValues(
      "sobre",
      form([
        ["full_name", "Ana"],
        ["bio", "não é desta seção"],
      ]),
    );
    expect(values).toMatchObject({ full_name: "Ana", city: "" });
    expect(values).not.toHaveProperty("bio");
  });
});

describe("profileToFormValues", () => {
  it("converte nulls em strings vazias e mantém padrões úteis", () => {
    const values = profileToFormValues(
      {
        full_name: "Ana",
        pronouns: null,
        headline: null,
        institution: null,
        city: null,
        state: "SP",
        career_stage: null,
        keywords: [],
        bio: null,
        lattes_url: null,
        orcid: null,
        linkedin_url: null,
        website_url: null,
        seeks_mentorship: false,
        is_mentor: false,
        mentoring_goals: null,
        mentoring_offer: null,
        mentor_capacity: 0,
        mentor_available: true,
        mentorship_topics: [],
        meeting_formats: [],
        languages: [],
        ai_consent: false,
      },
      [3, 7],
    );
    expect(values.area_ids).toEqual(["3", "7"]);
    expect(values.career_stage).toBe("");
    expect(values.mentor_capacity).toBe("2");
    expect(values.meeting_formats).toEqual(["online"]);
    expect(values.languages).toEqual(["pt"]);
  });
});

describe("missingOnboardingStep e uniqueTags", () => {
  it("aponta a etapa incompleta", () => {
    expect(missingOnboardingStep({ full_name: "", career_stage: "phd", areaCount: 1 })?.step).toBe(
      1,
    );
    expect(
      missingOnboardingStep({ full_name: "Ana Souza", career_stage: null, areaCount: 1 })?.step,
    ).toBe(1);
    expect(
      missingOnboardingStep({ full_name: "Ana Souza", career_stage: "phd", areaCount: 0 })?.step,
    ).toBe(2);
    expect(
      missingOnboardingStep({ full_name: "Ana Souza", career_stage: "phd", areaCount: 2 }),
    ).toBeNull();
  });

  it("remove repetidas sem diferenciar maiúsculas", () => {
    expect(uniqueTags(["R", "r ", "  Python", "python", ""])).toEqual(["r", "python"]);
    expect(uniqueTags(["Ana", "ana"], false)).toEqual(["Ana"]);
  });
});

describe("updateToFormValues", () => {
  it("devolve ao formulário os valores normalizados que foram gravados", () => {
    const result = parseProfileSection("pesquisa", {
      ...EMPTY_PROFILE_VALUES,
      area_ids: ["7", "3"],
      orcid: "orcid.org/0000000218250097",
      lattes_url: "lattes.cnpq.br/1",
      keywords: ["R", "r"],
    });
    if (!result.success) throw new Error("esperava sucesso");
    expect(updateToFormValues(result.update, result.areaIds)).toMatchObject({
      area_ids: ["7", "3"],
      orcid: "0000-0002-1825-0097",
      lattes_url: "https://lattes.cnpq.br/1",
      keywords: ["r"],
      bio: "",
    });
  });

  it("converte números e ignora colunas que não são do formulário", () => {
    expect(
      updateToFormValues({ mentor_capacity: 3, onboarded_at: "2026-10-27", is_mentor: true }),
    ).toEqual({
      mentor_capacity: "3",
      is_mentor: true,
    });
  });
});

describe("trajetória (opcional, em “Sobre você”)", () => {
  const about = { ...EMPTY_PROFILE_VALUES, full_name: "Ana Souza", career_stage: "phd" };

  it("aceita qualquer subconjunto do catálogo, sem repetição e na ordem do catálogo", () => {
    const result = parseProfileSection("sobre", {
      ...about,
      trajectory_tags: ["fora-das-capitais", "primeira-geracao", "primeira-geracao"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.update.trajectory_tags).toEqual(["primeira-geracao", "fora-das-capitais"]);
    }
    const none = parseProfileSection("sobre", { ...about, trajectory_tags: [] });
    expect(none.success && none.update.trajectory_tags).toEqual([]);
  });

  it("recusa marca fora do catálogo com erro no campo", () => {
    const result = parseProfileSection("sobre", {
      ...about,
      trajectory_tags: ["primeira-geracao", "raca"],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.trajectory_tags?.[0]).toMatch(/não existe mais/);
      expect(result.fieldErrors.full_name).toBeUndefined();
    }
  });

  it("é opcional: sem o grupo no formulário, o update não mexe nas marcas", () => {
    const { trajectory_tags: _omit, ...withoutTags } = about;
    void _omit;
    const result = parseProfileSection("sobre", withoutTags);
    expect(result.success).toBe(true);
    if (result.success) expect(result.update).not.toHaveProperty("trajectory_tags");
  });

  it("lê do FormData só quando o grupo foi enviado (marca oculta)", () => {
    const shown = readSectionValues(
      "sobre",
      form([
        ["full_name", "Ana"],
        [TRAJECTORY_MARKER, "1"],
        ["trajectory_tags", "escola-publica"],
        ["trajectory_tags", "mae-cuidadora"],
      ]),
    );
    expect(shown.trajectory_tags).toEqual(["escola-publica", "mae-cuidadora"]);
    // Grupo enviado sem nenhuma marcada = tirar todas.
    expect(readSectionValues("sobre", form([[TRAJECTORY_MARKER, "1"]])).trajectory_tags).toEqual(
      [],
    );
    // Sem a marca, o campo nem aparece (outras seções/telas nunca apagam as marcas).
    expect(
      readSectionValues("sobre", form([["trajectory_tags", "escola-publica"]])),
    ).not.toHaveProperty("trajectory_tags");
  });

  it("vai e volta entre perfil, formulário e update", () => {
    const values = profileToFormValues(
      {
        ...EMPTY_ROW,
        trajectory_tags: ["mudanca-de-area", "escola-publica", "inventada"],
      },
      [],
    );
    expect(values.trajectory_tags).toEqual(["escola-publica", "mudanca-de-area"]);
    expect(profileToFormValues(EMPTY_ROW, []).trajectory_tags).toEqual([]);
    const parsed = parseProfileSection("sobre", {
      ...about,
      trajectory_tags: values.trajectory_tags,
    });
    if (!parsed.success) throw new Error("esperava sucesso");
    expect(updateToFormValues(parsed.update).trajectory_tags).toEqual([
      "escola-publica",
      "mudanca-de-area",
    ]);
  });
});

const EMPTY_ROW = {
  full_name: "Ana",
  pronouns: null,
  headline: null,
  institution: null,
  city: null,
  state: null,
  career_stage: null,
  keywords: [],
  bio: null,
  lattes_url: null,
  orcid: null,
  linkedin_url: null,
  website_url: null,
  seeks_mentorship: false,
  is_mentor: false,
  mentoring_goals: null,
  mentoring_offer: null,
  mentor_capacity: 2,
  mentor_available: true,
  mentorship_topics: [],
  meeting_formats: [],
  languages: [],
  ai_consent: false,
};
