import React, { useState } from 'react';
import { Cloud, Link2, LogOut, Plus, Users } from 'lucide-react';
import { OnlineGameSession, SyncStatus } from '../types';

interface GameSessionSyncProps {
  isConfigured: boolean;
  activeSession: OnlineGameSession | null;
  syncStatus: SyncStatus;
  syncError: string;
  onCreate?: () => Promise<void>;
  onJoin: (joinCode: string) => Promise<void>;
  onLeave?: () => void;
}

const statusLabel: Record<SyncStatus, string> = {
  offline: 'Offline',
  connecting: 'Connecting',
  online: 'Online',
  saving: 'Saving',
  error: 'Error',
};

export const GameSessionSync: React.FC<GameSessionSyncProps> = ({
  isConfigured,
  activeSession,
  syncStatus,
  syncError,
  onCreate,
  onJoin,
  onLeave,
}) => {
  const [joinCode, setJoinCode] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!joinCode.trim()) return;

    setIsBusy(true);
    setLocalError('');

    try {
      await onJoin(joinCode);
      setJoinCode('');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Could not join online session.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!onCreate) return;

    setIsBusy(true);
    setLocalError('');

    try {
      await onCreate();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Could not create online session.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 shadow-xl backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-100">
          <Cloud className="h-4 w-4" />
          Online Session
        </h2>
        <span className={`text-xs ${syncStatus === 'error' ? 'text-red-400' : 'text-gray-400'}`}>
          {activeSession ? statusLabel[syncStatus] : statusLabel.offline}
        </span>
      </div>

      {!isConfigured ? (
        <p className="text-sm text-gray-400">Firebase config missing.</p>
      ) : activeSession ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-900/50 px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs text-gray-400">Join Code</p>
              <p className="font-mono text-lg font-semibold tracking-wider text-gray-100">
                {activeSession.joinCode}
              </p>
            </div>
            {onLeave && (
              <button
                type="button"
                onClick={onLeave}
                className="p-2 text-gray-400 transition-colors hover:text-red-400"
                title="Leave online session"
              >
                <LogOut className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {onCreate && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={isBusy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-blue-600/50"
            >
              <Plus className="h-5 w-5" />
              Create Online Session
            </button>
          )}

          <form onSubmit={handleJoin} className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="Join code"
              className="min-w-0 flex-1 rounded-lg border border-gray-600 bg-gray-700/50 p-2 text-gray-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isBusy || !joinCode.trim()}
              className="rounded-lg bg-gray-700 px-4 py-2 text-white transition-colors hover:bg-gray-600 disabled:opacity-50"
              title="Join online session"
            >
              <Link2 className="h-5 w-5" />
            </button>
          </form>
        </div>
      )}

      {(localError || syncError) && (
        <p className="mt-3 text-sm text-red-400">{localError || syncError}</p>
      )}

      {activeSession && syncStatus === 'online' && (
        <p className="mt-3 flex items-center gap-2 text-xs text-gray-400">
          <Users className="h-4 w-4" />
          Live sync active
        </p>
      )}
    </div>
  );
};
