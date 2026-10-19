# Taiga - site

Landing page / portfólio da agência Taiga, feita com [Astro](https://astro.build), GSAP e Lenis.

## Comandos

| Comando           | O que faz                              |
| ----------------- | -------------------------------------- |
| `npm install`     | Instala as dependências                |
| `npm run dev`     | Servidor de desenvolvimento (:4321)    |
| `npm run build`   | Gera o site final em `dist/`           |
| `npm run preview` | Serve o build para conferir            |
| `npx astro check` | Verifica erros de tipos                |

## Onde mexer

- **WhatsApp e textos gerais:** `src/config.ts` (troque `WHATSAPP_NUMBER`, formato `5516999999999`) e os números da faixa (`STATS`).
- **Serviços:** `src/data/services.ts`.
- **Carrossel do hero:** coloque imagens (.jpg, .png, .webp) e vídeos (.mp4, .webm) em `src/assets/trabalhos/`. Entram sozinhos, em ordem alfabética (01-, 02-...). Vazia = cards de exemplo.
- **Feedbacks:** coloque até 3 prints em `src/assets/feedbacks/`.
- **Logos:** `src/assets/logos/` (verde `#00543F`, branco `#EBEBEB`, preto).
- **Cores e fontes:** variáveis no topo de `src/styles/global.css`.
- **Animações:** `src/scripts/motion.ts` (respeita `prefers-reduced-motion`).
- **3D do hero (logo + folhas):** `src/scripts/hero3d.ts`. **Palavras no fundo do hero:** lista `words` em `src/components/Hero.astro`.
- **Ícones 3D dos serviços:** `src/scripts/icons3d.ts` (o ícone de cada serviço é o campo `icon` em `src/data/services.ts`).
- **Menu:** `src/components/Header.astro`.

## Skills instaladas (agente)

`.agents/skills/` e `.claude/skills/`: `frontend-design` (Anthropic) e as skills oficiais de GSAP (GreenSock).
