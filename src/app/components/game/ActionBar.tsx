'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionType, ClientGameState, ClientPlayerState, GameMode, TargetingPublication, TurnPhase } from '@/shared/types';
import { ACTION_DEFINITIONS, FORCED_COUP_THRESHOLD, CONVERSION_SELF_COST, CONVERSION_OTHER_COST } from '@/shared/constants';
import { DukeIcon, AssassinIcon, CaptainIcon, AmbassadorIcon, InquisitorIcon, CoinIcon } from '../icons';
import { Timer } from '../ui/Timer';
import { getSocket } from '../../hooks/useSocket';
import { fireHaptic, haptic, hapticHeavy } from '../../utils/haptic';
import { getSoundEngine, type SoundId } from '../../audio/SoundEngine';
import fx from '../../fx';
import { useGameStore } from '../../stores/gameStore';

/**
 * THE `denied` CUE.
 *
 * This was `timerWarning` for one wave, because no refusal voice existed —
 * right weight, wrong shape: it rises out of nothing where a refusal wants to
 * fall. The real voice now exists: two square blips at 320Hz then 220Hz through
 * a lowpass CLOSING 1400→760Hz across the cue, 88ms and over. Discrete steps,
 * not a glide, because both loss cues fall by sliding — a slide is a collapse,
 * a step is a refusal.
 *
 * Measured (see docs/AUDIO-MIX.md): peak −21.56, loud −34.64 dBFS, 0dB of
 * limiting, sitting on the FLOOR of tier 4 — a refusal must never outrank
 * losing an influence, and tier 4's margin above tier 3 is only 1.98dB, so a
 * chrome cue placed any higher eats the boundary.
 */
const DENIED_SOUND: SoundId = 'denied';

/**
 * THE SEAM THE SEATS PICK UP.
 *
 * `PlayerSeat` draws the target state and `GameTable` places the seats, but
 * neither of them knows the target RULES — a faction split, a Steal target
 * with no coins, a Convert you cannot afford. Those live in
 * `buildTargetOptions` below and must live in exactly one place, so the
 * ActionBar publishes the whole selection (which seats are legal, why the
 * others are not, and the handler that picks one) onto the store and the
 * seats read it. `TargetingPublication` is in `src/shared/types.ts` with
 * every other type; the store slice is `gameStore.targeting`.
 *
 * This replaced a `window` CustomEvent, which existed only because an earlier
 * pass could not edit the store.
 */

function CoinsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="24" cy="36" r="18" fill="#fbbf24" stroke="#f59e0b" strokeWidth="2.5" />
      <circle cx="40" cy="28" r="18" fill="#fbbf24" stroke="#f59e0b" strokeWidth="2.5" />
      <circle cx="24" cy="36" r="11" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
      <circle cx="40" cy="28" r="11" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
    </svg>
  );
}

function SwordsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M16 8l4 32-6 4 4 4 4-6 32 4" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M48 8l-4 32 6 4-4 4-4-6-32 4" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TreasuryIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="12" y="28" width="40" height="24" rx="4" fill="#92400e" stroke="#b45309" strokeWidth="2" />
      <path d="M12 32C12 28 16 24 32 24C48 24 52 28 52 32" fill="#a16207" />
      <rect x="28" y="22" width="8" height="6" rx="2" fill="#fbbf24" />
      <circle cx="32" cy="40" r="6" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" />
    </svg>
  );
}

function SwapIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M16 24h24l-8-8M48 40H24l8 8" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type ActionConfig = {
  type: ActionType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number }>;
};

function coinLabel(amount: number): string {
  return `${amount} coin${amount === 1 ? '' : 's'}`;
}

/**
 * The refusal sentences. Every number in them comes from `src/shared/constants`
 * — `COUP_COST`, `ASSASSINATE_COST`, `CONVERSION_*_COST`,
 * `FORCED_COUP_THRESHOLD` — so a rules change cannot leave the UI lying about
 * the price of a Coup. "You need 7 coins to Coup" is a sentence; a greyed
 * button is a shrug.
 */
function needCoins(cost: number, verb: string, have: number): string {
  return `You need ${coinLabel(cost)} to ${verb} — you have ${have}.`;
}

const SAME_FACTION_REASON = 'Same faction — Convert first or wait until factions match.';
const PENDING_REASON = 'Your action is already on its way to the table.';

/** Which actions the Reformation faction rule can forbid. */
const FACTION_RESTRICTED: ReadonlyArray<ActionType> = [
  ActionType.Coup,
  ActionType.Assassinate,
  ActionType.Steal,
  ActionType.Examine,
];

function getActionConfig(isReformation: boolean, useInquisitor: boolean, treasuryReserve: number): ActionConfig[] {
  const config: ActionConfig[] = [
    { type: ActionType.Income, label: 'Income', desc: '+1 coin (safe)', icon: CoinIcon },
    { type: ActionType.ForeignAid, label: 'Foreign Aid', desc: '+2 coins (blockable)', icon: CoinsIcon },
    { type: ActionType.Tax, label: 'Tax', desc: '+3 coins (claim Duke)', icon: DukeIcon },
    { type: ActionType.Steal, label: 'Steal', desc: 'Take 2 (claim Captain)', icon: CaptainIcon },
    { type: ActionType.Assassinate, label: 'Assassinate', desc: 'Pay 3, kill (claim Assassin)', icon: AssassinIcon },
    {
      type: ActionType.Exchange,
      label: 'Exchange',
      desc: useInquisitor ? 'Swap 1 card (claim Inquisitor)' : 'Swap cards (claim Ambassador)',
      icon: useInquisitor ? InquisitorIcon : AmbassadorIcon,
    },
    { type: ActionType.Coup, label: 'Coup', desc: 'Pay 7, guaranteed kill', icon: SwordsIcon },
  ];

  if (isReformation) {
    // Add Examine before Coup if using Inquisitor
    if (useInquisitor) {
      config.splice(-1, 0, {
        type: ActionType.Examine,
        label: 'Examine',
        desc: 'Look at card (claim Inquisitor)',
        icon: InquisitorIcon,
      });
    }
    // Add Convert and Embezzle
    config.splice(-1, 0, {
      type: ActionType.Convert,
      label: 'Convert',
      desc: `Switch faction (${CONVERSION_SELF_COST}/${CONVERSION_OTHER_COST} coins)`,
      icon: SwapIcon,
    });
    config.splice(-1, 0, {
      type: ActionType.Embezzle,
      label: 'Embezzle',
      desc: treasuryReserve > 0 ? `Take ${treasuryReserve} from reserve` : 'Reserve is empty',
      icon: TreasuryIcon,
    });
  }

  return config;
}

/** One row of the target list. `reason` is empty exactly when `eligible`. */
interface TargetOption {
  player: ClientPlayerState;
  eligible: boolean;
  reason: string;
}

/**
 * §6.2 — render EVERY living opponent and mark the illegal ones, rather than
 * quietly dropping them. Before this, a Reformation player looking at a
 * three-seat table saw one button and a line of small print; the two seats
 * that were missing were the interesting information.
 */
function buildTargetOptions(
  action: ActionType,
  opponents: ClientPlayerState[],
  me: ClientPlayerState,
  factionsSplit: boolean,
): TargetOption[] {
  const factionRestricted = FACTION_RESTRICTED.includes(action);

  return opponents.map(player => {
    if (factionRestricted && factionsSplit && player.faction === me.faction) {
      return { player, eligible: false, reason: SAME_FACTION_REASON };
    }
    if (action === ActionType.Steal && player.coins === 0) {
      return { player, eligible: false, reason: `${player.name} has no coins to steal.` };
    }
    if (action === ActionType.Convert && me.coins < CONVERSION_OTHER_COST) {
      return {
        player,
        eligible: false,
        reason: needCoins(CONVERSION_OTHER_COST, `Convert ${player.name}`, me.coins),
      };
    }
    return { player, eligible: true, reason: '' };
  });
}

interface RefusalState {
  /** Identifies the control that refused: an ActionType, or `target:<id>`. */
  id: string;
  message: string;
  /** Bumped per refusal. Drives the shake restart and the alert re-announce. */
  nonce: number;
}

interface RefusalHostProps {
  active: boolean;
  /** Alternates the animation-name so a repeat refusal actually restarts. */
  parity: number;
  className?: string;
  onSettled: () => void;
  children: React.ReactNode;
}

function RefusalHost({ active, parity, className, onSettled, children }: RefusalHostProps) {
  return (
    <div
      className={`refusal-host${active ? ' is-refusing' : ''}${className ? ` ${className}` : ''}`}
      data-shake={parity % 2 === 1 ? 'b' : 'a'}
      onAnimationEnd={event => {
        if (event.animationName.startsWith('refuse-shake')) onSettled();
      }}
    >
      {children}
    </div>
  );
}

interface ActionBarProps {
  gameState: ClientGameState;
}

export function ActionBar({ gameState }: ActionBarProps) {
  const [selectingTarget, setSelectingTarget] = useState<ActionType | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [refusal, setRefusal] = useState<RefusalState | null>(null);
  const [shaking, setShaking] = useState(false);
  const nonceRef = useRef(0);
  const socket = getSocket();
  const setTargeting = useGameStore(s => s.setTargeting);

  // Reset pending state when phase changes (server accepted the action)
  useEffect(() => {
    setActionPending(false);
    setSelectingTarget(null);
    setRefusal(null);
    setShaking(false);
  }, [gameState.turnPhase, gameState.turnNumber]);

  // Reset pending state on server error (e.g., steal from 0-coin target)
  useEffect(() => {
    const onError = () => setActionPending(false);
    socket.on('game:error', onError);
    return () => { socket.off('game:error', onError); };
  }, [socket]);

  /**
   * The one place a refusal is fired, so the three parts can never drift out
   * of order or go missing one at a time:
   *
   *   1. the cue — sound, then `fireHaptic('denied')`, both synchronous inside
   *      the tap so neither hangs off the back of a cosmetic ramp (§7);
   *   2. the shake — a class on the wrapper, restarted via the nonce parity;
   *   3. the sentence — committed in the same render as the shake.
   */
  /**
   * Where the last press landed, so a refusal's FX chips appear on the control
   * that refused rather than at screen centre. Captured at the window in the
   * capture phase: `refuse()` is reached from eight different onClick handlers
   * and threading an event through all of them buys nothing over reading the
   * pointer that is, by definition, already on the refused control.
   */
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => { pointerRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, []);

  const refuse = useCallback((id: string, message: string) => {
    getSoundEngine().play(DENIED_SOUND);
    fireHaptic('denied');

    /**
     * The visual half of the refusal. `useFxCues` only raises `denied` from
     * `gameStore.error`, i.e. a SERVER rejection — a local refusal like "you
     * need 3 coins" never touches the store, so without this line the loudest
     * refusals in the game were the silent ones.
     *
     * `fireHaptic` above and the tuning row's own haptic are the same name at
     * the same priority inside 300ms, so utils/haptic.ts's floor collapses them
     * to one buzz. Keeping both means the refusal still buzzes if the FX row is
     * ever retired.
     */
    const p = pointerRef.current;
    fx.cue('denied', { condition: 'mine', x: p?.x, y: p?.y });

    nonceRef.current += 1;
    setRefusal({ id, message, nonce: nonceRef.current });
    setShaking(true);
  }, []);

  const settleShake = useCallback(() => setShaking(false), []);

  const me = gameState.players.find(p => p.id === gameState.myId);
  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === gameState.myId;
  const isActive = !!me && me.isAlive && isMyTurn && gameState.turnPhase === TurnPhase.AwaitingAction;

  const mustCoup = !!me && me.coins >= FORCED_COUP_THRESHOLD;
  const isReformation = gameState.gameMode === GameMode.Reformation;
  const alive = gameState.players.filter(p => p.isAlive);
  /** True only while the faction restriction is actually biting (§Reformation). */
  const factionsSplit = isReformation && !!me && !alive.every(p => p.faction === me.faction);
  const opponents = gameState.players.filter(p => p.isAlive && p.id !== gameState.myId);

  /** The action currently awaiting a seat: an explicit pick, or the forced Coup. */
  const targetingAction = selectingTarget ?? (isActive && mustCoup ? ActionType.Coup : null);

  const targetOptions = useMemo(
    () => (isActive && me && targetingAction
      ? buildTargetOptions(targetingAction, opponents, me, factionsSplit)
      : []),
    // `opponents` is a fresh array each render; key off the stable inputs instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isActive, targetingAction, factionsSplit, me?.coins, me?.faction, gameState.players],
  );

  /**
   * THE ONE TARGET HANDLER. Every way of choosing a seat — a row in the list
   * below, a forced-Coup row, a Convert row, and a tap on the seat itself out
   * on the table — arrives here, so "click the name" and "click the person"
   * cannot drift into two behaviours with two sets of bugs.
   *
   * The three gates are in the order the player can act on: an action already
   * in flight first (nothing they choose can land), then the rule that makes
   * this particular seat illegal, then the send.
   */
  const chooseTarget = useCallback((playerId: string) => {
    const option = targetOptions.find(o => o.player.id === playerId);
    if (!targetingAction || !option) return;
    if (actionPending) { refuse(`target:${playerId}`, PENDING_REASON); return; }
    if (!option.eligible) { refuse(`target:${playerId}`, option.reason); return; }

    hapticHeavy();
    setActionPending(true);
    if (targetingAction === ActionType.Convert) {
      socket.emit('game:convert', { targetId: playerId });
    } else {
      socket.emit('game:action', { action: targetingAction, targetId: playerId });
    }
    setSelectingTarget(null);
  }, [actionPending, refuse, socket, targetOptions, targetingAction]);

  /** Published for the seats. See the header of this file. */
  const publication = useMemo<TargetingPublication>(() => {
    const reasons: Record<string, string> = {};
    for (const option of targetOptions) {
      if (!option.eligible) reasons[option.player.id] = option.reason;
    }
    return {
      action: targetingAction,
      eligibleIds: targetOptions.filter(o => o.eligible).map(o => o.player.id),
      ineligibleIds: targetOptions.filter(o => !o.eligible).map(o => o.player.id),
      reasons,
      onSelect: chooseTarget,
    };
  }, [chooseTarget, targetOptions, targetingAction]);

  useEffect(() => {
    setTargeting(publication);
  }, [publication, setTargeting]);

  // Unmount only (spectating, game over, a rematch): leave no seat lit.
  useEffect(() => () => setTargeting(null), [setTargeting]);

  if (!isActive || !me) {
    return null;
  }

  const useInquisitor = gameState.useInquisitor;
  const actionConfig = getActionConfig(isReformation, useInquisitor, gameState.treasuryReserve);

  const handleAction = (action: ActionType) => {
    haptic(80);
    // Convert can target self or other — handle specially
    if (action === ActionType.Convert) {
      setSelectingTarget(action);
      return;
    }
    const def = ACTION_DEFINITIONS[action];
    if (def.requiresTarget) {
      setSelectingTarget(action);
    } else {
      setActionPending(true);
      socket.emit('game:action', { action });
    }
  };

  /** The shared `role="alert"` line. Keyed so a repeat refusal re-announces. */
  const refusalAlert = refusal ? (
    <p key={refusal.nonce} role="alert" className="refusal-alert">
      {refusal.message}
    </p>
  ) : null;

  if (selectingTarget) {
    const actionName = selectingTarget === ActionType.Coup ? 'Coup' :
                       selectingTarget === ActionType.Assassinate ? 'Assassinate' :
                       selectingTarget === ActionType.Steal ? 'Steal from' :
                       selectingTarget === ActionType.Examine ? 'Examine' :
                       selectingTarget === ActionType.Convert ? 'Convert' : selectingTarget;

    // Convert has special options: self-convert or target-convert
    if (selectingTarget === ActionType.Convert) {
      const canConvertSelf = me.coins >= CONVERSION_SELF_COST;
      const selfReason = needCoins(CONVERSION_SELF_COST, 'Convert yourself', me.coins);
      return (
        <div className="prompt-action">
          <Timer expiresAt={gameState.timerExpiry} />
          <p className="text-center text-white font-bold mb-3">Convert who?</p>
          <div className="flex flex-col gap-2">
            <RefusalHost
              active={shaking && refusal?.id === 'convert:self'}
              parity={refusal?.nonce ?? 0}
              onSettled={settleShake}
            >
              <button
                className="btn-secondary w-full"
                data-ineligible={canConvertSelf && !actionPending ? undefined : 'true'}
                aria-disabled={canConvertSelf && !actionPending ? undefined : true}
                onClick={() => {
                  if (actionPending) { refuse('convert:self', PENDING_REASON); return; }
                  if (!canConvertSelf) { refuse('convert:self', selfReason); return; }
                  hapticHeavy();
                  setActionPending(true);
                  socket.emit('game:convert', {});
                  setSelectingTarget(null);
                }}
              >
                <span className="block">Yourself ({CONVERSION_SELF_COST} coin)</span>
                {!canConvertSelf && (
                  <span className="mt-0.5 block text-[10px] font-normal leading-tight text-gray-300">
                    {selfReason}
                  </span>
                )}
              </button>
            </RefusalHost>
            {targetOptions.map(({ player, eligible, reason }) => (
              <RefusalHost
                key={player.id}
                active={shaking && refusal?.id === `target:${player.id}`}
                parity={refusal?.nonce ?? 0}
                onSettled={settleShake}
              >
                <button
                  className="btn-secondary w-full"
                  data-target-illegal={eligible ? undefined : 'true'}
                  aria-disabled={eligible && !actionPending ? undefined : true}
                  onClick={() => chooseTarget(player.id)}
                >
                  <span className="block">{player.name} ({CONVERSION_OTHER_COST} coins)</span>
                  {!eligible && (
                    <span className="mt-0.5 block text-[10px] font-normal leading-tight text-gray-300">
                      {reason}
                    </span>
                  )}
                </button>
              </RefusalHost>
            ))}
            <button
              className="text-gray-500 text-sm mt-1"
              onClick={() => { haptic(80); setRefusal(null); setSelectingTarget(null); }}
            >
              Cancel
            </button>
          </div>
          {refusalAlert}
        </div>
      );
    }

    const noneEligible = targetOptions.length > 0 && targetOptions.every(o => !o.eligible);
    const stealBlocked = selectingTarget === ActionType.Steal && noneEligible
      && targetOptions.every(o => o.reason.endsWith('no coins to steal.'));

    return (
      <div className="prompt-action">
        <Timer expiresAt={gameState.timerExpiry} />
        <p className="text-center text-white font-bold mb-3">
          {actionName} who?
        </p>
        <div className="flex flex-col gap-2">
          {targetOptions.map(({ player, eligible, reason }) => (
            <RefusalHost
              key={player.id}
              active={shaking && refusal?.id === `target:${player.id}`}
              parity={refusal?.nonce ?? 0}
              onSettled={settleShake}
            >
              <button
                className="btn-secondary w-full"
                data-target-illegal={eligible ? undefined : 'true'}
                aria-disabled={eligible && !actionPending ? undefined : true}
                onClick={() => chooseTarget(player.id)}
              >
                <span className="block">{player.name} ({player.coins} coins)</span>
                {!eligible && (
                  <span className="mt-0.5 block text-[10px] font-normal leading-tight text-gray-300">
                    {reason}
                  </span>
                )}
              </button>
            </RefusalHost>
          ))}
          {noneEligible && (
            <p className="text-gray-400 text-sm text-center py-2">
              {stealBlocked ? 'No valid Steal targets — nobody has coins.' : SAME_FACTION_REASON}
            </p>
          )}
          {targetOptions.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-2">No valid targets — nobody else is left.</p>
          )}
          <button
            className="text-gray-500 text-sm mt-1"
            onClick={() => { haptic(80); setRefusal(null); setSelectingTarget(null); }}
          >
            Cancel
          </button>
        </div>
        {refusalAlert}
      </div>
    );
  }

  if (mustCoup) {
    return (
      <div className="prompt-urgent">
        <Timer expiresAt={gameState.timerExpiry} />
        <p className="text-center text-red-300 font-bold mb-1">
          You have {me.coins} coins — you must Coup!
        </p>
        <p className="text-center text-gray-400 text-xs mb-3">
          Choose a player to eliminate
        </p>
        <div className="flex flex-col gap-2">
          {targetOptions.map(({ player, eligible, reason }) => (
            <RefusalHost
              key={player.id}
              active={shaking && refusal?.id === `target:${player.id}`}
              parity={refusal?.nonce ?? 0}
              onSettled={settleShake}
            >
              <button
                className="btn-danger w-full"
                data-target-illegal={eligible ? undefined : 'true'}
                aria-disabled={eligible && !actionPending ? undefined : true}
                onClick={() => chooseTarget(player.id)}
              >
                <span className="block">Coup {player.name}</span>
                {!eligible && (
                  <span className="mt-0.5 block text-[10px] font-normal leading-tight text-gray-200">
                    {reason}
                  </span>
                )}
              </button>
            </RefusalHost>
          ))}
        </div>
        {refusalAlert}
      </div>
    );
  }

  return (
    <div className="prompt-action">
      <Timer expiresAt={gameState.timerExpiry} />
      <div className="grid grid-cols-2 gap-2">
        {actionConfig.map((a, index) => {
          const def = ACTION_DEFINITIONS[a.type];

          /**
           * One gate per action, and it produces a SENTENCE rather than a
           * boolean plus a tooltip. Order matters: the first true condition is
           * the one the player is asked to act on, so the cheapest fix is
           * named first (coins) before the structural one (targets).
           */
          const gate = ((): { ok: boolean; reason: string } => {
            if (actionPending) return { ok: false, reason: PENDING_REASON };

            if (a.type === ActionType.Convert) {
              if (me.coins < CONVERSION_SELF_COST) {
                return { ok: false, reason: needCoins(CONVERSION_SELF_COST, 'Convert yourself', me.coins) };
              }
              return { ok: true, reason: '' };
            }

            if (a.type === ActionType.Embezzle) {
              if (gameState.treasuryReserve === 0) {
                return { ok: false, reason: 'The treasury reserve is empty — there is nothing to embezzle.' };
              }
              return { ok: true, reason: '' };
            }

            if (def.cost > 0 && me.coins < def.cost) {
              return { ok: false, reason: needCoins(def.cost, a.label, me.coins) };
            }

            if (def.requiresTarget) {
              const options = buildTargetOptions(a.type, opponents, me, factionsSplit);
              if (options.length === 0) {
                return { ok: false, reason: `No ${a.label} targets — nobody else is left.` };
              }
              if (options.every(o => !o.eligible)) {
                if (a.type === ActionType.Steal && options.every(o => o.player.coins === 0)) {
                  return { ok: false, reason: 'No valid Steal targets — nobody has coins.' };
                }
                return { ok: false, reason: SAME_FACTION_REASON };
              }
            }

            return { ok: true, reason: '' };
          })();

          const Icon = a.icon;

          return (
            <RefusalHost
              key={a.type}
              active={shaking && refusal?.id === a.type}
              parity={refusal?.nonce ?? 0}
              onSettled={settleShake}
              className="h-full"
            >
              <button
                className={`bg-coup-surface rounded-lg p-2 text-left border border-gray-700 relative
                  h-full w-full
                  ${gate.ok ? 'hover:border-coup-accent cursor-pointer active:scale-[0.97]' : ''}
                  transition-all action-choice-enter`}
                style={{ '--action-delay': `${index * 45}ms` } as React.CSSProperties}
                data-ineligible={gate.ok ? undefined : 'true'}
                aria-disabled={gate.ok ? undefined : true}
                onClick={() => (gate.ok ? handleAction(a.type) : refuse(a.type, gate.reason))}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0"><Icon size={18} /></span>
                  <div className="min-w-0">
                    {/* ART-DIRECTION.md §4: action names are a Display role. */}
                    <div className="type-display text-step-0 leading-tight">{a.label}</div>
                    <div className="text-[10px] text-gray-400 leading-tight mt-0.5">
                      {gate.ok ? a.desc : gate.reason}
                    </div>
                  </div>
                </div>
              </button>
            </RefusalHost>
          );
        })}
      </div>
      {refusalAlert}
    </div>
  );
}
