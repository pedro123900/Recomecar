# Recomeçar

Site oficial do **Grupo Recomeçar**, grupo jovem católico da Paróquia São Pedro de Alcântara, sob a proteção de Nossa Senhora das Graças.

O produto principal é a **galeria multi-retiro**: um acervo permanente de fotos e vídeos que substitui os Google Drives soltos de cada edição. Completam o site a **Biblioteca** (vitrine do acervo de livros do grupo) e o **RecomeMusic** (o álbum do grupo).

Em desenvolvimento. Estreia com o 9° Recomeçar, em setembro de 2026.

## Como a galeria se organiza sozinha

Nenhuma foto é etiquetada à mão. O cronograma do retiro é cadastrado no admin (momentos com dia lógico, início e fim) e cada foto entra pela data e hora de captura do EXIF: o motor cruza o timestamp com as janelas do cronograma e a foto cai sozinha no momento certo. Adiar o retiro inteiro é editar quatro campos de data.

São três sistemas de organização, todos dado cadastrável, nada fixo em código:

1. **Tempo do retiro** — momentos do cronograma; a foto entra pela janela `inicio <= t < fim`.
2. **Preparação** — eventos avulsos nos meses antes do retiro (adorações, reuniões, ação social), com match por dia.
3. **Álbuns** — coleções curadas fora do tempo (equipes, partilhas, destaques), montadas por seleção múltipla no admin.

Regra mestra: cada foto vive em exatamente um sistema temporal, na cascata **momento → evento → Geral**, do mais específico ao mais geral. Álbum é sobreposição curada, não sistema temporal: dado é fato, exibição é escolha.

## Stack

- **React Router 8** (framework mode) rodando em **Cloudflare Workers**
- **D1** (SQLite) para os dados e **R2** para as mídias
- EXIF lido com exifr; derivadas (thumb, média, poster de vídeo) geradas no navegador do admin; upload direto ao R2 via URL assinada

A escolha da Cloudflare é estrutural: o egress zero do R2 é o que permite centenas de pessoas baixando fotos livremente a custo próximo de zero para o grupo.

## Desenvolvimento

Requisitos: Node 22.22+ e uma conta Cloudflare com Workers, D1 e R2.

```bash
npm install
npm run dev        # servidor local
npm test           # suíte de testes
npm run typecheck  # verificação de tipos
```

As migrations ficam em `migrations/`, numeradas, e são aplicadas com o Wrangler (`wrangler d1 migrations apply recomecar-db`, com `--local` ou `--remote`).

Credenciais locais vivem em `.dev.vars` (ignorado pelo git); em produção, em secrets do Wrangler. Este repositório é público: **nenhum segredo é commitado, nunca**.

## Documentos do projeto

- `CLAUDE.md` — a constituição técnica: escopo, schema, motor de etiquetagem e processo de trabalho.
- `DESIGN.md` — a identidade visual: tokens de cor, regras de emprego, proibições e processo de verificação.
- `design/referencias/` — os esboços de referência da identidade.

## Privacidade

O site é aberto, no mesmo modelo dos Drives com link que ele substitui, e as páginas de galeria levam `noindex`. Não há marcação de pessoas nem reconhecimento facial, por decisão de projeto. Cronogramas reais e conteúdo interno dos retiros não entram em arquivo versionado: são dados cadastrados no admin.

 Feito pelo Grupo Recomeçar, para o Grupo Recomeçar.
