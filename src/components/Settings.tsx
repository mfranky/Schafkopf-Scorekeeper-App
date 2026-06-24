import React, { useState } from 'react';
import { Settings2, X, LogOut } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { Settings as GameSettings } from '../types';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSignOut: () => void;
  onSaveSettings?: (settings: GameSettings) => void;
}

export const Settings: React.FC<SettingsProps> = ({ isOpen, onClose, onSignOut, onSaveSettings }) => {
  const { settings, updateSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings);

  if (!isOpen) return null;

  const handleSave = () => {
    const nextSettings = {
      minimumUnit: localSettings.minimumUnit || 10,
      redCardPenalty: localSettings.redCardPenalty || 10,
      enableYellowCards: localSettings.enableYellowCards,
      zeroSumMode: localSettings.zeroSumMode
    };

    updateSettings(nextSettings);
    onSaveSettings?.(nextSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800/90 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-gray-700 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Minimum Score Unit
            </label>
            <input
              type="number"
              value={localSettings.minimumUnit}
              onChange={(e) => setLocalSettings(prev => ({
                ...prev,
                minimumUnit: e.target.value ? Math.max(1, parseInt(e.target.value)) : undefined
              }))}
              className="w-full p-2 bg-gray-700/50 rounded-lg border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-100"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-gray-300">
              <input
                type="checkbox"
                checked={localSettings.zeroSumMode}
                onChange={(e) => setLocalSettings(prev => ({
                  ...prev,
                  zeroSumMode: e.target.checked
                }))}
                className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
              />
              Disable Zero Sum Mode
            </label>
            <p className="text-sm text-gray-400 mt-1">
              When disabled, scores can be any value. When enabled, scores must sum to zero and empty scores will be auto-calculated
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-gray-300">
              <input
                type="checkbox"
                checked={localSettings.enableYellowCards}
                onChange={(e) => setLocalSettings(prev => ({
                  ...prev,
                  enableYellowCards: e.target.checked
                }))}
                className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
              />
              Enable Yellow & Red Cards
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Red Card Penalty per Player
            </label>
            <input
              type="number"
              value={localSettings.redCardPenalty}
              onChange={(e) => setLocalSettings(prev => ({
                ...prev,
                redCardPenalty: e.target.value ? Math.max(1, parseInt(e.target.value)) : undefined
              }))}
              className="w-full p-2 bg-gray-700/50 rounded-lg border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-100"
            />
          </div>

          <div className="border-t border-gray-700 pt-6">
            <button
              onClick={onSignOut}
              className="w-full flex items-center justify-center gap-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 font-medium py-3 px-4 rounded-lg transition-colors"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </div>

          <button
            onClick={handleSave}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
