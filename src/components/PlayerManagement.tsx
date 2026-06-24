import React, { useState } from 'react';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2, Users, X } from 'lucide-react';
import { Player, PreviousPlayer } from '../types';

interface PlayerManagementProps {
  players: Player[];
  previousPlayers: PreviousPlayer[];
  onAddPlayer: (name: string, initialScore?: number, scoreHistory?: number[]) => void;
  onRemovePlayer: (index: number) => void;
  onReorderPlayers: (fromIndex: number, toIndex: number) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface SortablePlayerRowProps {
  player: Player;
  index: number;
  onRemovePlayer: (index: number) => void;
}

const SortablePlayerRow: React.FC<SortablePlayerRowProps> = ({
  player,
  index,
  onRemovePlayer,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.name });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-2 rounded-lg bg-gray-700/30 group hover:bg-gray-700/50 transition-colors ${
        isDragging ? 'opacity-70 ring-2 ring-blue-500' : ''
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-600/60 rounded-lg transition-colors touch-none"
          title="Drag to reorder"
          aria-label={`Reorder ${player.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="text-gray-200 group-hover:text-white transition-colors truncate">
          {player.name}
        </span>
      </div>
      <button
        onClick={() => onRemovePlayer(index)}
        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
        title="Remove player"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
};

const getPreviousPlayerInitialScore = (player: PreviousPlayer): number => {
  if (!player.scoreHistory) return player.finalScore;

  const scoreHistoryTotal = player.scoreHistory.reduce((sum, score) => sum + score, 0);
  return player.initialScore ?? player.finalScore - scoreHistoryTotal;
};

export const PlayerManagement: React.FC<PlayerManagementProps> = ({
  players,
  previousPlayers,
  onAddPlayer,
  onRemovePlayer,
  onReorderPlayers,
  isOpen,
  onClose,
}) => {
  const [newPlayerName, setNewPlayerName] = useState('');
  const [restoreCandidate, setRestoreCandidate] = useState<PreviousPlayer | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (!isOpen) return null;

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const fromIndex = players.findIndex(player => player.name === activeId);
    const toIndex = players.findIndex(player => player.name === overId);

    if (fromIndex === -1 || toIndex === -1) return;

    onReorderPlayers(fromIndex, toIndex);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    
    const playerExists = players.some(p => p.name.toLowerCase() === newPlayerName.trim().toLowerCase());
    if (playerExists) {
      alert('A player with this name already exists');
      return;
    }

    const previousPlayer = previousPlayers.find(
      p => p.name.toLowerCase() === newPlayerName.trim().toLowerCase()
    );

    if (previousPlayer) {
      setRestoreCandidate(previousPlayer);
      return;
    } else {
      onAddPlayer(newPlayerName.trim());
    }

    setNewPlayerName('');
  };

  const handleRestorePreviousPlayer = () => {
    if (!restoreCandidate) return;

    onAddPlayer(
      restoreCandidate.name,
      getPreviousPlayerInitialScore(restoreCandidate),
      restoreCandidate.scoreHistory
    );
    setRestoreCandidate(null);
    setNewPlayerName('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800/90 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-gray-700 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Player Management
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Add New Player
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Player name"
                className="flex-1 p-2 bg-gray-700/50 rounded-lg border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-100"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
                disabled={players.length >= 12}
              >
                <Plus className="h-5 w-5" />
                Add
              </button>
            </div>
            {players.length >= 12 && (
              <p className="mt-2 text-sm text-red-400">
                Maximum number of players (12) reached
              </p>
            )}
            {restoreCandidate && (
              <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                <p className="text-sm text-blue-200">
                  {restoreCandidate.name} was previously in the game with a score of {restoreCandidate.finalScore}.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleRestorePreviousPlayer}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-lg transition-colors"
                  >
                    Restore Score
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestoreCandidate(null)}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Current Players</h3>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={players.map(player => player.name)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {players.map((player, index) => (
                  <SortablePlayerRow
                    key={player.name}
                    player={player}
                    index={index}
                    onRemovePlayer={onRemovePlayer}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );
};
