import { useCallback, useEffect, useRef, useState } from 'react';
import { Settings2, Users } from 'lucide-react';
import { PlayerSetup } from './components/PlayerSetup';
import { ScoreInput } from './components/ScoreInput';
import { ScoreHistory } from './components/ScoreHistory';
import { TotalScores } from './components/TotalScores';
import { Settings } from './components/Settings';
import { PlayerManagement } from './components/PlayerManagement';
import { GameSessionSync } from './components/GameSessionSync';
import { Footer } from './components/Footer';
import { Imprint } from './pages/Imprint';
import { GameSessionState, GameStateTransferData, OnlineGameSession, Player, PreviousPlayer, SyncStatus } from './types';
import { useAuth } from './contexts/AuthContext';
import { useSettings } from './contexts/SettingsContext';
import { isFirebaseConfigured } from './lib/firebase';
import {
  createGameSession,
  joinGameSession,
  subscribeToGameSession,
  updateGameSessionState,
} from './services/gameSessionService';
import { getBobGameState } from './utils/bobGameState';
import { calculateTotalScores, normalizeRoundScores } from './utils/scoreUtils';

const moveArrayItem = <T,>(items: T[], fromIndex: number, toIndex: number): T[] => {
  const updatedItems = [...items];
  const [movedItem] = updatedItems.splice(fromIndex, 1);
  updatedItems.splice(toIndex, 0, movedItem);
  return updatedItems;
};

const onlineSessionStorageKey = 'onlineGameSession';

function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [previousPlayers, setPreviousPlayers] = useState<PreviousPlayer[]>([]);
  const [scores, setScores] = useState<number[][]>([]);
  const [showSetup, setShowSetup] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showPlayerManagement, setShowPlayerManagement] = useState(false);
  const [onlineSession, setOnlineSession] = useState<OnlineGameSession | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');
  const [syncError, setSyncError] = useState('');
  const onlineSessionRef = useRef<OnlineGameSession | null>(null);
  const unsubscribeOnlineSessionRef = useRef<(() => void) | null>(null);
  const applyingRemoteStateRef = useRef(false);
  const { signOut } = useAuth();
  const { settings, updateSettings } = useSettings();

  useEffect(() => {
    const storedPlayers = localStorage.getItem('players');
    const storedScores = localStorage.getItem('scores');
    const storedPreviousPlayers = localStorage.getItem('previousPlayers');
    
    if (storedPlayers && storedScores) {
      setPlayers(JSON.parse(storedPlayers));
      setScores(JSON.parse(storedScores));
      setShowSetup(false);
    }
    
    if (storedPreviousPlayers) {
      setPreviousPlayers(JSON.parse(storedPreviousPlayers));
    }
  }, []);

  const persistLocalGameState = useCallback((gameState: GameSessionState) => {
    setPlayers(gameState.players);
    setScores(gameState.scores);
    setPreviousPlayers(gameState.previousPlayers);
    setShowSetup(gameState.players.length === 0);
    updateSettings(gameState.settings);
    localStorage.setItem('players', JSON.stringify(gameState.players));
    localStorage.setItem('scores', JSON.stringify(gameState.scores));
    localStorage.setItem('previousPlayers', JSON.stringify(gameState.previousPlayers));
    localStorage.setItem('schafkopf-settings', JSON.stringify(gameState.settings));
  }, [updateSettings]);

  const publishOnlineGameState = useCallback((gameState: GameSessionState) => {
    const activeSession = onlineSessionRef.current;

    if (!activeSession || applyingRemoteStateRef.current) return;

    setSyncStatus('saving');
    setSyncError('');
    void updateGameSessionState(activeSession.id, gameState)
      .then(() => {
        setSyncStatus('online');
      })
      .catch((error) => {
        setSyncStatus('error');
        setSyncError(error instanceof Error ? error.message : 'Online session could not be saved.');
      });
  }, []);

  const saveGameState = useCallback((gameState: GameSessionState) => {
    persistLocalGameState(gameState);
    publishOnlineGameState(gameState);
  }, [persistLocalGameState, publishOnlineGameState]);

  const applyRemoteGameState = useCallback((gameState: GameSessionState) => {
    applyingRemoteStateRef.current = true;
    persistLocalGameState(gameState);
    setSyncStatus('online');
    setSyncError('');
    window.setTimeout(() => {
      applyingRemoteStateRef.current = false;
    }, 0);
  }, [persistLocalGameState]);

  const connectOnlineSession = useCallback((session: OnlineGameSession) => {
    unsubscribeOnlineSessionRef.current?.();
    onlineSessionRef.current = session;
    setOnlineSession(session);
    setSyncStatus('connecting');
    setSyncError('');
    localStorage.setItem(onlineSessionStorageKey, JSON.stringify(session));

    unsubscribeOnlineSessionRef.current = subscribeToGameSession(
      session.id,
      (remoteState, remoteSession) => {
        onlineSessionRef.current = remoteSession;
        setOnlineSession(remoteSession);
        localStorage.setItem(onlineSessionStorageKey, JSON.stringify(remoteSession));
        applyRemoteGameState(remoteState);
      },
      (error) => {
        setSyncStatus('error');
        setSyncError(error.message);
      }
    );
  }, [applyRemoteGameState]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const storedOnlineSession = localStorage.getItem(onlineSessionStorageKey);
    if (!storedOnlineSession) return;

    try {
      const parsedSession = JSON.parse(storedOnlineSession) as OnlineGameSession;
      if (parsedSession.id && parsedSession.joinCode) {
        connectOnlineSession(parsedSession);
      }
    } catch {
      localStorage.removeItem(onlineSessionStorageKey);
    }

    return () => {
      unsubscribeOnlineSessionRef.current?.();
    };
  }, [connectOnlineSession]);

  const handlePlayerSetup = (playerNames: string[]) => {
    if (playerNames.length === 1 && playerNames[0].toLowerCase() === 'bob') {
      handleImportGameState(getBobGameState());
      return;
    }

    const newPlayers = playerNames.map(name => ({
      name,
      score: 0,
      yellowCard: false,
      sittingOut: false
    }));

    saveGameState({
      players: newPlayers,
      scores: [],
      previousPlayers: [],
      settings,
    });
  };

  const handleImportGameState = (gameState: GameStateTransferData) => {
    saveGameState({
      players: gameState.players,
      scores: gameState.scores,
      previousPlayers: gameState.previousPlayers,
      settings: gameState.settings,
    });
  };

  const handleCreateOnlineSession = async () => {
    const session = await createGameSession({
      players,
      scores,
      previousPlayers,
      settings,
    });

    connectOnlineSession(session);
  };

  const handleJoinOnlineSession = async (joinCode: string) => {
    setSyncStatus('connecting');
    setSyncError('');

    const { session, state } = await joinGameSession(joinCode);
    connectOnlineSession(session);
    applyRemoteGameState(state);
  };

  const handleLeaveOnlineSession = () => {
    unsubscribeOnlineSessionRef.current?.();
    unsubscribeOnlineSessionRef.current = null;
    onlineSessionRef.current = null;
    setOnlineSession(null);
    setSyncStatus('offline');
    setSyncError('');
    localStorage.removeItem(onlineSessionStorageKey);
  };

  const path = window.location.pathname;
  if (path === '/imprint') return <Imprint />;

  if (showSetup) {
    return (
      <>
        <PlayerSetup onSubmit={handlePlayerSetup}>
          <GameSessionSync
            isConfigured={isFirebaseConfigured}
            activeSession={onlineSession}
            syncStatus={syncStatus}
            syncError={syncError}
            onJoin={handleJoinOnlineSession}
            onLeave={handleLeaveOnlineSession}
          />
        </PlayerSetup>
      </>
    );
  }

  const handleAddPlayer = (name: string, initialScore: number = 0, scoreHistory?: number[]) => {
    const newPlayer: Player = {
      name,
      score: initialScore,
      yellowCard: false,
      sittingOut: false
    };
    const updatedPlayers = [...players, newPlayer];
    const updatedScores = scoreHistory
      ? scores.map((roundScores, roundIndex) => [
          ...normalizeRoundScores(roundScores, players.length),
          scoreHistory[roundIndex] ?? 0
        ])
      : scores;
    const updatedPreviousPlayers = scoreHistory
      ? previousPlayers.filter(player => player.name.toLowerCase() !== name.toLowerCase())
      : previousPlayers;

    saveGameState({
      players: updatedPlayers,
      scores: updatedScores,
      previousPlayers: updatedPreviousPlayers,
      settings,
    });
  };

  const handleRemovePlayer = (index: number) => {
    const playerToRemove = players[index];
    const totalScores = calculateTotalScores(scores, players.length, players.map(player => player.score));
    const finalScore = totalScores[index];
    const normalizedScores = scores.map(roundScores => normalizeRoundScores(roundScores, players.length));
    const scoreHistory = normalizedScores.map(roundScores => roundScores[index] ?? 0);

    // Add to previous players
    const newPreviousPlayer: PreviousPlayer = {
      name: playerToRemove.name,
      finalScore: finalScore,
      removedAt: new Date().toISOString(),
      scoreHistory,
      initialScore: playerToRemove.score
    };
    const updatedPreviousPlayers = [...previousPlayers, newPreviousPlayer];

    // Remove player from active list
    const updatedPlayers = players.filter((_, i) => i !== index);

    // Remove player's scores from history
    const updatedScores = normalizedScores.map(roundScores =>
      roundScores.filter((_, i) => i !== index)
    );

    saveGameState({
      players: updatedPlayers,
      scores: updatedScores,
      previousPlayers: updatedPreviousPlayers,
      settings,
    });
  };

  const handleReorderPlayers = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= players.length ||
      toIndex >= players.length
    ) {
      return;
    }

    const updatedPlayers = moveArrayItem(players, fromIndex, toIndex);
    const updatedScores = scores.map(roundScores =>
      moveArrayItem(normalizeRoundScores(roundScores, players.length), fromIndex, toIndex)
    );

    saveGameState({
      players: updatedPlayers,
      scores: updatedScores,
      previousPlayers,
      settings,
    });
  };

  const handleScoreSubmit = (newScores: number[]) => {
    const updatedScores = [...scores, newScores];

    // Update sitting out status
    const nextPlayers = players.map((player, i) => ({
      ...player,
      sittingOut: i > 0 ? players[i-1].sittingOut : players[players.length-1].sittingOut
    }));

    saveGameState({
      players: nextPlayers,
      scores: updatedScores,
      previousPlayers,
      settings,
    });
  };

  const handleYellowCard = (playerIndex: number) => {
    const updatedPlayers = players.map((player, index) => 
      index === playerIndex 
        ? { ...player, yellowCard: !player.yellowCard }
        : player
    );
    saveGameState({
      players: updatedPlayers,
      scores,
      previousPlayers,
      settings,
    });
  };

  const handleSittingOutChange = (playerIndex: number, value: boolean) => {
    const updatedPlayers = players.map((player, index) =>
      index === playerIndex ? { ...player, sittingOut: value } : player
    );
    saveGameState({
      players: updatedPlayers,
      scores,
      previousPlayers,
      settings,
    });
  };

  const handleRemoveLastScore = () => {
    if (scores.length === 0) return;
    const newScores = scores.slice(0, -1);
    saveGameState({
      players,
      scores: newScores,
      previousPlayers,
      settings,
    });
  };

  const handleNewGame = () => {
    if (confirm('Start a new game? This will reset all scores.')) {
      saveGameState({
        players: [],
        scores: [],
        previousPlayers: [],
        settings,
      });
    }
  };

  const handleSaveSettings = (nextSettings: GameSessionState['settings']) => {
    saveGameState({
      players,
      scores,
      previousPlayers,
      settings: nextSettings,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white p-4 pb-8">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1533134486753-c833f0ed4866?q=80&w=3270&auto=format&fit=crop')] opacity-5 bg-cover bg-center pointer-events-none" />
      <div className="relative max-w-5xl mx-auto">
        <header className="text-center mb-8 pt-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setShowPlayerManagement(true)}
                className="p-2 hover:bg-gray-800/50 rounded-lg transition-colors"
                title="Manage Players"
              >
                <Users className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              Scorekeeper
            </h1>
            <div>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 hover:bg-gray-800/50 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings2 className="h-5 w-5 text-gray-400" />
              </button>
            </div>
          </div>
        </header>

        <div className="mb-8">
          <GameSessionSync
            isConfigured={isFirebaseConfigured}
            activeSession={onlineSession}
            syncStatus={syncStatus}
            syncError={syncError}
            onCreate={handleCreateOnlineSession}
            onJoin={handleJoinOnlineSession}
            onLeave={handleLeaveOnlineSession}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <TotalScores 
            players={players} 
            scores={scores}
            previousPlayers={previousPlayers}
          />
          <ScoreInput
            players={players}
            onSubmit={handleScoreSubmit}
            onYellowCard={handleYellowCard}
            onSittingOutChange={handleSittingOutChange}
          />
        </div>

        <ScoreHistory
          players={players}
          scores={scores}
          onRemoveLastScore={handleRemoveLastScore}
          onNewGame={handleNewGame}
        />
        
        <PlayerManagement
          isOpen={showPlayerManagement}
          onClose={() => setShowPlayerManagement(false)}
          players={players}
          previousPlayers={previousPlayers}
          onAddPlayer={handleAddPlayer}
          onRemovePlayer={handleRemovePlayer}
          onReorderPlayers={handleReorderPlayers}
        />

        <Settings
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onSignOut={signOut}
          onSaveSettings={handleSaveSettings}
        />

        <Footer />
      </div>
    </div>
  );
}

export default App;
