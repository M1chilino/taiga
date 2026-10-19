import type { ImageMetadata } from 'astro';

const images = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/feedbacks/*.{jpg,jpeg,png,webp,avif}',
  { eager: true },
);

/** Até 3 prints de feedback, em ordem alfabética. Faltando, vira espaço reservado. */
export const feedbacks: (ImageMetadata | null)[] = Object.entries(images)
  .sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true }))
  .map(([, mod]) => mod.default)
  .slice(0, 3);

while (feedbacks.length < 3) feedbacks.push(null);
