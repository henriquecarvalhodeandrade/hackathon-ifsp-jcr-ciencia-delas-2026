import { ImageResponse } from "next/og";
import { BRAND_HEX, LOGO_PATHS, LOGO_VIEWBOX } from "@/components/ui/logo-geometry";

// Ícone para a tela inicial do iOS (PNG 180×180), gerado da geometria única da marca.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: BRAND_HEX.violeta700,
      }}
    >
      <svg width="112" height="112" viewBox={LOGO_VIEWBOX} fill="none">
        <path
          d={LOGO_PATHS.moon}
          fill={BRAND_HEX.white}
          stroke={BRAND_HEX.white}
          strokeWidth={LOGO_PATHS.moonStrokeWidth}
          strokeLinejoin="round"
        />
        <path d={LOGO_PATHS.star} fill={BRAND_HEX.ambar400} />
      </svg>
    </div>,
    size,
  );
}
