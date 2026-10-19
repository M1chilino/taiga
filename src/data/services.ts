export interface Service {
  id: string;
  icon: 'search' | 'chart' | 'play';
  name: string;
  summary: string;
  items: string[];
  note?: string;
  badge?: string;
}

export const SERVICES: Service[] = [
  {
    id: 'analise',
    icon: 'search',
    name: 'Análise de perfil',
    summary:
      'Entendemos o seu perfil por inteiro antes de mexer em qualquer coisa: o que funciona, o que trava e onde estão as oportunidades.',
    items: [
      'Análise completa do perfil do Instagram, para entender o que precisa melhorar',
      'Pesquisa de mercado e de concorrência',
      'Manual de marca com paleta de cores, tipografia e padrão visual',
    ],
    note: 'A profundidade da análise e as entregas mudam de acordo com o pacote escolhido. Fale com a gente para ver qual encaixa no seu momento.',
  },
  {
    id: 'gestao',
    icon: 'chart',
    name: 'Gestão de perfil',
    summary:
      'Cuidamos do seu Instagram de ponta a ponta, do planejamento à publicação, com acompanhamento de resultados.',
    items: [
      'Cuidado diário com o perfil',
      'Criação de estratégia de conteúdo',
      'Design dos posts',
      'Captação de vídeos',
      'Relatório de métricas',
      'Agendamento e postagem',
    ],
  },
  {
    id: 'videos',
    icon: 'play',
    name: 'Captação de vídeos',
    summary:
      'Vídeos pensados para o seu perfil, entregues prontos para postar.',
    items: [
      'Roteirização',
      'Gravação',
      'Edição de um ou mais vídeos, pronto para postar',
    ],
    badge: 'Atendimento apenas em São Carlos - SP',
  },
];
