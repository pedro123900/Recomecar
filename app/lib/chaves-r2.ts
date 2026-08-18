// Convenção de chaves R2 (ratificada pelo Pedro em 18/08/2026):
//  original:  <prefixo>/<slug>/originais/<ulid>.<ext>
//  derivadas: <prefixo>/<slug>/derivadas/<ulid>/{thumb,media,poster}
//             SEM extensão — o Content-Type vai no metadata do objeto,
//             porque o formato da thumb varia por navegador (WebP ou JPEG).
// Derivadas são função pura da chave do original (contrato do CLAUDE.md).

export function chaveOriginal(
  prefixo: string,
  slug: string,
  id: string,
  ext: string,
): string {
  return `${prefixo}/${slug}/originais/${id}.${ext}`;
}

export function chavesDerivadas(chave: string): {
  thumb: string;
  media: string;
  poster: string;
} {
  const m = chave.match(/^(.+)\/originais\/([^./]+)\.[^.]+$/);
  if (!m) throw new Error(`Chave de original fora da convenção: ${chave}`);
  const [, base, id] = m;
  return {
    thumb: `${base}/derivadas/${id}/thumb`,
    media: `${base}/derivadas/${id}/media`,
    poster: `${base}/derivadas/${id}/poster`,
  };
}
