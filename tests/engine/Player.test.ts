import { describe, it, expect, beforeEach } from 'vitest';
import { Player } from '@/engine/Player';
import { Character, Influence } from '@/shared/types';

describe('Player', () => {
  let player: Player;

  beforeEach(() => {
    player = new Player('p1', 'Alice', 0);
  });

  describe('constructor', () => {
    it('sets defaults correctly', () => {
      expect(player.id).toBe('p1');
      expect(player.name).toBe('Alice');
      expect(player.coins).toBe(0);
      expect(player.influences).toEqual([]);
      expect(player.seatIndex).toBe(0);
    });
  });

  describe('isAlive', () => {
    it('returns false with no influences', () => {
      expect(player.isAlive).toBe(false);
    });

    it('returns true with unrevealed influences', () => {
      player.influences = [
        { character: Character.Duke, revealed: false },
        { character: Character.Captain, revealed: false },
      ];
      expect(player.isAlive).toBe(true);
    });

    it('returns true when at least one influence is unrevealed', () => {
      player.influences = [
        { character: Character.Duke, revealed: true },
        { character: Character.Captain, revealed: false },
      ];
      expect(player.isAlive).toBe(true);
    });

    it('returns false when all influences are revealed', () => {
      player.influences = [
        { character: Character.Duke, revealed: true },
        { character: Character.Captain, revealed: true },
      ];
      expect(player.isAlive).toBe(false);
    });
  });

  describe('aliveInfluenceCount', () => {
    it('returns 0 with no influences', () => {
      expect(player.aliveInfluenceCount).toBe(0);
    });

    it('counts only unrevealed influences', () => {
      player.influences = [
        { character: Character.Duke, revealed: false },
        { character: Character.Captain, revealed: true },
      ];
      expect(player.aliveInfluenceCount).toBe(1);
    });

    it('returns 2 when both unrevealed', () => {
      player.influences = [
        { character: Character.Duke, revealed: false },
        { character: Character.Captain, revealed: false },
      ];
      expect(player.aliveInfluenceCount).toBe(2);
    });

    it('returns 0 when all revealed', () => {
      player.influences = [
        { character: Character.Duke, revealed: true },
        { character: Character.Captain, revealed: true },
      ];
      expect(player.aliveInfluenceCount).toBe(0);
    });
  });

  describe('hasCharacter()', () => {
    beforeEach(() => {
      player.influences = [
        { character: Character.Duke, revealed: false },
        { character: Character.Captain, revealed: true },
      ];
    });

    it('returns true for an unrevealed character', () => {
      expect(player.hasCharacter(Character.Duke)).toBe(true);
    });

    it('returns false for a revealed character', () => {
      expect(player.hasCharacter(Character.Captain)).toBe(false);
    });

    it('returns false for a character the player does not have', () => {
      expect(player.hasCharacter(Character.Assassin)).toBe(false);
    });
  });

  describe('revealInfluence()', () => {
    beforeEach(() => {
      player.influences = [
        { character: Character.Duke, revealed: false },
        { character: Character.Captain, revealed: false },
      ];
    });

    it('reveals the correct card and returns the character', () => {
      const char = player.revealInfluence(0);
      expect(char).toBe(Character.Duke);
      expect(player.influences[0].revealed).toBe(true);
      expect(player.influences[1].revealed).toBe(false);
    });

    it('returns null for out-of-bounds index', () => {
      expect(player.revealInfluence(-1)).toBeNull();
      expect(player.revealInfluence(5)).toBeNull();
    });

    it('returns null for already revealed influence', () => {
      player.influences[0].revealed = true;
      expect(player.revealInfluence(0)).toBeNull();
    });
  });

  describe('findInfluenceIndex()', () => {
    it('finds the first unrevealed matching character', () => {
      player.influences = [
        { character: Character.Duke, revealed: true },
        { character: Character.Duke, revealed: false },
      ];
      expect(player.findInfluenceIndex(Character.Duke)).toBe(1);
    });

    it('returns -1 if character not found unrevealed', () => {
      player.influences = [
        { character: Character.Duke, revealed: true },
      ];
      expect(player.findInfluenceIndex(Character.Duke)).toBe(-1);
    });
  });

  describe('replaceInfluence()', () => {
    it('swaps the character of an unrevealed influence', () => {
      player.influences = [
        { character: Character.Duke, revealed: false },
        { character: Character.Captain, revealed: false },
      ];
      const result = player.replaceInfluence(Character.Duke, Character.Assassin);
      expect(result).toBe(true);
      expect(player.influences[0].character).toBe(Character.Assassin);
      expect(player.influences[0].revealed).toBe(false);
    });

    it('returns false if the character is not found unrevealed', () => {
      player.influences = [
        { character: Character.Duke, revealed: true },
      ];
      const result = player.replaceInfluence(Character.Duke, Character.Assassin);
      expect(result).toBe(false);
    });

    it('only replaces the first match', () => {
      player.influences = [
        { character: Character.Duke, revealed: false },
        { character: Character.Duke, revealed: false },
      ];
      player.replaceInfluence(Character.Duke, Character.Contessa);
      expect(player.influences[0].character).toBe(Character.Contessa);
      expect(player.influences[1].character).toBe(Character.Duke);
    });
  });

  describe('addCoins() / removeCoins()', () => {
    it('addCoins increases coin count', () => {
      player.addCoins(5);
      expect(player.coins).toBe(5);
      player.addCoins(3);
      expect(player.coins).toBe(8);
    });

    it('removeCoins decreases coin count and returns true', () => {
      player.coins = 10;
      const result = player.removeCoins(4);
      expect(result).toBe(true);
      expect(player.coins).toBe(6);
    });

    it('removeCoins returns false if not enough coins', () => {
      player.coins = 2;
      const result = player.removeCoins(5);
      expect(result).toBe(false);
      expect(player.coins).toBe(2); // unchanged
    });

    it('removeCoins allows exact removal', () => {
      player.coins = 3;
      const result = player.removeCoins(3);
      expect(result).toBe(true);
      expect(player.coins).toBe(0);
    });
  });

  describe('hiddenCharacters', () => {
    it('returns only unrevealed characters', () => {
      player.influences = [
        { character: Character.Duke, revealed: true },
        { character: Character.Captain, revealed: false },
      ];
      expect(player.hiddenCharacters).toEqual([Character.Captain]);
    });

    it('returns empty array when all revealed', () => {
      player.influences = [
        { character: Character.Duke, revealed: true },
        { character: Character.Captain, revealed: true },
      ];
      expect(player.hiddenCharacters).toEqual([]);
    });

    it('returns all characters when none revealed', () => {
      player.influences = [
        { character: Character.Duke, revealed: false },
        { character: Character.Captain, revealed: false },
      ];
      expect(player.hiddenCharacters).toEqual([Character.Duke, Character.Captain]);
    });
  });

  describe('toState()', () => {
    it('serializes player state correctly', () => {
      player.coins = 5;
      player.influences = [
        { character: Character.Duke, revealed: false },
        { character: Character.Captain, revealed: true },
      ];
      const state = player.toState();
      expect(state.id).toBe('p1');
      expect(state.name).toBe('Alice');
      expect(state.coins).toBe(5);
      expect(state.isAlive).toBe(true);
      expect(state.seatIndex).toBe(0);
      expect(state.influences).toHaveLength(2);
      expect(state.influences[0]).toEqual({ character: Character.Duke, revealed: false });
      expect(state.influences[1]).toEqual({ character: Character.Captain, revealed: true });
    });

    it('returns a copy of influences', () => {
      player.influences = [{ character: Character.Duke, revealed: false }];
      const state = player.toState();
      state.influences[0].revealed = true;
      expect(player.influences[0].revealed).toBe(false); // original unchanged
    });
  });
});
