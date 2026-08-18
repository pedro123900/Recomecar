import { describe, expect, test } from "vitest";
// @ts-expect-error piexifjs não tem tipos; devDependency só para fabricar fixture
import piexif from "piexifjs";
import { formatarDataExif, lerExif } from "./exif";

// EXIF 100% sintético — nenhum conteúdo real. 1x1 JPEG válido em base64.
const JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
  "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA" +
  "AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==";

const jpegPuro = () => Uint8Array.from(atob(JPEG_BASE64), (c) => c.charCodeAt(0));

function jpegComExif(): Uint8Array {
  const exif = piexif.dump({
    "0th": {
      [piexif.ImageIFD.Make]: "MarcaTeste",
      [piexif.ImageIFD.Model]: "ModeloTeste",
    },
    Exif: {
      [piexif.ExifIFD.DateTimeOriginal]: "2099:01:01 20:15:00",
      [piexif.ExifIFD.BodySerialNumber]: "SN123",
    },
  });
  const comExif = piexif.insert(exif, atob(JPEG_BASE64));
  return Uint8Array.from(comExif, (c: string) => c.charCodeAt(0));
}

describe("formatarDataExif", () => {
  test("Date vira o formato canônico, relógio de parede", () => {
    expect(formatarDataExif(new Date(2099, 0, 1, 20, 15, 0))).toBe(
      "2099-01-01 20:15:00",
    );
  });

  test("não-Date e Date inválida viram null", () => {
    expect(formatarDataExif(undefined)).toBeNull();
    expect(formatarDataExif("2099:01:01")).toBeNull();
    expect(formatarDataExif(new Date("lixo"))).toBeNull();
  });
});

describe("lerExif", () => {
  test("JPEG com EXIF sintético: data canônica + aparelho", async () => {
    const m = await lerExif(jpegComExif());
    expect(m.capturadaEm).toBe("2099-01-01 20:15:00");
    expect(m.marca).toBe("MarcaTeste");
    expect(m.modelo).toBe("ModeloTeste");
    expect(m.serial).toBe("SN123");
  });

  test("bytes sem EXIF: tudo null (Bastidores) — nunca mtime", async () => {
    const m = await lerExif(jpegPuro());
    expect(m).toEqual({
      capturadaEm: null,
      marca: null,
      modelo: null,
      serial: null,
    });
  });
});
