const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

// ULID: 10 chars de timestamp (ms em base32 Crockford) + 16 aleatórios.
// Ordenável por tempo na comparação lexicográfica, como as chaves R2 pedem.
export function ulid(agora = Date.now()): string {
  let tempo = "";
  let t = agora;
  for (let i = 0; i < 10; i++) {
    tempo = ALFABETO[t % 32] + tempo;
    t = Math.floor(t / 32);
  }
  let aleatorio = "";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  for (let i = 0; i < 16; i++) aleatorio += ALFABETO[bytes[i] % 32];
  return tempo + aleatorio;
}
