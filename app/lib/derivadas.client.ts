// Derivadas no navegador (Workers não rodam binário nativo — CLAUDE.md).
// WebP quando o canvas souber codificar; senão JPEG. O Content-Type vai no
// metadata do R2 (derivadas não têm extensão na chave).

export interface Derivada {
  blob: Blob;
  contentType: string;
}

async function paraBlob(canvas: HTMLCanvasElement): Promise<Derivada> {
  const tentar = (tipo: string, q: number) =>
    new Promise<Blob | null>((res) => canvas.toBlob(res, tipo, q));
  const webp = await tentar("image/webp", 0.8);
  if (webp && webp.type === "image/webp") {
    return { blob: webp, contentType: "image/webp" };
  }
  const jpeg = await tentar("image/jpeg", 0.82);
  if (!jpeg) throw new Error("canvas.toBlob falhou");
  return { blob: jpeg, contentType: "image/jpeg" };
}

function desenhar(
  fonte: CanvasImageSource,
  largura: number,
  altura: number,
  maxLado: number,
): HTMLCanvasElement {
  const escala = Math.min(1, maxLado / Math.max(largura, altura));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(largura * escala));
  canvas.height = Math.max(1, Math.round(altura * escala));
  canvas.getContext("2d")!.drawImage(fonte, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export interface PipelineFoto {
  largura: number;
  altura: number;
  thumb: Derivada;
  media: Derivada;
}

export async function derivadasDeFoto(arquivo: File): Promise<PipelineFoto> {
  const bitmap = await createImageBitmap(arquivo);
  try {
    return {
      largura: bitmap.width,
      altura: bitmap.height,
      thumb: await paraBlob(desenhar(bitmap, bitmap.width, bitmap.height, 400)),
      media: await paraBlob(desenhar(bitmap, bitmap.width, bitmap.height, 1600)),
    };
  } finally {
    bitmap.close();
  }
}

export interface PipelineVideo {
  largura: number;
  altura: number;
  duracao: number;
  poster: Derivada;
  thumb: Derivada;
}

export function derivadasDeVideo(arquivo: File): Promise<PipelineVideo> {
  return new Promise((resolver, rejeitar) => {
    const url = URL.createObjectURL(arquivo);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.src = url;
    video.onerror = () => {
      URL.revokeObjectURL(url);
      rejeitar(new Error("vídeo ilegível no navegador"));
    };
    video.onloadeddata = () => {
      video.currentTime = Math.min(0.1, video.duration / 2);
    };
    video.onseeked = async () => {
      try {
        const poster = await paraBlob(
          desenhar(video, video.videoWidth, video.videoHeight, 1600),
        );
        const thumb = await paraBlob(
          desenhar(video, video.videoWidth, video.videoHeight, 400),
        );
        resolver({
          largura: video.videoWidth,
          altura: video.videoHeight,
          duracao: video.duration,
          poster,
          thumb,
        });
      } catch (e) {
        rejeitar(e as Error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
  });
}
