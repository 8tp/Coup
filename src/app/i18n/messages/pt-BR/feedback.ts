import type { NamespaceTranslation } from '../../schema';

/** pt-BR `feedback`. */
const feedback: NamespaceTranslation<'feedback'> = {
  title: 'Enviar comentário',
  kindLabel: 'Tipo de mensagem',
  'kind.bug': 'Bug',
  'kind.idea': 'Ideia',
  'kind.other': 'Outro',
  'placeholder.bug': 'Conte o que aconteceu e o que você esperava.',
  'placeholder.idea': 'Conte o que você mudaria ou acrescentaria.',
  'placeholder.other': 'Pode falar o que quiser.',
  noteLabel: 'Sua mensagem',
  privacy: 'Enviada sem seu nome nem o código da sala.',
  send: 'Enviar',
  sending: 'Enviando',
  retry: 'Tentar de novo',
  sent: 'Enviada. Obrigado pela mensagem.',
  sentDetail: 'Ela vai direto para o desenvolvedor.',
  writeAnother: 'Escrever outra',
  githubInstead: 'Abrir uma issue no GitHub',
  'error.invalid': 'Não deu para enviar essa mensagem. Tente de novo.',
  'error.empty': 'Escreva algumas palavras antes.',
  'error.too_long': 'Use no máximo {max} caracteres.',
  'error.rate_limited': 'Você já enviou várias mensagens. Tente de novo daqui a alguns minutos.',
  'error.busy': 'Estão chegando mensagens demais agora. Tente de novo daqui a alguns minutos.',
  'error.server_error': 'Não deu para enviar. Verifique sua conexão e tente de novo.',
};

export default feedback;
