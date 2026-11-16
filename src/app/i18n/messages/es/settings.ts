import type { NamespaceTranslation } from '../../schema';

/** es `settings`. */
const settings: NamespaceTranslation<'settings'> = {
  title: 'Ajustes',
  soundEffects: 'Efectos de sonido',
  music: 'Música',
  musicVolume: 'Volumen de la música',
  musicVolumeBalanced: 'Equilibrado',
  musicVolumeDb: '{db} dB',
  haptics: 'Vibración',
  reducedMotion: 'Menos animaciones',
  textSize: 'Tamaño del texto',
  textSizeNormal: 'Normal',
  textSizeLarge: 'Grande',
  textSizeXl: 'Muy grande',
  language: 'Idioma',
  languageAuto: 'Igual que el dispositivo',
  languageInProgress: 'Traducción en curso',
  learning: 'Aprender',
  tutorial: 'Tutorial para principiantes',
  coachedBots: 'Con consejos · {count, plural, one {# bot} other {# bots}}',
  help: 'Ayuda y comentarios',
  feedbackOpen: 'Informar de un error o idea',
  githubIssue: 'Abrir una incidencia en GitHub',
};

export default settings;
