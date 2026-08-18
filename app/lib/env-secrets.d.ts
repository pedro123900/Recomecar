// Secrets do Worker (wrangler secret em produção, .dev.vars em dev) — o
// wrangler types só tipa o que está na config; este merge cobre os secrets.
// Os VALORES nunca entram no repositório.
interface Env {
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
}
