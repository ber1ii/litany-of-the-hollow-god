import { useState } from 'react';
import { MainMenu } from './components/UI/MainMenu';
import { Game } from './components/Game/Game';
import { CharacterCreation } from './components/UI/CharacterCreation';
import { preloadAllAssets } from './utils/assetUtils';
import { SaveManager } from './utils/SaveManager';
import type { SaveData } from './utils/SaveManager';
import type { ClassId } from './data/Classes';

// Start preloading immediately
preloadAllAssets();

function App() {
  const [currentScreen, setCurrentScreen] = useState<'menu' | 'character_creation' | 'game'>(
    'menu'
  );
  const [loadedSaveData, setLoadedSaveData] = useState<SaveData | null>(null);

  // --- MENU ACTIONS ---

  const handleStartNewGame = () => {
    // Go to Character Creation instead of straight to game
    setCurrentScreen('character_creation');
  };

  const handleClassSelected = (classId: ClassId) => {
    // Generate fresh save data based on the chosen class
    const newSave = SaveManager.createFreshSave(classId);
    setLoadedSaveData(newSave);
    setCurrentScreen('game');
  };

  const handleLoadGame = async () => {
    console.log('Loading game...');
    const data = await SaveManager.loadGame();
    if (data) {
      console.log('Save data found:', data);
      setLoadedSaveData(data);
      setCurrentScreen('game');
    } else {
      console.error('No save data found');
    }
  };

  const handleBackToMenu = () => {
    setCurrentScreen('menu');
  };

  const handleExitGame = () => {
    setCurrentScreen('menu');
    setLoadedSaveData(null);
  };

  // --- PLACEHOLDERS ---
  const handleContinue = () => console.log('Continue not implemented yet.');
  const handleLore = () => console.log('Lorefinder not implemented yet.');
  const handleOptions = () => console.log('Options not implemented yet.');

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden' }}>
      {currentScreen === 'menu' && (
        <MainMenu
          onNewGame={handleStartNewGame}
          onLoadGame={handleLoadGame}
          onContinue={handleContinue}
          onLorefinder={handleLore}
          onOptions={handleOptions}
        />
      )}

      {currentScreen === 'character_creation' && (
        <CharacterCreation onConfirm={handleClassSelected} onBack={handleBackToMenu} />
      )}

      {currentScreen === 'game' && (
        <Game onExit={handleExitGame} initialSaveData={loadedSaveData} />
      )}
    </div>
  );
}

export default App;
