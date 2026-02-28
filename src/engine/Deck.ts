import { Character } from '../shared/types';
import { CARDS_PER_CHARACTER } from '../shared/constants';

export class Deck {
  private cards: Character[] = [];

  constructor() {
    this.reset();
  }

  reset(): void {
    this.cards = [];
    const characters = Object.values(Character);
    for (const char of characters) {
      for (let i = 0; i < CARDS_PER_CHARACTER; i++) {
        this.cards.push(char);
      }
    }
  }

  shuffle(): void {
    // Fisher-Yates shuffle
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw(): Character | undefined {
    return this.cards.pop();
  }

  drawMultiple(count: number): Character[] {
    const drawn: Character[] = [];
    for (let i = 0; i < count; i++) {
      const card = this.draw();
      if (card !== undefined) {
        drawn.push(card);
      }
    }
    return drawn;
  }

  returnCard(card: Character): void {
    this.cards.push(card);
  }

  returnCards(cards: Character[]): void {
    for (const card of cards) {
      this.cards.push(card);
    }
  }

  /** Return card and shuffle (used after successful challenge defense) */
  returnAndShuffle(card: Character): void {
    this.returnCard(card);
    this.shuffle();
  }

  get size(): number {
    return this.cards.length;
  }

  /** Get raw cards array (for serialization) */
  getCards(): Character[] {
    return [...this.cards];
  }

  /** Load cards (for deserialization) */
  setCards(cards: Character[]): void {
    this.cards = [...cards];
  }
}
