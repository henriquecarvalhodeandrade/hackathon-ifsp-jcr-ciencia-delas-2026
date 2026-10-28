import { ImageResponse } from "next/og";
import { BRAND_HEX, LOGO_PATHS, LOGO_VIEWBOX } from "@/components/ui/logo-geometry";
import { SITE } from "@/lib/constants";

// Imagem de compartilhamento padrão (1200×630). Usa só a fonte embutida do next/og —
// nada é baixado da internet no build.
export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const { violeta950: VIOLETA_950, violeta300: VIOLETA_300, ambar400: AMBAR_400 } = BRAND_HEX;
const VERDE_400 = "#5bc96c";

/** Estrelas de fundo determinísticas. */
const STARS = Array.from({ length: 70 }, (_, i) => {
  const x = (i * 157.3) % 1200;
  const y = (i * 97.9 + (i % 7) * 31) % 630;
  return { x, y, r: 1 + ((i * 13) % 3) * 0.6, o: 0.25 + ((i * 7) % 5) * 0.1 };
});

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: VIOLETA_950,
          color: "#ffffff",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", top: 0, left: 0 }}>
          {STARS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#ffffff" fillOpacity={s.o} />
          ))}
          {/* caminho de mentoria: nós ligados que sobem, dentro da curva da lua, até a estrela âmbar */}
          <path
            d="M884 352 L930 300 L978 312 L1058 160"
            fill="none"
            stroke={VIOLETA_300}
            strokeOpacity="0.6"
            strokeWidth="2.5"
          />
          {[
            [884, 352],
            [930, 300],
            [978, 312],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="6" fill={VIOLETA_300} fillOpacity="0.85" />
          ))}
        </svg>
        {/* a lua da marca em grande escala, com a estrela âmbar */}
        <svg
          width="430"
          height="430"
          viewBox={LOGO_VIEWBOX}
          fill="none"
          style={{ position: "absolute", top: 70, left: 720 }}
        >
          <g opacity="0.24">
            <path
              d={LOGO_PATHS.moon}
              fill={VIOLETA_300}
              stroke={VIOLETA_300}
              strokeWidth={LOGO_PATHS.moonStrokeWidth}
              strokeLinejoin="round"
            />
          </g>
          <path d={LOGO_PATHS.star} fill={AMBAR_400} />
        </svg>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <svg width="72" height="72" viewBox={LOGO_VIEWBOX} fill="none">
              <path
                d={LOGO_PATHS.moon}
                fill="#ffffff"
                stroke="#ffffff"
                strokeWidth={LOGO_PATHS.moonStrokeWidth}
                strokeLinejoin="round"
              />
              <path d={LOGO_PATHS.star} fill={AMBAR_400} />
            </svg>
            <div style={{ display: "flex", fontSize: 34, letterSpacing: -0.3, color: VIOLETA_300 }}>
              {SITE.theme} · Hackathon IFSP Jacareí 2026
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", maxWidth: 820 }}>
            <div style={{ display: "flex", fontSize: 112, lineHeight: 1, letterSpacing: -4 }}>
              {SITE.name}
            </div>
            <div style={{ display: "flex", marginTop: 28, fontSize: 38, lineHeight: 1.3, color: "#efe6ff" }}>
              {SITE.tagline}
            </div>
          </div>

          <div style={{ display: "flex", gap: 28, fontSize: 28, color: "#e0d0ff" }}>
            <span style={{ display: "flex" }}>Fórum</span>
            <span style={{ display: "flex", color: VERDE_400 }}>•</span>
            <span style={{ display: "flex" }}>Mentoria com IA</span>
            <span style={{ display: "flex", color: VERDE_400 }}>•</span>
            <span style={{ display: "flex" }}>Vitrine de papers</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
