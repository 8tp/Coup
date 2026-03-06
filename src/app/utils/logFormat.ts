/**
 * Formats a log message by replacing the viewer's name with "You",
 * adjusting verb conjugation and possessives accordingly.
 */
export function formatLogMessage(message: string, myName: string): string {
  if (!myName) return message;

  // Replace possessive form: "Alice's" → "your"
  const possessiveRegex = new RegExp(`${escapeRegExp(myName)}'s`, 'g');
  let result = message.replace(possessiveRegex, 'your');

  // Replace "Name verb" patterns with "You verb" (adjusted conjugation)
  // Common third-person singular verbs in log messages
  const verbMap: Record<string, string> = {
    takes: 'take',
    claims: 'claim',
    declares: 'declare',
    launches: 'launch',
    challenges: 'challenge',
    blocks: 'block',
    loses: 'lose',
    completes: 'complete',
    collects: 'collect',
    steals: 'steal',
    draws: 'draw',
    reveals: 'reveal',
    wins: 'win',
    has: 'have',
    does: 'do',
    converts: 'convert',
    embezzles: 'embezzle',
    examines: 'examine',
    forces: 'force',
    returns: 'return',
  };

  for (const [thirdPerson, secondPerson] of Object.entries(verbMap)) {
    const verbRegex = new RegExp(`${escapeRegExp(myName)} ${thirdPerson}\\b`, 'g');
    result = result.replace(verbRegex, `You ${secondPerson}`);
  }

  // Replace remaining standalone occurrences of the name with "You"
  // Use word boundary to avoid partial matches
  const nameRegex = new RegExp(`\\b${escapeRegExp(myName)}\\b`, 'g');
  result = result.replace(nameRegex, 'You');

  return result;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
