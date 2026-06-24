import { decompressFromEncodedURIComponent } from 'lz-string';
import { GameStateTransferData, Player, PreviousPlayer, Settings } from '../types';

const TRANSFER_PREFIX = 'sk2:';

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

const isNumberArray = (value: unknown): value is number[] => {
  return Array.isArray(value) && value.every(isFiniteNumber);
};

const isPlayer = (value: unknown): value is Player => {
  return (
    isObject(value) &&
    typeof value.name === 'string' &&
    isFiniteNumber(value.score) &&
    typeof value.yellowCard === 'boolean' &&
    typeof value.sittingOut === 'boolean'
  );
};

const isPreviousPlayer = (value: unknown): value is PreviousPlayer => {
  return (
    isObject(value) &&
    typeof value.name === 'string' &&
    isFiniteNumber(value.finalScore) &&
    typeof value.removedAt === 'string' &&
    (value.scoreHistory === undefined || isNumberArray(value.scoreHistory)) &&
    (value.initialScore === undefined || isFiniteNumber(value.initialScore))
  );
};

const isSettings = (value: unknown): value is Settings => {
  return (
    isObject(value) &&
    isFiniteNumber(value.minimumUnit) &&
    typeof value.enableYellowCards === 'boolean' &&
    isFiniteNumber(value.redCardPenalty) &&
    typeof value.zeroSumMode === 'boolean'
  );
};

const isGameStateTransferData = (value: unknown): value is GameStateTransferData => {
  return (
    isObject(value) &&
    value.version === 1 &&
    typeof value.exportedAt === 'string' &&
    Array.isArray(value.players) &&
    value.players.every(isPlayer) &&
    Array.isArray(value.scores) &&
    value.scores.every(isNumberArray) &&
    Array.isArray(value.previousPlayers) &&
    value.previousPlayers.every(isPreviousPlayer) &&
    isSettings(value.settings)
  );
};

const bitToBoolean = (value: unknown): boolean => value === 1;

const expandCompactGameState = (payload: unknown): GameStateTransferData => {
  if (
    !Array.isArray(payload) ||
    payload.length !== 6 ||
    payload[0] !== 2 ||
    typeof payload[1] !== 'string' ||
    !Array.isArray(payload[2]) ||
    !Array.isArray(payload[3]) ||
    !Array.isArray(payload[4]) ||
    !Array.isArray(payload[5])
  ) {
    throw new Error('The game state payload has an invalid format.');
  }

  const [version, exportedAt, players, scores, previousPlayers, settings] = payload;

  const expandedPayload: GameStateTransferData = {
    version: 1,
    exportedAt,
    players: players.map((player: unknown): Player => {
      if (
        !Array.isArray(player) ||
        player.length !== 4 ||
        typeof player[0] !== 'string' ||
        !isFiniteNumber(player[1])
      ) {
        throw new Error('The game state payload has an invalid player format.');
      }

      return {
        name: player[0],
        score: player[1],
        yellowCard: bitToBoolean(player[2]),
        sittingOut: bitToBoolean(player[3]),
      };
    }),
    scores,
    previousPlayers: previousPlayers.map((player: unknown): PreviousPlayer => {
      if (
        !Array.isArray(player) ||
        player.length < 3 ||
        typeof player[0] !== 'string' ||
        !isFiniteNumber(player[1]) ||
        typeof player[2] !== 'string' ||
        (player[3] !== undefined && !isNumberArray(player[3])) ||
        (player[4] !== undefined && !isFiniteNumber(player[4]))
      ) {
        throw new Error('The game state payload has an invalid previous player format.');
      }

      return {
        name: player[0],
        finalScore: player[1],
        removedAt: player[2],
        scoreHistory: player[3],
        initialScore: player[4],
      };
    }),
    settings: {
      minimumUnit: Number(settings[0]),
      enableYellowCards: bitToBoolean(settings[1]),
      redCardPenalty: Number(settings[2]),
      zeroSumMode: bitToBoolean(settings[3]),
    },
  };

  if (version !== 2 || !isGameStateTransferData(expandedPayload)) {
    throw new Error('The game state payload has an invalid format.');
  }

  return expandedPayload;
};

export const parseGameStatePayload = (payload: string): GameStateTransferData => {
  if (!payload.startsWith(TRANSFER_PREFIX)) {
    throw new Error('This is not a Schafkopf Scorekeeper game state.');
  }

  const jsonPayload = decompressFromEncodedURIComponent(payload.slice(TRANSFER_PREFIX.length));

  if (!jsonPayload) {
    throw new Error('The game state payload could not be read.');
  }

  return expandCompactGameState(JSON.parse(jsonPayload));
};
