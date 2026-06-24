import React from 'react';

interface PlayerSetupProps {
  onSubmit: (players: string[]) => void;
  children?: React.ReactNode;
}

export const PlayerSetup: React.FC<PlayerSetupProps> = ({ onSubmit, children }) => {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const playerNames = formData.get('players')?.toString().split(',').map(name => name.trim()) || [];
    const isBobImport = playerNames.length === 1 && playerNames[0].toLowerCase() === 'bob';
    
    if (playerNames.length > 12) {
      alert('Please enter no more than 12 players');
      return;
    }

    if (playerNames.length < 2 && !isBobImport) {
      alert('Please enter at least 2 players');
      return;
    }

    // Check for duplicate names
    const uniqueNames = new Set(playerNames.map(name => name.toLowerCase()));
    if (uniqueNames.size !== playerNames.length) {
      alert('Each player must have a unique name');
      return;
    }

    onSubmit(playerNames);
  };

  return (
    <div className="min-h-screen bg-[conic-gradient(at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-xl p-8 border border-gray-700">
        <h1 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
          Scorekeeper
        </h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Enter player names (comma-separated)
            </label>
            <input
              name="players"
              className="w-full p-3 bg-gray-700/50 rounded-lg border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-100"
              placeholder="e.g. John, Jane, Bob"
              required
            />
            <p className="mt-2 text-sm text-gray-400">
              Enter between 2 and 12 unique player names
            </p>
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Start Game
          </button>
        </form>
        {children && (
          <div className="mt-4 border-t border-gray-700 pt-4">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};
