# CLAUDE.md — Site do Grupo Recomeçar

Este arquivo é a constituição do projeto. Leia-o por inteiro no início de toda sessão, junto com o `DESIGN.md` (identidade visual e processo de crítica). As decisões registradas aqui foram tomadas e fechadas pelo time (Pedro, Tuti, Gui). **Não reabra decisão fechada nem proponha alternativa a item marcado como fechado, a menos que o Pedro traga um fato novo.**

## O projeto em um parágrafo

Site oficial do **Grupo Recomeçar**, grupo jovem católico da Paróquia São Pedro de Alcântara, sob a proteção de Nossa Senhora das Graças. O produto principal é a **galeria multi-retiro**: um acervo permanente de fotos e vídeos dos retiros, substituindo os Google Drives soltos usados até hoje. Produtos secundários (vitrines): **Biblioteca** (catálogo de livros, capa + descrição) e **RecomeMusic** (página do álbum do grupo, embed do Spotify, 13 faixas). A hierarquia é: o grupo vem primeiro (a home é do Recomeçar), os produtos vivem dentro.

## Restrições permanentes (invioláveis)

- **Custo ~zero ancorado no egress gratuito do R2.** Nenhuma proposta pode introduzir cobrança de banda. Mídia é R2, ponto.
- **Prazo fixo:** o 9 Recomeçar acontece em **25–27/09/2026** e não move.
- **Público interno**, ~600 pessoas, acesso majoritariamente por **celular**. Mobile-first em tudo que é público.
- **Site aberto, sem senha.** Galeria com `noindex` e fora do sitemap; home institucional indexável.
- **Privacidade com menores de idade** pesa em toda decisão (é o motivo do descarte de reconhecimento facial).
- **Repositório público** (`github.com/pedro123900/Recomecar`): **nenhum segredo commitado, nunca** (tokens, chaves, senhas). Conferir `.gitignore` antes de qualquer push que envolva configuração.
- **Tudo que varia entre edições é dado cadastrado pelo admin, nunca constante no código**: datas (inclusive a do pré-retiro), cronograma, momentos, tema, créditos. O site deve ser operável por futuras equipes Holly sem intervenção de desenvolvedor — adiar ou adiantar o retiro é editar quatro campos de data no formulário, e as abas do construtor se recalculam sozinhas.
- **Cronograma e conteúdo interno de retiro nunca entram em arquivo versionado** (nomes de momentos-surpresa, dinâmicas, nomes de pessoas): o repositório é público e revelaria as surpresas das próximas edições. Cronograma entra no sistema via admin (banco) ou arquivo local fora do git. Nenhum seed commitado pode conter cronograma real.

## Como trabalhar com o Pedro

- Pedro orquestra e revisa; **você implementa**. Trate-o como par técnico, não como leigo. Ele não coda na mão, mas lê código rápido.
- **Confirme com ele antes de qualquer ação que envolva conta** (push, deploy, criação de recursos Cloudflare, instalação global). Nunca use force push.
- **Você nunca executa `git commit` nem `git push`.** Ao concluir um bloco de trabalho, apresente a lista de arquivos a incluir e a mensagem de commit sugerida; o Pedro roda `git add`, `git commit` e `git push` ele mesmo no terminal.
- Migrations e schema: **mostrar para revisão antes de aplicar.**
- Idioma do site, do conteúdo e das rotas: **português (pt-BR)**.
- Teste sempre com **conteúdo real** (fotos reais com EXIF, livros reais, texto institucional real). Placeholder esconde slop.
- Trabalho visual segue o **loop de crítica do DESIGN.md** (screenshot Playwright → crítica → refino). Nunca aceite a primeira versão de uma tela.
- Trabalho em múltiplos agentes/worktrees: **somente com autorização explícita do Pedro**, e só depois da fundação pronta (schema e rotas congelados).

## Stack e infraestrutura (estado real)

| Item | Estado |
|---|---|
| Framework | **React Router 8** (framework mode) — versão instalada pelo template oficial da Cloudflare. Não sugerir troca de framework. |
| Hospedagem | Cloudflare Workers. Deploy em `https://recomecar.pedrovsilva.workers.dev` (URL provisória; domínio próprio virá). |
| Banco | Cloudflare D1 — `recomecar-db`, binding `DB` no `wrangler.jsonc`. Schema inicial aplicado (migration `0001_schema_inicial.sql`, local e remoto, 14/08/2026). |
| Mídia | Cloudflare R2 — bucket `recomecar-media` criado, binding `MEDIA` no `wrangler.jsonc`, deploy ativo. CORS do bucket (19/08/2026): PUT liberado para `http://localhost:5173` e `https://recomecar.pedrovsilva.workers.dev` — necessário para o upload direto do navegador. |
| Auth do admin | Cloudflare Access no `/admin` — configurar **depois** que o domínio próprio existir (config de painel, não de código). Até lá, `/admin` fica sem proteção e **sem dados sensíveis**. |
| Repositório | `github.com/pedro123900/Recomecar`, público, branch `main`. |
| Ambiente do Pedro | Windows + Git Bash, Node **22.16.0** (RR8 pede ≥22.22 — hoje só warning; atualização pendente), projeto em `C:\Projetos\recomecar`. |

## Comandos

- `npm run dev` — dev server com bindings locais. **Reiniciar depois de mudar `.dev.vars`** (só lê no boot).
- `npm test` — vitest (config própria em `vitest.config.ts`; o plugin Cloudflare do `vite.config.ts` quebra o runner).
- `npm run typecheck`
- `npx wrangler d1 migrations apply recomecar-db --local` (ou `--remote`)
- `npx wrangler secret list` — conferir secrets sem nunca pedir os valores.

## Mapa de rotas (contrato — não alterar sem o Pedro)

| Path | Página |
|---|---|
| `/` | Home do grupo (apresentação) |
| `/retiros` | Índice de retiros — cards das edições |
| `/retiros/:edicao` | Página do retiro: infos básicas + galeria completa **na mesma página** (ex.: `9-recomecar`) |
| `/biblioteca` | Biblioteca (vitrine de livros) |
| `/musica` | RecomeMusic (embed do álbum no Spotify) |
| `/admin` | Painel admin |
| `/admin/retiros` | Gestão de retiros (edições, tema, créditos) |
| `/admin/retiros/:edicao/cronograma` | Construtor de cronograma |
| `/admin/retiros/:edicao/upload` | Upload de mídia em lote |
| `/admin/biblioteca` | Gestão da biblioteca |

Menu público: **Retiros · Biblioteca · RecomeMusic** (rótulos decididos; path `/retiros` é fixo). Não existe seção "Eventos". Créditos da edição ficam no rodapé da página do retiro — sem rota própria. Lightbox de foto: overlay dentro de `/retiros/:edicao`, idealmente com URL compartilhável (query param ou rota filha) — detalhe de implementação livre.

## Modelo de dados (schema-alvo)

Formalizar na migration da fatia vertical (Pedro revisa antes de aplicar). Os campos abaixo são o contrato; detalhes de tipos/índices são seus.

- **retiros** — id, serie (`Recomeçar` | `Renascer`; existem as duas séries, não assumir regra além disso), numero, slug (ex.: `9-recomecar`), titulo, **dias lógicos como datas explícitas** (migration 0003): **data_pre (opcional, pré-retiro) + data_dia1, data_dia2, data_dia3 (obrigatórias)** — nenhuma inferência de intervalo; início/fim para exibição = dia1/dia3. O formato "pré opcional + 3 dias" é **estrutura do schema**: edição com número diferente de dias exigiria migration. Demais campos: padroeiro_nome, padroeiro_invocacao (opcional), **link_drive (opcional)**, tema (JSON com as cores da edição; ausente ⇒ tema padrão), publicado.
  - **Regra das edições antigas:** edição com `link_drive` preenchido e sem mídia no acervo ⇒ o card em `/retiros` abre o Google Drive externo daquela edição (nova aba). A estrutura interna do site começa no 9 Recomeçar. **Não haverá backfill** — decisão fechada; os Drives antigos permanecem como a cópia daquelas edições.
- **momentos** — id, retiro_id, nome, dia, inicio (datetime), fim (datetime), musica (opcional).
- **fotos** (fotos e vídeos) — id, retiro_id, arquivo_r2 (chave do original), tipo (`foto` | `video`), capturada_em (do EXIF, **já com offset de relógio aplicado**), **momento_id (FK persistida — decisão fechada)**, largura, altura (para aspect-ratio reservado na grade), duracao (vídeos).
  - `momento_id = NULL` significa "fora de qualquer janela" ⇒ exibir e filtrar como **"Geral / Bastidores"**.
- **livros** — id, titulo, autor (opcional), descricao, capa, ordem.
- **creditos** — id, retiro_id, nome, funcao (opcional), ordem.

Chaves R2 (convenção **ratificada em 18/08/2026**, implementada em `app/lib/chaves-r2.ts`): original em `<prefixo>/<slug>/originais/<ulid>.<ext>`; derivadas como função pura da chave do original, em `<prefixo>/<slug>/derivadas/<ulid>/{thumb,media,poster}` — **sem extensão**, Content-Type no metadata do objeto (o formato da thumb varia por navegador). Prefixo: `retiros` em produção; em dev/e2e `prefixoR2()` devolve **`_teste` — teste nunca escreve sob `retiros/`**.

## Motor de tags por cronograma (o coração — regras de negócio)

Ninguém etiqueta foto manualmente. O cronograma de cada retiro é cadastrado (momentos com dia, início, fim, nome, música). No upload, o horário de captura (EXIF) é cruzado com as janelas e as tags de dia/momento/música são aplicadas automaticamente. **Nenhuma etiqueta manual: o upload é 100% automático** (selecionar arquivos e enviar, sem nenhum campo). As tags são o sistema de busca/filtro do site (dia + momento + música, combináveis).

Regras fixas:

- Janela **semiaberta**: `inicio <= capturada_em < fim`.
- No construtor de cronograma, o fim de um momento = início do próximo (preenchido automaticamente).
- Fallback: sem janela correspondente ⇒ `momento_id NULL` ⇒ "Geral / Bastidores".
- **Pré-retiro é um dia lógico a mais do mesmo retiro** (`data_pre`, opcional; aba "Pré-retiro" no construtor): dia inteiro de programação no sábado anterior ao fim de semana do retiro, com momentos e tags normais — nada muda no upload. O **buraco de ~uma semana entre o pré e a sexta é normal**: fotos nesse intervalo caem em "Geral / Bastidores". Se as datas do retiro mudarem com cronograma existente, momentos com `dia` fora dos dias lógicos geram **aviso** ao salvar (não bloqueio) e o re-tag roda.
- **Offset de relógio por aparelho** aplicado a `capturada_em` **antes** do match (câmera com hora errada). O aparelho é identificado pelos metadados EXIF de câmera (marca, modelo e número de série quando existir); o sistema agrupa as fotos por aparelho automaticamente, e corrigir um aparelho corrige todas as fotos dele, independente de quem subiu ou em qual leva. O offset **não aparece no fluxo de upload** (que não tem campo nenhum): vive numa tela de manutenção do admin ("ajustar relógio de um aparelho"), usada apenas quando um erro de relógio for descoberto. A mitigação primária continua sendo o checklist pré-retiro: conferir data, hora e fuso de cada câmera antes da sexta-feira.
- Vídeos podem guardar a data em campo EXIF diferente do de fotos — **testar com o equipamento real** quando o material chegar.
- Atraso no retiro corrige-se **editando a janela no cronograma** ⇒ re-tag retroativo automático ao salvar:

```sql
UPDATE fotos
SET momento_id = (SELECT id FROM momentos m
                  WHERE m.retiro_id = fotos.retiro_id
                    AND fotos.capturada_em >= m.inicio
                    AND fotos.capturada_em <  m.fim)
WHERE retiro_id = :retiro
```

O bloco acima é **semântica de referência, não código a copiar**: a implementação é `calcularRetag`/`aplicarRetag` (`app/lib/motor.ts`, `app/lib/retag.server.ts`), **única fonte do re-tag — nunca duplicar SQL nas rotas**.

**Regras expostas pelo cronograma real** (análise de uma edição passada, que validou o schema como está):

- **Dia lógico ≠ dia de calendário** — confirmado na prática: a "sexta" vai até 1:30, o "sábado" até 0:00. Exibição e agrupamento por "Dia" no site vêm **sempre** do campo `dia` do momento, **nunca** de `date(capturada_em)`.
- **Virada da meia-noite no construtor:** dentro de um dia lógico, horário digitado menor que o do momento anterior significa **+1 dia no calendário**, mantendo o dia lógico da aba. O último momento de cada dia tem o fim digitado manualmente (não há próximo para encadear).
- **Sobreposição de janelas é legítima** — trilhas paralelas de encontristas × equipes existem no cronograma real. O construtor avisa, mas não bloqueia. Desempate do re-tag: **comportamento provisório implementado e testado** (menor `inicio`, depois menor `id`); o desempate definitivo continua aberto para a fase do motor — direção provável: janela mais específica.
- **Bastidores herdam dia lógico pela faixa do dia** (do primeiro momento do dia N até o primeiro momento do dia N+1) — refinamento da fase do motor, não de schema.

UX validada do construtor (especificação em texto; não há arquivo de mockup): abas por dia, encadeamento de horários, avisos de buraco/sobreposição, clonar edição anterior, prévia viva.

## Pipeline de mídia

- Derivadas geradas **no navegador do admin durante o upload** (Workers não executam binário nativo — sharp/ffmpeg impossíveis no servidor):
  - Thumb ~**400px WebP** (fallback JPEG) para a grade; média ~**1600px** para o lightbox; **original preservado** para download.
  - Poster de vídeo: frame capturado via `<video>` + canvas.
  - EXIF lido com **exifr**. Upload direto ao R2 com **URLs assinadas**.
- Grade: `loading="lazy"`, aspect-ratio reservado (zero layout shift), blur-up.
- **Download individual apenas.** Sem ZIP/download em lote (decisão fechada).
- **Sem marcação de pessoas em nenhuma forma** (nem campo no banco). **Reconhecimento facial descartado por LGPD** (biometria = dado sensível, art. 11; menores, art. 14). Não repropor, nem "versão light".
- Plano B (só se o pipeline no navegador incomodar o Pedro): Cloudflare Images ~US$5/mês.

## Escopo v1 (lançamento) — dentro e fora

**Dentro:** home do grupo + página completa do 9 Recomeçar (infos + galeria com navegação por pastas Dia → Momento **e** linha do tempo cronológica com cabeçalhos do cronograma e músicas, lightbox com player de vídeo, filtros combináveis, download individual) + índice de retiros com cards de todas as edições (antigas → link Drive) + biblioteca + RecomeMusic + admin único.

**Fora (não implementar, não sugerir como novidade):** backfill das edições antigas; reconhecimento facial; marcação de pessoas; empréstimo na biblioteca; página institucional para externos; ZIP; tema por edição aplicado à **página inteira** (a arquitetura por tokens nasce pronta — ver DESIGN.md — mas ativar página tematizada é extra pós-v1; o layout tematizado do 9 será decidido pelo time depois). O nível de tema que **entra** na v1 é o do esboço: cor própria por card no índice.

## SEO e privacidade

Rotas de galeria (`/retiros/:edicao`) com meta robots `noindex` e fora do sitemap. Home indexável. Nada de analytics invasivo; se medição for necessária um dia, o Pedro decide a ferramenta.

## Custos (por que as decisões são o que são)

- **R2:** 10GB grátis; depois US$ 0,015/GB/mês; **egress US$ 0 — a fundação do modelo**; 1M escritas + 10M leituras/mês grátis (excedente ~US$ 0,36/milhão de leituras).
- **D1:** grátis até 10GB, **sem pausa por inatividade**. **Access:** grátis ≤50 usuários. **Workers:** free tier cobre o volume do grupo.
- Premissa de volume (**estimativa do Pedro, ainda não medida**): ~60GB por retiro, 2 retiros/ano. Quando o Drive de uma edição antiga chegar, **medir o volume real** e substituir a premissa nos planejamentos.
- Normalização de vídeo no upload (reduzir bitrate/resolução do original): **decisão em aberto para a fase do motor** — derrubaria o volume pela metade ou mais. Não implementar sem o Pedro decidir.

## Becos sem saída (já avaliados — não retentar)

Svelte/SvelteKit + Vercel (banda paga, Hobby proíbe uso comercial, duas plataformas); S3/Supabase Storage para mídia (egress pago); Supabase free como banco (pausa após 7 dias inativo); sharp/ffmpeg no servidor (Workers sem binário nativo); reconhecimento facial (LGPD); NFC para photobooth (não dispara; solução satélite fora do caminho crítico: botão Bluetooth + MacroDroid em Android); UIColors (ficou pago; alternativas: Realtime Colors, tints.dev, Coolors); mockup via gerador de imagem (substituído pelo loop código + screenshot + crítica); identidades navy/teal e marrom/dourado (descartadas — a identidade atual, do Tuti, está no DESIGN.md).

## Próximo marco: a fatia vertical do motor

Sequência e estado (18/08/2026): migrations **0001–0004 aplicadas** local e remoto → admin cru de retiros + construtor de cronograma **pronto** → motor de tags com TDD e re-tag retroativo ligado no salvar **pronto** → upload sem campos **implementado** (EXIF real via exifr, derivadas no navegador, URL assinada; secrets R2 criados) → e2e do upload **passou em 19/08/2026** (15 checagens, incluindo re-tag retroativo ao editar janela — o critério de pronto — mais regressão do admin cru e 41 testes de unidade) → **falta:** grade simples exibe + download funciona (item 4) → ~20 fotos **reais** com EXIF verificado.

**Critério de pronto (o teste de vida do projeto):** tags corretas nas fotos reais **+ re-tag retroativo funcionando ao editar uma janela do cronograma**. Enquanto isso não passa, nada de alargar escopo.

Depois da fatia: galeria pública completa → admin completo → aplicação do design (DESIGN.md) → semana final de teste com a equipe.

## Pendências fora do código (com dono — não são suas tarefas)

- **Pedro:** material real (fotos originais com EXIF — WhatsApp destrói EXIF, tem que vir do arquivo original; cronograma real de uma edição passada; lista de livros com capa e descrição; link do álbum no Spotify; nomes dos créditos); links dos Google Drives + nome/série/padroeiro das 8 edições antigas (para os cards); domínio próprio; licença comercial da fonte More Sugar; Node ≥ 22.22; possível migração para conta Cloudflare do grupo (janela ideal: antes do upload em massa e do domínio); token de API do R2 (S3, escopo no bucket) para as URLs assinadas de upload — criar quando a fatia chegar nessa etapa, e guardar via `wrangler secret`, nunca no repositório.
- **Tuti:** carimbo final do `#F8E2C5` na primeira tela implementada; artes dos cards das edições; futuramente, layout tematizado do 9.
- **Cloudflare Access** no `/admin`: configurar quando o domínio existir.
