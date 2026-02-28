import {
  GameState,
  GameStatus,
  TurnPhase,
  Character,
  LogEntry,
  LogEventType,
} from '../shared/types';
import { STARTING_COINS, TOTAL_COINS, STARTING_HAND_SIZE } from '../shared/constants';
import { Deck } from './Deck';
import { Player } from './Player';

export class Game {
  players: Player[] = [];
  deck: Deck = new Deck();
  currentPlayerIndex: number = 0;
  turnPhase: TurnPhase = TurnPhase.AwaitingAction;
  treasury: number = TOTAL_COINS;
  actionLog: LogEntry[] = [];
  turnNumber: number = 1;
  status: GameStatus = GameStatus.Lobby;
  winnerId: string | null = null;

  constructor(public readonly roomCode: string) {}

  initialize(playerInfos: Array<{ id: string; name: string }>): void {
    this.deck.reset();
    this.deck.shuffle();

    this.players = playerInfos.map((p, index) => {
      const player = new Player(p.id, p.name, index);
      // Deal cards
      for (let i = 0; i < STARTING_HAND_SIZE; i++) {
        const card = this.deck.draw();
        if (card) {
          player.influences.push({ character: card, revealed: false });
        }
      }
      // Give starting coins
      player.coins = STARTING_COINS;
      this.treasury -= STARTING_COINS;
      return player;
    });

    // Randomize starting player
    this.currentPlayerIndex = Math.floor(Math.random() * this.players.length);
    this.turnPhase = TurnPhase.AwaitingAction;
    this.status = GameStatus.InProgress;
    this.turnNumber = 1;
    this.winnerId = null;
    this.actionLog = [];

    this.log(`Game started! ${this.currentPlayer.name}'s turn.`, 'game_start', null, null, null);
  }

  get currentPlayer(): Player {
    return this.players[this.currentPlayerIndex];
  }

  getPlayer(id: string): Player | undefined {
    return this.players.find(p => p.id === id);
  }

  getAlivePlayers(): Player[] {
    return this.players.filter(p => p.isAlive);
  }

  /** Advance to the next alive player's turn */
  advanceTurn(): void {
    const alivePlayers = this.getAlivePlayers();
    if (alivePlayers.length <= 1) {
      this.status = GameStatus.Finished;
      this.turnPhase = TurnPhase.GameOver;
      this.winnerId = alivePlayers[0]?.id ?? null;
      if (this.winnerId) {
        const winner = this.getPlayer(this.winnerId);
        this.log(`${winner?.name} wins the game!`, 'win', null, this.winnerId, winner?.name ?? null);
      }
      return;
    }

    // Move to next alive player
    let nextIndex = (this.currentPlayerIndex + 1) % this.players.length;
    while (!this.players[nextIndex].isAlive) {
      nextIndex = (nextIndex + 1) % this.players.length;
    }
    this.currentPlayerIndex = nextIndex;
    this.turnPhase = TurnPhase.AwaitingAction;
    this.turnNumber++;

    this.log(`${this.currentPlayer.name}'s turn.`, 'turn_start', null, this.currentPlayer.id, this.currentPlayer.name);
  }

  /** Check if only one player remains */
  checkWinCondition(): boolean {
    const alive = this.getAlivePlayers();
    if (alive.length <= 1) {
      this.status = GameStatus.Finished;
      this.turnPhase = TurnPhase.GameOver;
      this.winnerId = alive[0]?.id ?? null;
      return true;
    }
    return false;
  }

  /** Eliminate a player (return coins to treasury) */
  eliminatePlayer(player: Player): void {
    this.treasury += player.coins;
    player.coins = 0;
    this.log(`${player.name} has been eliminated!`, 'elimination', null, player.id, player.name);
  }

  giveCoins(player: Player, amount: number): void {
    const actual = Math.min(amount, this.treasury);
    player.addCoins(actual);
    this.treasury -= actual;
  }

  takeCoins(player: Player, amount: number): void {
    const actual = Math.min(amount, player.coins);
    player.removeCoins(actual);
    this.treasury += actual;
  }

  log(
    message: string,
    eventType: LogEventType = 'game_start',
    character: Character | null = null,
    actorId: string | null = null,
    actorName: string | null = null,
  ): void {
    this.actionLog.push({
      message,
      timestamp: Date.now(),
      eventType,
      character,
      turnNumber: this.turnNumber,
      actorId,
      actorName,
    });
  }

  /** Serialize the full game state */
  toState(): GameState {
    return {
      roomCode: this.roomCode,
      status: this.status,
      players: this.players.map(p => p.toState()),
      currentPlayerIndex: this.currentPlayerIndex,
      turnPhase: this.turnPhase,
      deck: this.deck.getCards(),
      treasury: this.treasury,
      pendingAction: null,
      pendingBlock: null,
      challengeState: null,
      influenceLossRequest: null,
      exchangeState: null,
      blockPassedPlayerIds: [],
      actionLog: [...this.actionLog],
      timerExpiry: null,
      winnerId: this.winnerId,
      turnNumber: this.turnNumber,
    };
  }
}
