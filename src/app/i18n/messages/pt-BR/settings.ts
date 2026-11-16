import type { NamespaceTranslation } from '../../schema';

/** pt-BR `settings`. */
const settings: NamespaceTranslation<'settings'> = {
  title: 'Configurações',
  soundEffects: 'Efeitos sonoros',
  music: 'Música',
  musicVolume: 'Volume da música',
  musicVolumeBalanced: 'Equilibrado',
  musicVolumeDb: '{db} dB',
  haptics: 'Vibração',
  reducedMotion: 'Menos animação',
  textSize: 'Tamanho do texto',
  textSizeNormal: 'Normal',
  textSizeLarge: 'Grande',
  textSizeXl: 'Muito grande',
  language: 'Idioma',
  languageAuto: 'Igual ao dispositivo',
  languageInProgress: 'Tradução em andamento',
  learning: 'Aprender',
  tutorial: 'Tutorial para iniciantes',
  coachedBots: 'Com dicas · {count, plural, =0 {# bots} one {# bot} other {# bots}}',
  help: 'Ajuda e sugestões',
  feedbackOpen: 'Relatar um bug ou ideia',
  githubIssue: 'Abrir uma issue no GitHub',
};

export default settings;
