import type { NamespaceTranslation } from '../../schema';

/**
 * es `seo`. Written for searches such as "jugar coup online", "coup online
 * gratis", "coup juego de cartas" and "coup ciudad corrupta" (the Spanish
 * edition by Zacatrus). Names follow the Spanish edition: Duque, Capitán,
 * Ingreso, Ayuda exterior, Impuestos, Extorsión, Reforma.
 */
const seo: NamespaceTranslation<'seo'> = {
  title: 'Jugar Coup online gratis: juego de cartas con amigos o bots',
  description: 'Juega gratis a Coup online, el juego de cartas de faroles, con amigos o contra bots. De 2 a 6 jugadores, sin registro y desde el navegador.',
  ogTitle: 'Coup Online',
  ogImageAlt: 'Coup Online, un juego de cartas de faroles multijugador',
  manifestDescription: 'Coup multijugador en tiempo real. Engaña y desafía a tus amigos o a bots, sin crear cuenta.',

  aboutHeading: 'Sobre Coup Online',
  aboutIntro: 'Coup Online es una versión web gratuita de Coup, el juego de cartas de faroles y deducción para {min, number} a {max, number} jugadores, publicado en español como Coup: Ciudad Corrupta. Cada jugador empieza con 2 cartas de personaje boca abajo, que son su influencia, y 2 monedas. Puedes declarar cualquier personaje, tengas esa carta o no. Si pierdes las dos cartas, quedas fuera. Gana el último jugador que conserve una carta.',
  roundHeading: 'Cómo es un turno',
  roundBody: 'En tu turno haces una acción. El Ingreso y la Ayuda exterior te dan monedas. Una acción de personaje, como los Impuestos del Duque o la Extorsión del Capitán, es una declaración de que tienes esa carta. Cualquier jugador puede desafiar una declaración: si era un farol, quien mintió pierde una carta, y si era verdad, la pierde quien desafió. Algunas acciones se pueden bloquear declarando el personaje adecuado, y un bloqueo también se puede desafiar. Con {coupCost, number} monedas puedes lanzar un Coup, que le quita una carta a cualquier jugador y no se puede bloquear. Con {forcedCoup, number} monedas es obligatorio.',
  freeHeading: 'Gratis y sin cuenta',
  freeBody: 'Coup Online es gratis. No hace falta registrarse: escribe un nombre y juega. Funciona en el navegador del teléfono, la tableta o la computadora, y puedes añadirlo a tu pantalla de inicio como una app.',
  faqHeading: 'Preguntas frecuentes',
  faqFriendsQ: '¿Puedo jugar Coup online con amigos?',
  faqFriendsA: 'Sí. Crea una sala y comparte su código de 4 letras o el enlace de invitación. Tus amigos entran desde su teléfono o su computadora, sin crear cuenta.',
  faqBotsQ: '¿Puedo jugar Coup contra bots?',
  faqBotsA: 'Sí. Jugar con bots empieza al momento una partida contra {bots, plural, one {# rival controlado por la máquina} other {# rivales controlados por la máquina}}. También puedes añadir bots a una sala con amigos y elegir el estilo de juego de cada uno.',
  faqPhoneQ: '¿Se puede jugar en el celular o el móvil?',
  faqPhoneA: 'Sí. Funciona en el navegador de Android y iPhone, sin descargar nada. Añádelo a tu pantalla de inicio para abrirlo como una app.',
  faqFreeQ: '¿Coup Online es gratis?',
  faqFreeA: 'Sí. Todos los modos de juego son gratis y nunca necesitas una cuenta.',
  faqPlayersQ: '¿Cuántos jugadores pueden jugar?',
  faqPlayersA: 'De {min, number} a {max, number} jugadores. Los bots pueden ocupar los lugares libres, así que también puedes jugar por tu cuenta.',
  faqReformationQ: '¿Qué es la expansión Reforma?',
  faqReformationA: 'Reforma divide la mesa en dos facciones, Leales y Reformistas. Mientras sigan las dos facciones en juego, no puedes usar Coup, Asesinato ni Extorsión contra tu propio bando. Añade las acciones Conversión y Desfalco y la Reserva, y el Inquisidor puede sustituir al Embajador. El anfitrión la activa en la sala de espera.',
  credit: 'Coup Online es una adaptación no oficial hecha por fans de Coup, un juego de cartas diseñado por Rikki Tahta y publicado por La Mame Games e Indie Boards & Cards. No está afiliado a ellos ni cuenta con su aprobación.',
  languages: 'Idioma',
  suggestion: 'Leer en español',
  suggestionDismiss: 'Cerrar',
};

export default seo;
