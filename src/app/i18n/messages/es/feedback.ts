import type { NamespaceTranslation } from '../../schema';

/** es `feedback`. */
const feedback: NamespaceTranslation<'feedback'> = {
  title: 'Enviar comentarios',
  kindLabel: 'Tipo de nota',
  'kind.bug': 'Error',
  'kind.idea': 'Idea',
  'kind.other': 'Otro',
  'placeholder.bug': 'Cuéntanos qué pasó y qué esperabas.',
  'placeholder.idea': 'Cuéntanos qué cambiarías o añadirías.',
  'placeholder.other': 'Cuéntanos lo que quieras.',
  noteLabel: 'Tu nota',
  privacy: 'Se envía sin tu nombre ni el código de sala.',
  send: 'Enviar',
  sending: 'Enviando',
  retry: 'Reintentar',
  sent: 'Enviado. Gracias por la nota.',
  sentDetail: 'Le llega directamente al desarrollador.',
  writeAnother: 'Escribir otra',
  githubInstead: 'Abrir una incidencia en GitHub',
  'error.invalid': 'No se pudo enviar la nota. Inténtalo de nuevo.',
  'error.empty': 'Escribe algo primero.',
  'error.too_long': 'Usa menos de {max} caracteres.',
  'error.rate_limited': 'Ya enviaste varias notas. Vuelve a intentarlo en unos minutos.',
  'error.busy': 'Ahora mismo llegan demasiadas notas. Vuelve a intentarlo en unos minutos.',
  'error.server_error': 'No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.',
};

export default feedback;
