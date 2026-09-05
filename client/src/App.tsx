import { useState } from 'react';
import { MainMenu } from './components/UI/MainMenu';
import { Game } from './components/Game/Game';
import { CharacterCreation } from './components/UI/CharacterCreation';
import { preloadAllAssets } from './utils/assetUtils';
import { preloadEnvironmentAssets } from './utils/EnvironmentAssetPreload';
import { SaveManager } from './utils/SaveManager';
import type { SaveData } from './utils/SaveManager';
import type { ClassId } from './data/Classes';

// Start preloading immediately outside the React tree
preloadAllAssets();
preloadEnvironmentAssets();

function App() {
  const [currentScreen, setCurrentScreen] = useState<'menu' | 'character_creation' | 'game'>(
    'menu'
  );
  const [loadedSaveData, setLoadedSaveData] = useState<SaveData | null>(null);

  const handleStartNewGame = () => setCurrentScreen('character_creation');

  const handleClassSelected = (classId: ClassId) => {
    const newSave = SaveManager.createFreshSave(classId);
    setLoadedSaveData(newSave);
    setCurrentScreen('game');
  };

  const handleLoadGame = async () => {
    const data = await SaveManager.loadGame();
    if (data) {
      setLoadedSaveData(data);
      setCurrentScreen('game');
    }
  };

  const handleBackToMenu = () => setCurrentScreen('menu');
  const handleExitGame = () => {
    setCurrentScreen('menu');
    setLoadedSaveData(null);
  };

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
