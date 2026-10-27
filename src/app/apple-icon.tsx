import { ImageResponse } from "next/og";

// Ícone para a tela inicial do iOS (PNG 180×180, gerado a partir da marca).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#6530ac",
        }}
      >
        <svg width="80" height="126" viewBox="11 6 26 41" fill="none">
          <path d="M33.93 17.78A10 10 0 1 1 25.22 9.07" stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M24 29v13.2M17.6 35.6h12.8" stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round" />
          <circle cx="17.6" cy="35.6" r="2.7" fill="#ffffff" />
          <circle cx="30.4" cy="35.6" r="2.7" fill="#ffffff" />
          <circle cx="24" cy="42.4" r="2.9" fill="#ffffff" />
          <circle cx="31.07" cy="11.93" r="3.5" fill="#ffb24a" />
        </svg>
      </div>
    ),
    size,
  );
}
