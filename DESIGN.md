# DESIGN.md — Identidade visual do site do Recomeçar

Este arquivo é a fonte da verdade visual. A direção de arte é do **Tuti**; nada aqui é sugestão da IA. Em conflito ou lacuna: **perguntar ao Pedro, nunca improvisar.** Quando uma regra deste arquivo conflitar com um print de referência, **a regra vence** (as regras são posteriores aos esboços).

## A direção (a tese da identidade)

Identidade **mariana e luminosa**: o **azul profundo do manto** como chão de tudo, **nuvens brancas** como pontuação posicionada sobre ele, o **branco** como cor de luz — texto, ação, logo. O dourado que aparece nas artes (halo da Nossa Senhora) é **conteúdo da arte, não cor de UI**. Elegante, leve, fiel à paleta — e **nada com cara de mockup feito por IA**. Na dúvida entre duas soluções, vence a mais sóbria; se a dúvida continuar, perguntar.

O conteúdo é o protagonista: as **fotos** dos retiros. A interface é moldura — nunca compete com foto.

A ousadia da identidade mora em lugares definidos: o **hero mariano da home** (fundo azul sólido, nuvens posicionadas, Nossa Senhora central com halo, logo script sobreposto), o **logo script**, os **cards de padroeiro** das edições. Todo o resto (grade, biblioteca, admin, navegação) é quieto e disciplinado. Antes de finalizar qualquer tela, remova um acessório: se um elemento decorativo não serve ao conteúdo, corte.

## Cores — tokens e regras contextuais

Tudo em variáveis CSS desde o primeiro componente. Nenhuma cor de interface fora dos tokens — nem "cor que combina", nem default de biblioteca. Fotos e capas de livros são conteúdo, não contam.

```css
:root {
  /* base */
  --azul:   #002860;  /* exclusivamente fundo — nunca texto ou ação */
  --branco: #FFFFFF;
  --preto:  #000000;

  /* semânticos */
  --pagina-fundo:       var(--azul);
  --balao-fundo:        var(--branco);  /* balão: texto sobre nuvem/área clara */
  --texto-sobre-azul:   var(--branco);
  --texto-sobre-balao:  var(--preto);
  --acao-sobre-azul:    var(--branco);  /* botões e links em contexto azul */
  --acao-sobre-balao:   var(--preto);
}
```

**Regras de emprego (do Tuti — fechadas; paleta atualizada em 28/08/2026):**

- **Azul é exclusivamente cor de fundo** — nunca texto, botão ou link.
- Fundo azul ⇒ texto, botões e links em **branco**. O branco assume todos os usos que eram do creme; caiu a antiga restrição "branco só em logo e títulos".
- Fundo branco (**balão**) ⇒ texto em **preto**.
- **Balão × scrim — divisão explícita:** texto sobre **nuvem ou área clara de imagem** entra em **balão branco com texto preto**; texto sobre **foto de retiro** (hero da capa, lightbox) usa **scrim** — a foto é protagonista e um balão a taparia.
- **Elemento branco nunca sobre nuvem, a não ser dentro de balão** (substitui a antiga "nunca branco encostado no creme").
- **Superfície geral está em aberto:** `--balao-fundo` cobre só o balão. Painéis do admin, cartões e superfícies que não são balão **não foram decididos** — decidir na fase de skin com o Tuti. De propósito não existe token de "superfície padrão".
- Descartes (não usar, não reintroduzir): `#FFFFEA` (preterido já na escolha original) e `#F8E2C5` (**creme — descartado em 28/08/2026** junto com o conceito de céu-textura; o branco assumiu todos os seus papéis).
- **Preto = `#000000`**, por leitura literal do "fonte preta" do Tuti (nenhum mockup tem balão para amostrar o valor). Pendência: carimbo do Tuti no **balão branco/texto preto** na primeira tela real — mesma pendência que o creme teve. Sendo o cartão institucional um bloco de texto longo, o Tuti pode querer revisar esse valor ao ver a tela.
- Precisou de uma cor que não existe aqui? **Parar e perguntar** — o Tuti pensa numa terceira cor se for o caso.
- Contraste (WCAG 2.x, calculado em 28/08/2026): **branco sobre azul 14,26:1 (AAA)**; **preto sobre branco 21:1 (AAA)**. Qualquer cor de tema de edição futura passa por checagem de contraste antes de entrar (mínimo AA 4,5:1 para texto).

**Scrim (única exceção à proibição de gradiente):** texto sobre **foto de retiro** exige sempre um degradê/escurecimento de legibilidade por trás (ex.: transparente → azul). É regra funcional, não decoração. Para nuvem e área clara de imagem a solução é o **balão**, não o scrim.

## Tipografia

- **Agora: Baloo 2** (Google Fonts) como fonte única do site — títulos em 700/800, corpo em 400/500. Sem versalete, sem all-caps (proibido abaixo).
- **Futuro: More Sugar** (designer slidehack; Regular display + Thin + extras) entra **quando a licença comercial for comprada** — a distribuição gratuita é só para uso pessoal e não cobre site público. Ao entrar: converter para **woff2**, conferir diacríticos completos (ç ã â á é ê í ó õ ú) e empregar em títulos e trechos curtos, como nos esboços.
- Registrada como decisão **adiada**: uma sans de apoio para telas funcionais densas (filtros, admin, formulários) — sugestão em pauta: Nunito. Reavaliar quando essas telas existirem; não introduzir por conta própria.
- Hierarquia entre texto principal e secundário: por **tamanho e peso**, nunca por cinza (proibição abaixo).

## Modelo de página — apresentação vs. conteúdo (fechado)

| Tipo | Fundo | Exemplos |
|---|---|---|
| **Apresentação** | `--azul` sólido + peças de produção posicionadas (nuvens, Nossa Senhora, logo — `design/assets/`) | Home |
| **Conteúdo** | `--azul` neutro | Grade da galeria, índice de retiros, biblioteca, admin |

Não existe mais fundo de imagem de céu em tela inteira — o conceito de céu-textura foi **descartado em 28/08/2026** (referências 02/03 removidas). A página do retiro (`/retiros/:edicao`) é **híbrida**: hero de apresentação no topo (**foto de retiro** com scrim — título, datas, padroeiro — compacto: as fotos aparecem no primeiro scroll) → transição via scrim → grade sobre azul. A cor de fundo existe por baixo de toda imagem (aparece no carregamento e no scroll além dela).

## Tema por edição

- Toda a superfície visual referencia tokens desde o dia 1 — é isso que torna o tema por edição barato no futuro.
- Superfície tematizável **pequena**: cor do card/capa da edição (e futuramente acento e degradê de capa). Texto e fundos-base ficam sob controle do site.
- **Na v1**, o tema por edição se manifesta apenas como **cor própria de cada card** no índice (como no esboço: marrom do 9°, vinho do 8° Recomeçar, amarelo do 7° Renascer...). Página inteira tematizada = extra pós-v1, decidido pelo time.
- Cores por edição vêm do banco (campo `tema` de `retiros`), nunca hardcoded.

## Componentes canônicos (dos esboços do Tuti)

- **Navegação**: pills de **contorno fino branco, fundo transparente, rótulo branco sublinhado**, cantos bem arredondados — rótulos **Retiros · Biblioteca · RecomeMusic**. No celular: **linha única** (confirmado pela referência 06). Posicionados **fora das nuvens** (regra do branco sobre nuvem). Fato verificado em 28/08/2026 por amostragem de pixel nas referências 01 e 06: o interior dos pills é `#002860` (o fundo passando por dentro) — não existe versão preenchida.
- **Card de edição**: vertical, cantos generosos, cor própria da edição, arte do padroeiro, nome "N° Série" — **com cedilha** ("9° Recomeçar"; o "Recomecar" dos esboços foi pressa, confirmado).
- **Cartão de texto** (institucional da home): **balão branco com texto preto** — **PROVISÓRIO**: carimbo do Tuti na primeira tela real (mesma pendência que o creme teve). O texto institucional do esboço é **conteúdo real aprovado** — usar verbatim.
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
- Gradiente roxo — e gradiente decorativo em geral. Única exceção: o scrim de legibilidade sobre foto de retiro
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
- Elemento branco solto sobre nuvem (texto, logo, contorno): branco vive sobre azul; sobre nuvem ou área clara, só dentro de balão
- **Animação decorativa: nenhuma** (fade-in ao rolar, parallax, stagger etc.). Se um dia houver alguma animação, será decidida pelo time caso a caso — e não será essas.

Regras de conduta na implementação:

- **Disciplina de tokens**: qualquer cor de UI fora dos tokens ⇒ parar e perguntar.
- **Cards não são o bloco padrão de construção.** Seguir a composição pré-estabelecida de cada página; card não previsto ⇒ perguntar antes de criar.
- **Hierarquia visual é decisão do time** (Pedro/Tuti/Gui), definida nas composições — não inventar níveis. Evitar aninhamento (card dentro de card, borda dentro de borda).
- Referência concreta > adjetivo. Se a instrução for vaga, pedir a referência em vez de interpretar livremente.

## Peças de produção (em `design/assets/`)

As peças finais da home, entregues pelo Tuti em 28/08/2026. **Não entram em código nesta fase** — ficam para a fase de skin; até lá, são referência de composição.

| Arquivo | O que é |
|---|---|
| `nossa-senhora.png` | Figura central da home, fundo transparente, **halo dourado de estrelas já embutido na arte** (o dourado é conteúdo da arte, não token de UI). |
| `nuvem.png` | **Única nuvem do site**: PNG branco semi-transparente. Estratégia de asset fechada: o céu se compõe **reutilizando este arquivo** flipado/escalado/reposicionado — não criar segunda nuvem. |
| `logo-branco.png` | Logo script em branco puro, fundo transparente. Na home, sobreposto à Nossa Senhora. |

## Referências (em `design/referencias/`)

| Arquivo | O que extrair |
|---|---|
| `01-home-hero.png` | Composição da home (deitado): fundo `--azul` sólido, nuvens posicionadas nas bordas, Nossa Senhora central com halo, logo script branco sobreposto, nav em pills de contorno branco no topo, fora das nuvens. |
| `04-home-institucional.jpeg` | Composição do cartão institucional e o texto (conteúdo real aprovado — usar verbatim). Cores na implementação: **balão branco com texto preto** (regra vence referência — o creme do esboço foi descartado). |
| `05-retiros-cards.jpeg` | Fundo azul confirmado em página de conteúdo; cards por edição com cor própria e padroeiro; título de página em branco sobre azul. O que era creme na referência vira **branco** na implementação (regra vence referência). |
| `06-home-em-pe.png` | Comportamento mobile da home: pills em **linha única** no topo, fora das nuvens; Nossa Senhora central com halo e logo sobreposto; nuvens nas bordas. |

## Processo anti-slop (obrigatório em toda tela)

1. Implementar contra os tokens e as composições combinadas.
2. Subir o dev server e capturar screenshot via **Playwright** em **390×844** (primário) e **1366×768**.
3. Criticar a própria tela contra o checklist: só cores de token? alguma proibição violada? bate com a referência correspondente? contraste, balão e scrim ok? mobile resolvido primeiro? o que dá para **remover**?
4. Refinar e repetir. **Mínimo duas iterações; a primeira versão nunca é a final.**
5. No resumo para o Pedro: screenshot final anexado — ele julga por imagem, não por descrição.

Conteúdo real sempre. Nada de lorem ipsum, nada de foto de banco de imagem, nada de nome inventado de retiro.
