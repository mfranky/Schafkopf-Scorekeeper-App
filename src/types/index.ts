export interface Player {
  name: string;
  score: number;
  yellowCard: boolean;
  sittingOut: boolean;
}

export interface PreviousPlayer {
  name: string;
  finalScore: number;
  removedAt: string;
  scoreHistory?: number[];
  initialScore?: number;
}

export interface GameStateTransferData {
  version: 1;
  exportedAt: string;
  players: Player[];
  scores: number[][];
  previousPlayers: PreviousPlayer[];
  settings: Settings;
}

export interface GameSessionState {
  players: Player[];
  scores: number[][];
  previousPlayers: PreviousPlayer[];
  settings: Settings;
}

export interface OnlineGameSession {
  id: string;
  joinCode: string;
}

export type SyncStatus = 'offline' | 'connecting' | 'online' | 'saving' | 'error';

export interface ScoreInputProps {
  players: Player[];
  onSubmit: (scores: number[]) => void;
  onYellowCard: (index: number) => void;
  onSittingOutChange: (index: number, value: boolean) => void;
}

export interface Settings {
  minimumUnit: number;
  enableYellowCards: boolean;
  redCardPenalty: number;
  zeroSumMode: boolean;
}

export interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
}
