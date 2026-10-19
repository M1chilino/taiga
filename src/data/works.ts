import type { ImageMetadata } from 'astro';

export type Work =
  | { kind: 'image'; src: ImageMetadata; ratio: '4/5' | '9/16' }
  | { kind: 'video'; src: string; ratio: '9/16' }
  | { kind: 'placeholder'; variant: number; ratio: '4/5' | '9/16' };

const images = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/trabalhos/*.{jpg,jpeg,png,webp,avif}',
  { eager: true },
);
const videos = import.meta.glob<string>('/src/assets/trabalhos/*.{mp4,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const real: { path: string; work: Work }[] = [
  ...Object.entries(images).map(([path, mod]): { path: string; work: Work } => ({
    path,
    work: {
      kind: 'image',
      src: mod.default,
      ratio: mod.default.height / mod.default.width >= 1.6 ? '9/16' : '4/5',
    },
  })),
  ...Object.entries(videos).map(([path, src]): { path: string; work: Work } => ({
    path,
    work: { kind: 'video', src, ratio: '9/16' },
  })),
].sort((a, b) => a.path.localeCompare(b.path, 'pt-BR', { numeric: true }));

/** Cards de exemplo, usados enquanto a pasta src/assets/trabalhos estiver vazia. */
const placeholders: Work[] = Array.from({ length: 8 }, (_, i) => ({
  kind: 'placeholder',
  variant: i,
  ratio: i % 2 === 0 ? '9/16' : '4/5',
}));

export const works: Work[] = real.length ? real.map((r) => r.work) : placeholders;
export const usingPlaceholders = real.length === 0;
