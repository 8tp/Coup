import type { NamespaceTranslation } from '../../schema';

/**
 * es `rules`. Glossary params have known genders here, so they take articles:
 * el {duke}, la {contessa}, la {steal} (Extorsión), la {foreignAid},
 * el {coup}, la {reserve}, la {convert}, el {embezzle}, el {examine}.
 */
const rules: NamespaceTranslation<'rules'> = {
  title: 'Cómo se juega',

  'tab.overview': 'Resumen',
  'tab.characters': 'Personajes',
  'tab.rules': 'Acciones y reglas',

  'overview.whatIsHeading': 'Qué es Coup',
  'overview.whatIs': 'Coup es un juego de faroles para {minPlayers} a {maxPlayers} jugadores. Cada jugador empieza con dos cartas boca abajo, que son su influencia, y {startingCoins, plural, one {# moneda} other {# monedas}}. Gana el último jugador que conserve una carta boca abajo.',
  'overview.goalHeading': 'Objetivo',
  'overview.goal': 'Haz que los demás pierdan su influencia. Cuando pierdes una influencia, pones una de tus cartas boca arriba. Si pierdes las dos, quedas fuera.',
  'overview.flowHeading': 'Cómo va un turno',
  'overview.flow1': 'En tu turno, haces una acción. Algunas acciones declaran un personaje.',
  'overview.flow2': 'Cualquier otro jugador puede <term>desafiar</term> una declaración. Si mentías, pierdes una influencia. Si no, la pierde quien te desafió.',
  'overview.flow3': 'Algunas acciones se pueden <term>bloquear</term> declarando el personaje que las contrarresta. Quien hizo la acción puede desafiar el bloqueo.',
  'overview.flow4': 'Si nadie desafía ni bloquea, la acción se cumple.',
  'overview.bluffHeading': 'Faroles',
  'overview.bluff': 'Puedes declarar cualquier personaje, tengas la carta o no. Una declaración solo te cuesta algo si alguien la desafía y mentías.',
  'overview.creditsHeading': 'Sobre el juego original',
  'overview.credits': 'Coup es un juego de cartas diseñado por <term>{designer}</term> y publicado en 2012 por <term>{publisher1}</term> e <term>{publisher2}</term>. Esta es una adaptación hecha por fans. Si te gusta, apoya a sus creadores <link>comprando el juego físico</link>.',

  'character.Duke': '{tax}: toma {taxCoins, plural, one {# moneda} other {# monedas}}. Bloquea la {foreignAid}.',
  'character.Assassin': '{assassinate}: paga {assassinateCost, plural, one {# moneda} other {# monedas}}. El objetivo pierde una carta.',
  'character.Captain': '{steal}: quita {stealCoins, plural, one {# moneda} other {# monedas}} al objetivo. Bloquea la {steal}.',
  'character.Ambassador': '{exchange}: saca {exchangeDraw}, devuelve {exchangeDraw}. Bloquea la {steal}.',
  'character.Contessa': 'Bloquea el Asesinato.',
  'character.Inquisitor': '{exchange}: saca {inquisitorDraw}, devuelve {inquisitorDraw}. {examine}: mira una carta de un rival. Bloquea la {steal}.',

  actionsHeading: 'Acciones',
  'table.action': 'Acción',
  'table.cost': 'Precio',
  'table.effect': 'Efecto',
  'table.claims': 'Declara',
  'table.blockedBy': 'Lo bloquea',
  'effect.gain': '+{amount, plural, one {# moneda} other {# monedas}}',
  'effect.loseInfluence': 'El objetivo pierde influencia',
  'effect.steal': 'Quita {stealCoins, plural, one {# moneda} other {# monedas}} al objetivo',
  'effect.exchange': 'Saca {exchangeDraw} y quédate las que quieras',
  'table.pair': '{first}, {second}',
  challengeHeading: 'Desafíos',
  challenge: 'Cualquier jugador puede desafiar una declaración, sea para una acción o para un bloqueo. Si quien declaró tiene la carta, la muestra, la mezcla en el mazo y saca otra, y quien desafió pierde una influencia. Si no la tiene, pierde una influencia quien declaró.',
  blockHeading: 'Bloqueos',
  block: 'Algunas acciones se pueden bloquear declarando el personaje que las contrarresta. Un bloqueo es una declaración, así que se puede desafiar, y puedes bloquear de farol.',
  forcedHeading: '{coup} obligatorio',
  forced: 'Si empiezas tu turno con {forcedCoup, plural, one {# moneda o más} other {# monedas o más}}, tienes que lanzar un {coup}.',

  'reformation.whatIsHeading': 'Qué es {reformation}',
  'reformation.whatIs': '{reformation} es una expansión que añade facciones, tres acciones ({convert}, {embezzle} e {examine}) y el <inq>{inquisitor}</inq>. Actívala en los ajustes de la sala antes de empezar la partida.',
  'reformation.quickStartHeading': 'Guía rápida',
  'reformation.quick1': 'Mira las marcas de facción antes de elegir un objetivo: <loy>{loyalistMark}</loy> y <ref>{reformistMark}</ref>.',
  'reformation.quick2': 'Usa la {convert} para poder elegir objetivo, salvar a un aliado o meter monedas en la Reserva.',
  'reformation.quick3': 'Usa el {embezzle} solo cuando la Reserva valga el riesgo de un desafío.',
  'reformation.quick4': 'Con el {inquisitor}, el {exchange} saca {inquisitorDraw, plural, one {# carta} other {# cartas}} en vez de {exchangeDraw}, y el {examine} te deja ver una carta de otro jugador.',
  markLoyalist: '▲ LEAL',
  markReformist: '◆ REF',
  'reformation.openWalkthrough': 'Abrir la guía paso a paso',
  'reformation.factionsHeading': 'Facciones',
  'reformation.factions': 'Cada jugador es <loy>▲ {loyalist}</loy> o <ref>◆ {reformist}</ref>. No puedes usar {coup}, {assassinate}, {steal} ni {examine} contra alguien de tu propia facción. Cuando todos los que quedan son de la misma facción, cualquiera puede elegir a cualquiera como objetivo. Mientras sigan las dos facciones, solo la otra facción puede bloquear tu {foreignAid}.',
  'reformation.newActionsHeading': 'Acciones nuevas',
  'reformation.convert': '<name>{convert}:</name> paga {convertSelfCost, plural, one {# moneda} other {# monedas}} para cambiar tu facción, o {convertOtherCost, plural, one {# moneda} other {# monedas}} para cambiar la de otro jugador. Las monedas van a la {reserve}. Nadie puede desafiarla ni bloquearla.',
  'reformation.embezzle': '<name>{embezzle}:</name> llévate todas las monedas de la {reserve} declarando que no tienes {duke}. El desafío funciona al revés: quien desafía gana si tienes uno.',
  'reformation.examine': '<inq>{examine}:</inq> declara el {inquisitor}. Tu objetivo elige una de sus cartas boca abajo para mostrártela. Después se la devuelves o haces que la cambie por una carta al azar del mazo.',
  'reformation.inquisitor': 'Sustituye al {ambassador} cuando está activado. El {inquisitor} puede usar {exchange} (sacando {inquisitorDraw, plural, one {# carta} other {# cartas}} en vez de {exchangeDraw}), usar {examine} con la carta de otro jugador y bloquear la {steal} como el {captain}.',
  'reformation.reserve': 'Un montón de monedas aparte de la Banca. Los pagos de {convert} entran en ella y el {embezzle} se las lleva todas.',
};

export default rules;
