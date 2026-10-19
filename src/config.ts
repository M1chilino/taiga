/** Dados editáveis do site. */
export const SITE = {
  name: 'Taiga',
  title: 'Taiga | Agência de marketing e conteúdo para Instagram',
  description:
    'A Taiga cuida da imagem da sua marca no Instagram: análise de perfil, gestão de perfil e captação de vídeos em São Carlos - SP.',
  city: 'São Carlos - SP',
};

/** Número do WhatsApp com código do país e DDD, só dígitos. TROCAR pelo número real. */
export const WHATSAPP_NUMBER = '5516000000000';
export const WHATSAPP_MESSAGE =
  'Olá! Vi o portfólio da Taiga e quero saber mais sobre os serviços.';

export const whatsappUrl = (message = WHATSAPP_MESSAGE) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

export const STATS = [
  { value: 100, label: 'vídeos produzidos' },
  { value: 300, label: 'designs criados' },
  { value: 10, label: 'clientes atendidos' },
];
