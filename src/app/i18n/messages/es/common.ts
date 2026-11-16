import type { NamespaceTranslation } from '../../schema';

/** es `common`. */
const common: NamespaceTranslation<'common'> = {
  done: 'Listo',
  close: 'Cerrar',
  cancel: 'Cancelar',
  back: 'Atrás',
  settings: 'Ajustes',
  dialog: 'Diálogo',
  secondsShort: '{seconds}s',
  secondsRemaining: '{seconds, plural, one {Queda # segundo} other {Quedan # segundos}}',
};

export default common;
