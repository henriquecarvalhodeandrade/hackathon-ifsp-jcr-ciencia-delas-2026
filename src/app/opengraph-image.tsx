import { ImageResponse } from "next/og";
import { SITE } from "@/lib/constants";

// Imagem de compartilhamento padrão (1200×630). Usa só a fonte embutida do next/og —
// nada é baixado da internet no build.
export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const VIOLETA_950 = "#251046";
const VIOLETA_300 = "#cbaeff";
const AMBAR_400 = "#ffb24a";
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
          <ellipse
            cx="930"
            cy="250"
            rx="250"
            ry="86"
            transform="rotate(-16 930 250)"
            fill="none"
            stroke={VIOLETA_300}
            strokeOpacity="0.45"
            strokeWidth="2"
            strokeDasharray="3 10"
          />
          <path d="M780 520 L850 450 L915 470 L985 380 L1070 300" fill="none" stroke={VIOLETA_300} strokeWidth="2.5" />
          {[
            [780, 520],
            [850, 450],
            [915, 470],
            [985, 380],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="7" fill={VIOLETA_300} />
          ))}
          <circle cx="1070" cy="300" r="14" fill={AMBAR_400} />
          <circle cx="1070" cy="300" r="34" fill="none" stroke={AMBAR_400} strokeOpacity="0.5" strokeWidth="2" />
        </svg>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <svg width="66" height="104" viewBox="11 6 26 41" fill="none">
              <path d="M33.93 17.78A10 10 0 1 1 25.22 9.07" stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round" />
              <path d="M24 29v13.2M17.6 35.6h12.8" stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round" />
              <circle cx="17.6" cy="35.6" r="2.7" fill="#ffffff" />
              <circle cx="30.4" cy="35.6" r="2.7" fill="#ffffff" />
              <circle cx="24" cy="42.4" r="2.9" fill="#ffffff" />
              <circle cx="31.07" cy="11.93" r="3.5" fill={AMBAR_400} />
            </svg>
            <div style={{ display: "flex", fontSize: 40, letterSpacing: -0.5, color: VIOLETA_300 }}>
              Hackathon IFSP Jacareí 2026
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", maxWidth: 820 }}>
            <div style={{ display: "flex", fontSize: 112, lineHeight: 1, letterSpacing: -4 }}>
              Ciência&nbsp;<span style={{ color: AMBAR_400 }}>Delas</span>
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
