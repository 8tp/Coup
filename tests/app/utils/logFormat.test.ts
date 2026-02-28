import { describe, it, expect } from 'vitest';
import { formatLogMessage } from '@/app/utils/logFormat';

describe('formatLogMessage', () => {
  it('replaces player name with "You" when at start of message', () => {
    expect(formatLogMessage("Alice's turn.", 'Alice')).toBe("your turn.");
  });

  it('adjusts third-person verbs to second-person', () => {
    expect(formatLogMessage('Alice takes Income (+1 coin).', 'Alice'))
      .toBe('You take Income (+1 coin).');
  });

  it('adjusts "claims" verb', () => {
    expect(formatLogMessage('Alice claims Duke to Tax.', 'Alice'))
      .toBe('You claim Duke to Tax.');
  });

  it('adjusts "launches" verb', () => {
    expect(formatLogMessage('Alice launches a Coup against Bob.', 'Alice'))
      .toBe('You launch a Coup against Bob.');
  });

  it('adjusts "challenges" verb', () => {
    expect(formatLogMessage("Alice challenges Bob's claim of Duke!", 'Alice'))
      .toBe("You challenge Bob's claim of Duke!");
  });

  it('adjusts "blocks" verb', () => {
    expect(formatLogMessage('Alice blocks with Contessa!', 'Alice'))
      .toBe('You block with Contessa!');
  });

  it('adjusts "loses" verb', () => {
    expect(formatLogMessage('Alice loses Duke.', 'Alice'))
      .toBe('You lose Duke.');
  });

  it('adjusts "collects" verb', () => {
    expect(formatLogMessage('Alice collects Tax (+3 coins).', 'Alice'))
      .toBe('You collect Tax (+3 coins).');
  });

  it('adjusts "steals" verb', () => {
    expect(formatLogMessage('Alice steals 2 coin(s) from Bob.', 'Alice'))
      .toBe('You steal 2 coin(s) from Bob.');
  });

  it('adjusts "reveals" verb', () => {
    expect(formatLogMessage('Alice reveals Duke — challenge fails! Bob must lose an influence.', 'Alice'))
      .toBe('You reveal Duke — challenge fails! Bob must lose an influence.');
  });

  it('adjusts "wins" verb', () => {
    expect(formatLogMessage('Alice wins the game!', 'Alice'))
      .toBe('You win the game!');
  });

  it('replaces name in non-subject position', () => {
    expect(formatLogMessage('Bob launches a Coup against Alice.', 'Alice'))
      .toBe('Bob launches a Coup against You.');
  });

  it('replaces possessive form with "your"', () => {
    expect(formatLogMessage("Bob challenges Alice's claim of Duke!", 'Alice'))
      .toBe("Bob challenges your claim of Duke!");
  });

  it('does not modify messages without the player name', () => {
    expect(formatLogMessage('Bob takes Income (+1 coin).', 'Alice'))
      .toBe('Bob takes Income (+1 coin).');
  });

  it('returns message unchanged when myName is empty', () => {
    expect(formatLogMessage('Alice takes Income (+1 coin).', ''))
      .toBe('Alice takes Income (+1 coin).');
  });

  it('handles "has" → "have"', () => {
    expect(formatLogMessage('Alice has been eliminated!', 'Alice'))
      .toBe('You have been eliminated!');
  });

  it('handles "does" → "do"', () => {
    expect(formatLogMessage('Alice does NOT have Duke — challenge succeeds!', 'Alice'))
      .toBe('You do NOT have Duke — challenge succeeds!');
  });

  it('handles "completes" verb', () => {
    expect(formatLogMessage('Alice completes the exchange.', 'Alice'))
      .toBe('You complete the exchange.');
  });

  it('handles multiple occurrences of the name', () => {
    // Edge case: name appears in both subject and object
    const result = formatLogMessage("Alice steals 2 coin(s) from Alice's friend.", 'Alice');
    expect(result).toBe("You steal 2 coin(s) from your friend.");
  });
});
