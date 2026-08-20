import exifr from "exifr";

export interface MetadadosExif {
  capturadaEm: string | null;
  marca: string | null;
  modelo: string | null;
  serial: string | null;
}

// Date do exifr => 'YYYY-MM-DD HH:MM:SS' (relógio de parede; EXIF não tem
// fuso e o cronograma também não). Qualquer outra coisa => null.
export function formatarDataExif(data: unknown): string | null {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())} ` +
    `${p(data.getHours())}:${p(data.getMinutes())}:${p(data.getSeconds())}`
  );
}

const texto = (v: unknown) => {
  const t = v == null ? "" : String(v).trim();
  return t === "" ? null : t;
};

// Sem EXIF utilizável => tudo null => a foto cai em "Geral".
// capturada_em NUNCA vem de mtime/lastModified (regra do schema).
export async function lerExif(
  arquivo: Blob | ArrayBuffer | Uint8Array,
): Promise<MetadadosExif> {
  try {
    // 0xA431 (BodySerialNumber no padrão EXIF) sai do exifr como
    // "SerialNumber"; aceitamos os dois nomes por robustez entre versões.
    const dados = await exifr.parse(arquivo, [
      "DateTimeOriginal",
      "Make",
      "Model",
      "SerialNumber",
      "BodySerialNumber",
    ]);
    return {
      capturadaEm: formatarDataExif(dados?.DateTimeOriginal),
      marca: texto(dados?.Make),
      modelo: texto(dados?.Model),
      serial: texto(dados?.SerialNumber ?? dados?.BodySerialNumber),
    };
  } catch {
    return { capturadaEm: null, marca: null, modelo: null, serial: null };
  }
}
