import { randomInt } from 'crypto';
import {
  GameState,
  GameMode,
  GameStatus,
  TurnPhase,
  Character,
  Faction,
  LogEntry,
  LogEventType,
} from '../shared/types';
import { STARTING_COINS, TOTAL_COINS, STARTING_HAND_SIZE } from '../shared/constants';
import { logMsg, type LogMessage } from '../shared/i18n/logMessages';
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
  // Reformation expansion
  gameMode: GameMode = GameMode.Classic;
  useInquisitor: boolean = false;
  treasuryReserve: number = 0;

  constructor(public readonly roomCode: string) {}

  initialize(playerInfos: Array<{ id: string; name: string }>, options?: { gameMode?: GameMode; useInquisitor?: boolean }): void {
    this.gameMode = options?.gameMode ?? GameMode.Classic;
    this.useInquisitor = options?.useInquisitor ?? false;
    const useInquisitor = this.useInquisitor;

    // Configure deck based on mode
    if (useInquisitor) {
      this.deck.setExcludedCharacters([Character.Ambassador]);
    } else {
      this.deck.setExcludedCharacters([Character.Inquisitor]);
    }

    this.deck.reset();
    this.deck.shuffle();
    this.treasuryReserve = 0;

    // Randomize which faction is assigned to the first player slot
    const startWithLoyalist = randomInt(2) === 0;

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

      // Assign factions in Reformation mode (alternating, random starting faction)
      if (this.gameMode === GameMode.Reformation) {
        const isEven = index % 2 === 0;
        player.faction = (isEven === startWithLoyalist) ? Faction.Loyalist : Faction.Reformist;
      }

      return player;
    });

    // Randomize starting player
    this.currentPlayerIndex = randomInt(this.players.length);
    this.turnPhase = TurnPhase.AwaitingAction;
    this.status = GameStatus.InProgress;
    this.turnNumber = 1;
    this.winnerId = null;
    this.actionLog = [];

    this.log({
      message: `Game started. ${this.currentPlayer.name} goes first.`,
      msg: logMsg('gameStarted', { actor: this.currentPlayer.id }),
      eventType: 'game_start',
    });
  }

  /** Check if all remaining alive players share the same faction (restrictions lift) */
  allSameFaction(): boolean {
    if (this.gameMode !== GameMode.Reformation) return false;
    const alive = this.getAlivePlayers();
    if (alive.length <= 1) return true;
    const firstFaction = alive[0].faction;
    return alive.every(p => p.faction === firstFaction);
  }

  /** Check if faction targeting restrictions apply between two players */
  isFactionRestricted(actorId: string, targetId: string): boolean {
    if (this.gameMode !== GameMode.Reformation) return false;
    if (this.allSameFaction()) return false;
    const actor = this.getPlayer(actorId);
    const target = this.getPlayer(targetId);
    if (!actor || !target) return false;
    return actor.faction === target.faction;
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
        this.log({
          message: `${winner?.name} wins the game.`,
          msg: logMsg('win', { actor: this.winnerId }),
          eventType: 'win',
          actorId: this.winnerId,
          actorName: winner?.name ?? null,
        });
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

    this.log({
      message: `${this.currentPlayer.name}'s turn.`,
      msg: logMsg('turnStart', { actor: this.currentPlayer.id }),
      eventType: 'turn_start',
      actorId: this.currentPlayer.id,
      actorName: this.currentPlayer.name,
    });
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
    this.log({
      message: `${player.name} is out.`,
      msg: logMsg('eliminated', { actor: player.id }),
      eventType: 'elimination',
      actorId: player.id,
      actorName: player.name,
    });
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

  /**
   * Append a log line. `message` is the English text every server-side reader
   * uses; `msg` is the same line as a catalog key and params, which clients
   * render in their own language (docs/I18N.md). Both are required.
   */
  log(line: {
    message: string;
    msg: LogMessage;
    eventType: LogEventType;
    character?: Character | null;
    actorId?: string | null;
    actorName?: string | null;
    targetId?: string | null;
    wasBluff?: boolean;
  }): void {
    const entry: LogEntry = {
      message: line.message,
      timestamp: Date.now(),
      eventType: line.eventType,
      character: line.character ?? null,
      turnNumber: this.turnNumber,
      actorId: line.actorId ?? null,
      actorName: line.actorName ?? null,
      targetId: line.targetId ?? null,
    };
    if (line.wasBluff !== undefined) {
      entry.wasBluff = line.wasBluff;
    }
    entry.msg = line.msg;
    this.actionLog.push(entry);
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
      examineSelectionState: null,
      examineState: null,
      blockPassedPlayerIds: [],
      actionLog: [...this.actionLog],
      timerExpiry: null,
      winnerId: this.winnerId,
      turnNumber: this.turnNumber,
      gameMode: this.gameMode,
      useInquisitor: this.useInquisitor,
      treasuryReserve: this.treasuryReserve,
    };
  }
}
