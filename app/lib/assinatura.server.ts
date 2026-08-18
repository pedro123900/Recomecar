import { AwsClient } from "aws4fetch";

// Em dev, TODO objeto vai para o prefixo _teste do bucket real — nunca
// retiros/ (regra do Pedro: resíduo de teste fica isolado e visível).
// Produção (deploy) usa retiros/.
export function prefixoR2(): string {
  return import.meta.env.DEV ? "_teste" : "retiros";
}

// URL assinada de PUT (SigV4, assinatura na query) para o endpoint S3 do R2.
// A assinatura é matemática local com as credenciais do token — o navegador
// faz o PUT direto no R2, sem passar o arquivo pelo Worker.
export async function assinarPut(
  env: Env,
  chave: string,
  expiraEmSegundos = 900,
): Promise<string> {
  const cliente = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
  const url = new URL(
    `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${chave}`,
  );
  url.searchParams.set("X-Amz-Expires", String(expiraEmSegundos));
  const assinada = await cliente.sign(new Request(url, { method: "PUT" }), {
    aws: { signQuery: true },
  });
  return assinada.url;
}
