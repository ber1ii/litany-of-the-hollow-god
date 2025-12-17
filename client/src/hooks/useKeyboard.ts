import { useState, useEffect } from 'react';

export const useKeyboard = () => {
  const [input, setInput] = useState({
    // Movement (WASD)
    forward: false,
    backward: false,
    left: false,
    right: false,
    // Aiming (Arrows)
    aimForward: false,
    aimBackward: false,
    aimLeft: false,
    aimRight: false,
    // Interact
    interact: false,
  });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent, isDown: boolean) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      switch (e.code) {
        // MOVEMENT
        case 'KeyW':
          setInput((i) => ({ ...i, forward: isDown }));
          break;
        case 'KeyS':
          setInput((i) => ({ ...i, backward: isDown }));
          break;
        case 'KeyA':
          setInput((i) => ({ ...i, left: isDown }));
          break;
        case 'KeyD':
          setInput((i) => ({ ...i, right: isDown }));
          break;

        // AIMING
        case 'ArrowUp':
          setInput((i) => ({ ...i, aimForward: isDown }));
          break;
        case 'ArrowDown':
          setInput((i) => ({ ...i, aimBackward: isDown }));
          break;
        case 'ArrowLeft':
          setInput((i) => ({ ...i, aimLeft: isDown }));
          break;
        case 'ArrowRight':
          setInput((i) => ({ ...i, aimRight: isDown }));
          break;

        // Interact
        case 'KeyE':
          setInput((i) => ({ ...i, interact: isDown }));
          break;
      }
    };

    const down = (e: KeyboardEvent) => handleKey(e, true);
    const up = (e: KeyboardEvent) => handleKey(e, false);

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  return input;
};
