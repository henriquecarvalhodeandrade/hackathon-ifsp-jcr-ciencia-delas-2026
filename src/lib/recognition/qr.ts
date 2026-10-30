import "server-only";
import QRCode from "qrcode";

/**
 * QR code em SVG, gerado no servidor (pacote `qrcode`, MIT) — nada de serviço externo.
 *
 * Chame SÓ com URLs montadas aqui mesmo a partir de um código já validado (ex.:
 * `verificationUrl(getSiteUrl(), code)` com `isDeclarationCode(code)`), nunca com texto vindo da
 * requisição: o SVG é inserido como HTML.
 *
 * Os módulos usam `currentColor` (o contêiner define a cor: use texto escuro sobre fundo claro,
 * como na folha da declaração) e o fundo é transparente. O SVG é decorativo (aria-hidden): quem
 * o exibe dá o nome acessível ao contêiner (role="img" + aria-label).
 */
export async function renderQrSvg(url: string): Promise<string> {
  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
    color: { dark: "#000000", light: "#0000" },
  });
  return svg
    .replace(/stroke="#000000"/g, 'stroke="currentColor"')
    .replace("<svg ", '<svg aria-hidden="true" focusable="false" width="100%" height="100%" ');
}
