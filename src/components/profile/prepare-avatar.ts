import { AVATAR_SIZE } from "@/lib/profile/avatar";

/**
 * Prepara a foto no navegador antes do upload: recorta um quadrado central, reduz para
 * 512 px e regrava em WebP (ou JPEG). Além de economizar espaço, isso descarta os metadados
 * EXIF — inclusive a localização GPS que muitas câmeras gravam.
 * Se o navegador não suportar algo, devolve o arquivo original.
 */
export async function prepareAvatar(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    if (!side) return file;
    const size = Math.min(AVATAR_SIZE, side);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
    bitmap.close();

    const toBlob = (type: string, quality: number) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    const webp = await toBlob("image/webp", 0.86);
    if (webp && webp.type === "image/webp") return webp;
    const jpeg = await toBlob("image/jpeg", 0.88);
    return jpeg ?? file;
  } catch {
    return file;
  }
}
