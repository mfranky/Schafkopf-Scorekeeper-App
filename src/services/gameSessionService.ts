import { signInAnonymously } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseServices } from '../lib/firebase';
import { GameSessionState, OnlineGameSession, Player, PreviousPlayer, Settings } from '../types';

interface StoredGameSession {
  joinCode: string;
  state: GameSessionState;
}

const sessionsCollection = 'gameSessions';
const joinCodesCollection = 'gameSessionJoinCodes';

const normalizeJoinCode = (joinCode: string) => joinCode.trim().replace(/\s+/g, '').toUpperCase();

const createJoinCode = () => {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
};

const getCurrentUid = async () => {
  const { auth } = getFirebaseServices();

  if (!auth.currentUser) {
    const credential = await signInAnonymously(auth);
    return credential.user.uid;
  }

  return auth.currentUser.uid;
};

const sanitizePreviousPlayer = (player: PreviousPlayer): PreviousPlayer => {
  const sanitizedPlayer: PreviousPlayer = {
    name: player.name,
    finalScore: player.finalScore,
    removedAt: player.removedAt,
  };

  if (player.scoreHistory !== undefined) {
    sanitizedPlayer.scoreHistory = player.scoreHistory;
  }

  if (player.initialScore !== undefined) {
    sanitizedPlayer.initialScore = player.initialScore;
  }

  return sanitizedPlayer;
};

const sanitizeState = (state: GameSessionState): GameSessionState => ({
  players: state.players.map((player): Player => ({
    name: player.name,
    score: player.score,
    yellowCard: player.yellowCard,
    sittingOut: player.sittingOut,
  })),
  scores: state.scores.map(roundScores => roundScores.map(score => score)),
  previousPlayers: state.previousPlayers.map(sanitizePreviousPlayer),
  settings: {
    minimumUnit: state.settings.minimumUnit,
    enableYellowCards: state.settings.enableYellowCards,
    redCardPenalty: state.settings.redCardPenalty,
    zeroSumMode: state.settings.zeroSumMode,
  },
});

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

const isGameSessionState = (value: unknown): value is GameSessionState => {
  return (
    isObject(value) &&
    Array.isArray(value.players) &&
    value.players.every(isPlayer) &&
    Array.isArray(value.scores) &&
    value.scores.every(isNumberArray) &&
    Array.isArray(value.previousPlayers) &&
    value.previousPlayers.every(isPreviousPlayer) &&
    isSettings(value.settings)
  );
};

const getStoredSession = (data: unknown): StoredGameSession => {
  if (!isObject(data) || typeof data.joinCode !== 'string' || !isGameSessionState(data.state)) {
    throw new Error('Online session has an invalid format.');
  }

  return {
    joinCode: data.joinCode,
    state: sanitizeState(data.state),
  };
};

const createUniqueJoinCode = async () => {
  const { db } = getFirebaseServices();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const joinCode = createJoinCode();
    const existingJoinCode = await getDoc(doc(db, joinCodesCollection, joinCode));

    if (!existingJoinCode.exists()) {
      return joinCode;
    }
  }

  throw new Error('Could not create a unique join code.');
};

export const createGameSession = async (state: GameSessionState): Promise<OnlineGameSession> => {
  const { db } = getFirebaseServices();
  const uid = await getCurrentUid();
  const sessionRef = doc(collection(db, sessionsCollection));
  const memberRef = doc(db, sessionsCollection, sessionRef.id, 'members', uid);
  const joinCode = await createUniqueJoinCode();
  const joinCodeRef = doc(db, joinCodesCollection, joinCode);
  const batch = writeBatch(db);

  batch.set(sessionRef, {
    joinCode,
    createdByUid: uid,
    updatedByUid: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    revision: 1,
    state: sanitizeState(state),
  });
  batch.set(memberRef, {
    role: 'owner',
    joinedAt: serverTimestamp(),
  });
  batch.set(joinCodeRef, {
    sessionId: sessionRef.id,
    createdByUid: uid,
    createdAt: serverTimestamp(),
  });

  await batch.commit();

  return { id: sessionRef.id, joinCode };
};

export const joinGameSession = async (joinCode: string): Promise<{
  session: OnlineGameSession;
  state: GameSessionState;
}> => {
  const { db } = getFirebaseServices();
  const uid = await getCurrentUid();
  const normalizedJoinCode = normalizeJoinCode(joinCode);
  const joinCodeSnapshot = await getDoc(doc(db, joinCodesCollection, normalizedJoinCode));

  if (!joinCodeSnapshot.exists()) {
    throw new Error('No online session found for this code.');
  }

  const joinCodeData = joinCodeSnapshot.data();
  const sessionId = typeof joinCodeData.sessionId === 'string' ? joinCodeData.sessionId : '';

  if (!sessionId) {
    throw new Error('Online session code is invalid.');
  }

  await setDoc(doc(db, sessionsCollection, sessionId, 'members', uid), {
    role: 'editor',
    joinedAt: serverTimestamp(),
  }, { merge: true });

  const sessionSnapshot = await getDoc(doc(db, sessionsCollection, sessionId));

  if (!sessionSnapshot.exists()) {
    throw new Error('Online session no longer exists.');
  }

  const storedSession = getStoredSession(sessionSnapshot.data());

  return {
    session: {
      id: sessionSnapshot.id,
      joinCode: storedSession.joinCode,
    },
    state: storedSession.state,
  };
};

export const updateGameSessionState = async (sessionId: string, state: GameSessionState) => {
  const uid = await getCurrentUid();
  const { db } = getFirebaseServices();

  await updateDoc(doc(db, sessionsCollection, sessionId), {
    state: sanitizeState(state),
    revision: increment(1),
    updatedAt: serverTimestamp(),
    updatedByUid: uid,
  });
};

export const subscribeToGameSession = (
  sessionId: string,
  onState: (state: GameSessionState, session: OnlineGameSession) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  const { db } = getFirebaseServices();

  return onSnapshot(
    doc(db, sessionsCollection, sessionId),
    snapshot => {
      if (!snapshot.exists()) {
        onError(new Error('Online session no longer exists.'));
        return;
      }

      try {
        const storedSession = getStoredSession(snapshot.data());
        onState(storedSession.state, {
          id: snapshot.id,
          joinCode: storedSession.joinCode,
        });
      } catch (error) {
        onError(error instanceof Error ? error : new Error('Online session could not be read.'));
      }
    },
    error => {
      onError(error);
    }
  );
};
