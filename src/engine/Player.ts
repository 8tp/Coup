import { Character, Influence, PlayerState } from '../shared/types';

export class Player {
  readonly id: string;
  readonly name: string;
  coins: number;
  influences: Influence[];
  seatIndex: number;

  constructor(id: string, name: string, seatIndex: number) {
    this.id = id;
    this.name = name;
    this.coins = 0;
    this.influences = [];
    this.seatIndex = seatIndex;
  }

  get isAlive(): boolean {
    return this.influences.some(inf => !inf.revealed);
  }

  get aliveInfluenceCount(): number {
    return this.influences.filter(inf => !inf.revealed).length;
  }

  /** Get unrevealed characters */
  get hiddenCharacters(): Character[] {
    return this.influences.filter(inf => !inf.revealed).map(inf => inf.character);
  }

  /** Check if player has a specific character (unrevealed) */
  hasCharacter(character: Character): boolean {
    return this.influences.some(inf => inf.character === character && !inf.revealed);
  }

  /** Reveal a specific influence by index */
  revealInfluence(index: number): Character | null {
    if (index < 0 || index >= this.influences.length) return null;
    if (this.influences[index].revealed) return null;
    this.influences[index].revealed = true;
    return this.influences[index].character;
  }

  /** Find the first unrevealed influence index with a specific character */
  findInfluenceIndex(character: Character): number {
    return this.influences.findIndex(inf => inf.character === character && !inf.revealed);
  }

  /** Replace an unrevealed influence (used after successful challenge defense) */
  replaceInfluence(character: Character, newCharacter: Character): boolean {
    const index = this.findInfluenceIndex(character);
    if (index === -1) return false;
    this.influences[index].character = newCharacter;
    return true;
  }

  addCoins(amount: number): void {
    this.coins += amount;
  }

  removeCoins(amount: number): boolean {
    if (this.coins < amount) return false;
    this.coins -= amount;
    return true;
  }

  /** Serialize to PlayerState */
  toState(): PlayerState {
    return {
      id: this.id,
      name: this.name,
      coins: this.coins,
      influences: this.influences.map(inf => ({ ...inf })),
      isAlive: this.isAlive,
      seatIndex: this.seatIndex,
    };
  }
}
