# DESIGN.md — Identidade visual do site do Recomeçar

Este arquivo é a fonte da verdade visual. A direção de arte é do **Tuti**; nada aqui é sugestão da IA. Em conflito ou lacuna: **perguntar ao Pedro, nunca improvisar.** Quando uma regra deste arquivo conflitar com um print de referência, **a regra vence** (as regras são posteriores aos esboços).

## A direção (a tese da identidade)

Identidade **mariana e luminosa**: o céu como fundo claro, o azul do manto de Nossa Senhora como cor estrutural, o creme/dourado como calor. Elegante, leve, fiel à paleta — e **nada com cara de mockup feito por IA**. Na dúvida entre duas soluções, vence a mais sóbria; se a dúvida continuar, perguntar.

O conteúdo é o protagonista: as **fotos** dos retiros. A interface é moldura — nunca compete com foto.

A ousadia da identidade mora em lugares definidos: o **hero mariano da home**, o **logo script**, os **cards de padroeiro** das edições. Todo o resto (grade, biblioteca, admin, navegação) é quieto e disciplinado. Antes de finalizar qualquer tela, remova um acessório: se um elemento decorativo não serve ao conteúdo, corte.

## Cores — tokens e regras contextuais

Tudo em variáveis CSS desde o primeiro componente. Nenhuma cor de interface fora dos tokens — nem "cor que combina", nem default de biblioteca. Fotos e capas de livros são conteúdo, não contam.

```css
:root {
  /* base */
  --azul:   #002860;
  --creme:  #F8E2C5;
  --branco: #FFFFFF;

  /* semânticos */
  --pagina-fundo:       var(--azul);   /* fundo das páginas/seções de conteúdo */
  --superficie:         var(--creme);  /* cartões, painéis, barras sobre o azul */
  --texto-sobre-azul:   var(--creme);
  --texto-sobre-claro:  var(--azul);   /* sobre creme ou branco */
  --acao-sobre-azul:    var(--creme);  /* botões e links em contexto escuro */
  --acao-sobre-claro:   var(--azul);   /* botões e links em contexto claro */
}
```

**Regras de emprego (do Tuti — fechadas):**

- Fundo azul ⇒ texto, botões e links em **creme**. Fundo creme ou branco ⇒ texto, botões e links em **azul**.
- **Branco: uso mínimo**, e somente sobre azul (cor ou céu) — logo, títulos de página (como o "Retiros" do esboço) e detalhes. **Nunca branco encostado em creme** — os dois não convivem lado a lado.
- Sobre azul, o texto corrente padrão é **creme**; branco é reservado a logo/títulos, com parcimônia.
- `#F8E2C5` foi **escolhido** sobre `#FFFFEA` (descartado — não usar). Pendência: carimbo do Tuti na primeira tela implementada.
- Precisou de uma cor que não existe aqui? **Parar e perguntar** — o Tuti pensa numa terceira cor se for o caso.
- Contraste do par azul × creme ≈ **10,8:1 (AAA nos dois sentidos)**. Qualquer cor de tema de edição futura passa por checagem de contraste antes de entrar (mínimo AA 4,5:1 para texto).

**Scrim (única exceção à proibição de gradiente):** texto sobre imagem exige sempre um degradê/escurecimento de legibilidade por trás (ex.: transparente → azul). É regra funcional, não decoração.

## Tipografia

- **Agora: Baloo 2** (Google Fonts) como fonte única do site — títulos em 700/800, corpo em 400/500. Sem versalete, sem all-caps (proibido abaixo).
- **Futuro: More Sugar** (designer slidehack; Regular display + Thin + extras) entra **quando a licença comercial for comprada** — a distribuição gratuita é só para uso pessoal e não cobre site público. Ao entrar: converter para **woff2**, conferir diacríticos completos (ç ã â á é ê í ó õ ú) e empregar em títulos e trechos curtos, como nos esboços.
- Registrada como decisão **adiada**: uma sans de apoio para telas funcionais densas (filtros, admin, formulários) — sugestão em pauta: Nunito. Reavaliar quando essas telas existirem; não introduzir por conta própria.
- Hierarquia entre texto principal e secundário: por **tamanho e peso**, nunca por cinza (proibição abaixo).

## Modelo de página — imagem vs. neutro (fechado)

| Tipo | Fundo | Exemplos |
|---|---|---|
| **Apresentação** | Imagem (céus com nuvens; assets do Tuti) com scrim onde houver texto | Home; topo/hero da página do retiro |
| **Conteúdo** | `--azul` neutro | Grade da galeria, índice de retiros, biblioteca, admin |

A página do retiro (`/retiros/:edicao`) é **híbrida**: hero de apresentação no topo (imagem, título, datas, padroeiro — compacto: as fotos aparecem no primeiro scroll) → transição via scrim → grade sobre azul. A cor de fundo existe por baixo de toda imagem (aparece no carregamento e no scroll além dela).

## Tema por edição

- Toda a superfície visual referencia tokens desde o dia 1 — é isso que torna o tema por edição barato no futuro.
- Superfície tematizável **pequena**: cor do card/capa da edição (e futuramente acento e degradê de capa). Texto e fundos-base ficam sob controle do site.
- **Na v1**, o tema por edição se manifesta apenas como **cor própria de cada card** no índice (como no esboço: marrom do 9°, vinho do 8° Recomeçar, amarelo do 7° Renascer...). Página inteira tematizada = extra pós-v1, decidido pelo time.
- Cores por edição vêm do banco (campo `tema` de `retiros`), nunca hardcoded.

## Componentes canônicos (dos esboços do Tuti)

- **Navegação**: pills de contorno fino e cantos bem arredondados — rótulos **Retiros · Biblioteca · RecomeMusic**. No celular, resolver o colapso sem inventar padrão exótico (a versão em pé da home ainda não foi desenhada; propor a partir do esboço e validar com screenshot).
- **Card de edição**: vertical, cantos generosos, cor própria da edição, arte do padroeiro, nome "N° Série" — **com cedilha** ("9° Recomeçar"; o "Recomecar" dos esboços foi pressa, confirmado).
- **Cartão de texto** (institucional da home): superfície creme, cantos generosos, texto **azul** (a regra venceu o preto do esboço — exemplo canônico de "regra vence referência"). O texto institucional do esboço é **conteúdo real aprovado** — usar verbatim.
- **Grade de fotos**: lazy, aspect-ratio reservado, blur-up, fundo azul.
- **Lightbox**: player de vídeo, download do original, navegação por toque.
- **Ícones**: **Phosphor Icons**, biblioteca única. Sem o ícone certo? Perguntar.

## Copy e microtexto

pt-BR, sentence case, voz ativa. Botão nomeia exatamente a ação ("Baixar foto", não "OK") e mantém o nome ao longo do fluxo. Erros dizem o que houve e como resolver, sem drama e sem se desculpar. Tela vazia convida à ação. Nomear as coisas pelo vocabulário do grupo (retiro, edição, momento, equipe), nunca pelo jargão do sistema.

## Acessibilidade (piso de qualidade — sem anunciar)

- Foco de teclado visível; áreas de toque ≥ 44px; testar primeiro em 390px de largura.
- **Alt text automático das fotos derivado das tags do motor**: "Foto — [momento], [dia], [edição]". Acessibilidade de graça a partir do cronograma.
- `prefers-reduced-motion` respeitado (trivial: não há animação decorativa).

## Proibições (fechadas pelo time — valem em toda tela)

**O espírito (Tuti):** elegante, leve, fiel à paleta — e NADA com cara de mockup feito por IA. A lista abaixo é a tradução disso em regra concreta.

Nunca usar:

- Paleta neon (cores saturadas artificiais)
- Gradiente roxo — e gradiente decorativo em geral. Única exceção: o scrim de legibilidade sobre imagem
- Glassmorphism (vidro fosco/blur atrás de painéis e barras)
- Glow colorido e sombra colorida (box-shadow colorido, brilho ao redor de botões e cards) — incluindo "dark mode glow-up"
- Sombra pesada e dura (drop shadow forte, elemento "flutuando" com peso)
- Textura rústica: papel envelhecido, madeira, grunge, kraft, borda rasgada, efeito artesanal (não confundir com o estilo manuscrito do logo — tipografia não é textura)
- Dark mode como decisão da IA — o tema do site vem da paleta do Tuti
- Texto de corpo em cinza médio de baixo contraste, em qualquer tema
- Rótulos e títulos de seção em CAIXA ALTA espaçada
- Status dots (bolinhas coloridas de status) — o site não tem status de nada
- Ícone dentro de quadradinho arredondado (clichê de card de features)
- Emoji na interface, em qualquer texto do site
- **Animação decorativa: nenhuma** (fade-in ao rolar, parallax, stagger etc.). Se um dia houver alguma animação, será decidida pelo time caso a caso — e não será essas.

Regras de conduta na implementação:

- **Disciplina de tokens**: qualquer cor de UI fora dos tokens ⇒ parar e perguntar.
- **Cards não são o bloco padrão de construção.** Seguir a composição pré-estabelecida de cada página; card não previsto ⇒ perguntar antes de criar.
- **Hierarquia visual é decisão do time** (Pedro/Tuti/Gui), definida nas composições — não inventar níveis. Evitar aninhamento (card dentro de card, borda dentro de borda).
- Referência concreta > adjetivo. Se a instrução for vaga, pedir a referência em vez de interpretar livremente.

## Referências (em `design/referencias/`)

| Arquivo | O que extrair |
|---|---|
| `01-home-hero.jpeg` | Composição da home: céu real, Nossa Senhora central, logo script branco sobreposto, nav em pills. Atenção: logo branco sobre nuvem clara quase some ⇒ é o caso canônico de scrim. |
| `02-ceu-textura-a.jpeg` / `03-ceu-textura-b.jpeg` | Assets de fundo claro (céu com granulação suave de foto — não é "textura rústica"). |
| `04-home-institucional.jpeg` | Cartão creme com o texto institucional (conteúdo real aprovado). Cor do texto na implementação: **azul**, pela regra. |
| `05-retiros-cards.jpeg` | Fundo azul confirmado em página de conteúdo; cards por edição com cor própria e padroeiro; título de página em branco sobre azul (uso legítimo do branco). |

## Processo anti-slop (obrigatório em toda tela)

1. Implementar contra os tokens e as composições combinadas.
2. Subir o dev server e capturar screenshot via **Playwright** em **390×844** (primário) e **1366×768**.
3. Criticar a própria tela contra o checklist: só cores de token? alguma proibição violada? bate com a referência correspondente? contraste e scrim ok? mobile resolvido primeiro? o que dá para **remover**?
4. Refinar e repetir. **Mínimo duas iterações; a primeira versão nunca é a final.**
5. No resumo para o Pedro: screenshot final anexado — ele julga por imagem, não por descrição.

Conteúdo real sempre. Nada de lorem ipsum, nada de foto de banco de imagem, nada de nome inventado de retiro.
