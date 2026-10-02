import { describe, it, expect } from 'vitest';
import { formatLogMessage } from '@/app/utils/logFormat';

describe('formatLogMessage', () => {
  it('replaces player name with "You" when at start of message', () => {
    expect(formatLogMessage("Alice's turn.", 'Alice')).toBe("Your turn.");
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
    expect(formatLogMessage("Alice challenges Bob's Duke claim.", 'Alice'))
      .toBe("You challenge Bob's Duke claim.");
  });

  it('adjusts "blocks" verb', () => {
    expect(formatLogMessage('Alice blocks with Contessa.', 'Alice'))
      .toBe('You block with Contessa.');
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
    expect(formatLogMessage('Alice steals 2 coins from Bob.', 'Alice'))
      .toBe('You steal 2 coins from Bob.');
  });

  it('adjusts "reveals" verb', () => {
    expect(formatLogMessage('Alice reveals Duke.', 'Alice'))
      .toBe('You reveal Duke.');
  });

  it('handles a challenge result with the challenger named second', () => {
    expect(formatLogMessage('Bob has Duke. Alice must lose a card.', 'Alice'))
      .toBe('Bob has Duke. You must lose a card.');
  });

  it('adjusts "shows" and "asks" verbs', () => {
    expect(formatLogMessage('Alice shows Bob a card.', 'Alice')).toBe('You show Bob a card.');
    expect(formatLogMessage('Alice asks Bob for a card to examine.', 'Alice')).toBe('You ask Bob for a card to examine.');
  });

  it('handles "was" → "were"', () => {
    expect(formatLogMessage('Alice was idle, so a bot took their seat.', 'Alice'))
      .toBe('You were idle, so a bot took their seat.');
  });

  it('adjusts "wins" verb', () => {
    expect(formatLogMessage('Alice wins the game.', 'Alice'))
      .toBe('You win the game.');
  });

  it('replaces name in non-subject position', () => {
    expect(formatLogMessage('Bob launches a Coup against Alice.', 'Alice'))
      .toBe('Bob launches a Coup against you.');
  });

  it('replaces possessive form with "your"', () => {
    expect(formatLogMessage("Bob challenges Alice's Duke claim.", 'Alice'))
      .toBe("Bob challenges your Duke claim.");
  });

  it('does not modify messages without the player name', () => {
    expect(formatLogMessage('Bob takes Income (+1 coin).', 'Alice'))
      .toBe('Bob takes Income (+1 coin).');
  });

  it('returns message unchanged when myName is empty', () => {
    expect(formatLogMessage('Alice takes Income (+1 coin).', ''))
      .toBe('Alice takes Income (+1 coin).');
  });

  it('handles "is" → "are"', () => {
    expect(formatLogMessage('Alice is out.', 'Alice'))
      .toBe('You are out.');
  });

  it('capitalises "your" only at the start of a sentence', () => {
    expect(formatLogMessage("Game started. Alice's turn.", 'Alice'))
      .toBe('Game started. Your turn.');
    expect(formatLogMessage('Game started. Alice goes first.', 'Alice'))
      .toBe('Game started. You go first.');
  });

  it('handles "has no" → "have no"', () => {
    expect(formatLogMessage('Alice has no Duke and must lose a card.', 'Alice'))
      .toBe('You have no Duke and must lose a card.');
  });

  it('handles "completes" verb', () => {
    expect(formatLogMessage('Alice completes the exchange.', 'Alice'))
      .toBe('You complete the exchange.');
  });

  it('handles multiple occurrences of the name', () => {
    // Edge case: name appears in both subject and object
    const result = formatLogMessage("Alice steals 2 coins from Alice's friend.", 'Alice');
    expect(result).toBe("You steal 2 coins from your friend.");
  });
});
