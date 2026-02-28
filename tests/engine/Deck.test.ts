import { describe, it, expect, beforeEach } from 'vitest';
import { Deck } from '@/engine/Deck';
import { Character } from '@/shared/types';
import { CARDS_PER_CHARACTER } from '@/shared/constants';

describe('Deck', () => {
  let deck: Deck;

  beforeEach(() => {
    deck = new Deck();
  });

  describe('reset()', () => {
    it('creates 15 cards (3 of each character)', () => {
      expect(deck.size).toBe(15);
    });

    it('contains exactly CARDS_PER_CHARACTER of each character', () => {
      const cards = deck.getCards();
      const characters = Object.values(Character);
      for (const char of characters) {
        const count = cards.filter(c => c === char).length;
        expect(count).toBe(CARDS_PER_CHARACTER);
      }
    });

    it('resets back to 15 cards after draws', () => {
      deck.draw();
      deck.draw();
      expect(deck.size).toBe(13);
      deck.reset();
      expect(deck.size).toBe(15);
    });
  });

  describe('shuffle()', () => {
    it('randomizes card order', () => {
      const before = deck.getCards().join(',');
      // Shuffle many times and check at least one differs.
      // With 15 cards, the chance of no change is astronomically low.
      let foundDifferent = false;
      for (let i = 0; i < 20; i++) {
        deck.reset();
        deck.shuffle();
        if (deck.getCards().join(',') !== before) {
          foundDifferent = true;
          break;
        }
      }
      expect(foundDifferent).toBe(true);
    });

    it('preserves the same number of cards', () => {
      deck.shuffle();
      expect(deck.size).toBe(15);
    });

    it('preserves the same set of characters', () => {
      const beforeCounts = new Map<Character, number>();
      for (const card of deck.getCards()) {
        beforeCounts.set(card, (beforeCounts.get(card) ?? 0) + 1);
      }
      deck.shuffle();
      const afterCounts = new Map<Character, number>();
      for (const card of deck.getCards()) {
        afterCounts.set(card, (afterCounts.get(card) ?? 0) + 1);
      }
      expect(afterCounts).toEqual(beforeCounts);
    });
  });

  describe('draw()', () => {
    it('returns a card and reduces size', () => {
      const card = deck.draw();
      expect(card).toBeDefined();
      expect(Object.values(Character)).toContain(card);
      expect(deck.size).toBe(14);
    });

    it('returns undefined when deck is empty', () => {
      for (let i = 0; i < 15; i++) {
        deck.draw();
      }
      expect(deck.size).toBe(0);
      expect(deck.draw()).toBeUndefined();
    });
  });

  describe('drawMultiple()', () => {
    it('returns correct count of cards', () => {
      const cards = deck.drawMultiple(3);
      expect(cards).toHaveLength(3);
      expect(deck.size).toBe(12);
    });

    it('returns fewer cards if deck runs out', () => {
      const cards = deck.drawMultiple(20);
      expect(cards).toHaveLength(15);
      expect(deck.size).toBe(0);
    });

    it('returns empty array when drawing 0', () => {
      const cards = deck.drawMultiple(0);
      expect(cards).toHaveLength(0);
      expect(deck.size).toBe(15);
    });
  });

  describe('returnCard()', () => {
    it('increases size by 1', () => {
      deck.draw();
      expect(deck.size).toBe(14);
      deck.returnCard(Character.Duke);
      expect(deck.size).toBe(15);
    });

    it('adds the card to the deck', () => {
      // Draw all cards first
      for (let i = 0; i < 15; i++) {
        deck.draw();
      }
      expect(deck.size).toBe(0);
      deck.returnCard(Character.Assassin);
      expect(deck.size).toBe(1);
      const drawn = deck.draw();
      expect(drawn).toBe(Character.Assassin);
    });
  });

  describe('returnCards()', () => {
    it('increases size by the number of returned cards', () => {
      for (let i = 0; i < 5; i++) {
        deck.draw();
      }
      expect(deck.size).toBe(10);
      deck.returnCards([Character.Duke, Character.Captain, Character.Contessa]);
      expect(deck.size).toBe(13);
    });
  });

  describe('returnAndShuffle()', () => {
    it('returns card and shuffles', () => {
      deck.draw();
      expect(deck.size).toBe(14);
      deck.returnAndShuffle(Character.Ambassador);
      expect(deck.size).toBe(15);
      // Verify the returned card is in the deck
      expect(deck.getCards()).toContain(Character.Ambassador);
    });
  });

  describe('getCards() and setCards()', () => {
    it('getCards returns a copy', () => {
      const cards = deck.getCards();
      cards.pop();
      expect(deck.size).toBe(15); // original unchanged
    });

    it('setCards replaces deck contents', () => {
      deck.setCards([Character.Duke, Character.Duke]);
      expect(deck.size).toBe(2);
      expect(deck.getCards()).toEqual([Character.Duke, Character.Duke]);
    });

    it('setCards creates a copy', () => {
      const cards = [Character.Contessa];
      deck.setCards(cards);
      cards.push(Character.Duke);
      expect(deck.size).toBe(1); // not affected by external mutation
    });
  });
});
