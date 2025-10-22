import React, { useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

const BALLS = [
  { color: 'red', value: 1, emoji: '🔴' },
  { color: 'yellow', value: 2, emoji: '🟡' },
  { color: 'green', value: 3, emoji: '🟢' },
  { color: 'brown', value: 4, emoji: '🟤' },
  { color: 'blue', value: 5, emoji: '🔵' },
  { color: 'pink', value: 6, emoji: '🟣' },
  { color: 'black', value: 7, emoji: '⚫' },
];

const FOUL_BALLS = [
  ...BALLS.filter(b => b.value >= 2).map(ball => ({
    ...ball,
    value: Math.max(4, ball.value),
  })),
  { color: 'red', value: 10, emoji: '🔴' }
].sort((a, b) => a.value - b.value);


interface Player {
  id: number;
  name: string;
  score: number;
  break: number;
  rank: number | null;
}

interface GameState {
  players: Player[];
  currentPlayerId: number;
}

interface AnimationState {
  key: number;
  value: number;
  startPos: { x: number; y: number };
  endPos: { x: number; y: number };
}


const Stopwatch = ({ resetTrigger }: { resetTrigger: number }) => {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval: number | undefined;
    if (isRunning) {
      interval = window.setInterval(() => {
        setTime(prevTime => prevTime + 1);
      }, 1000);
    }
    return () => window.clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (resetTrigger > 0) {
        setTime(0);
        setIsRunning(false);
    }
  }, [resetTrigger]);

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
    const seconds = (timeInSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  return (
    <div className="stopwatch">
      <div className="timer-display" aria-label="Stopwatch time">{formatTime(time)}</div>
      <div className="timer-controls">
        <button className="btn btn-timer" onClick={() => setIsRunning(!isRunning)}>{isRunning ? 'Pause' : 'Start'}</button>
        <button className="btn btn-timer" onClick={() => { setTime(0); setIsRunning(false); }}>Reset</button>
      </div>
    </div>
  );
};

const App = () => {
  const initialPlayer1: Player = { id: 1, name: 'Player 1', score: 0, break: 0, rank: null };
  const initialPlayer2: Player = { id: 2, name: 'Player 2', score: 0, break: 0, rank: null };
  
  const initialGameState: GameState = {
    players: [initialPlayer1, initialPlayer2],
    currentPlayerId: 1,
  };

  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [history, setHistory] = useState<GameState[]>([]);
  const [resetStopwatchTrigger, setResetStopwatchTrigger] = useState(0);
  const [isFoulMode, setIsFoulMode] = useState(false);
  const [animation, setAnimation] = useState<AnimationState | null>(null);

  const saveToHistory = useCallback(() => {
    setHistory(prev => [...prev, gameState]);
  }, [gameState]);

  const handlePot = (points: number, event: React.MouseEvent<HTMLButtonElement>) => {
    const ballButton = event.currentTarget;
    const activePlayerScoreEl = document.querySelector('.player-panel.active .player-score');
    if (!activePlayerScoreEl) return;

    const ballRect = ballButton.getBoundingClientRect();
    const scoreRect = activePlayerScoreEl.getBoundingClientRect();

    const startPos = {
      x: ballRect.left + ballRect.width / 2,
      y: ballRect.top + ballRect.height / 2,
    };
    const endPos = {
      x: scoreRect.left + scoreRect.width / 2,
      y: scoreRect.top + scoreRect.height / 2,
    };

    setAnimation({
      key: Date.now(),
      value: points,
      startPos,
      endPos,
    });
    
    // Delay state update to sync with animation
    setTimeout(() => {
      saveToHistory();
      setGameState(prev => {
        const currentPlayer = prev.players.find(p => p.id === prev.currentPlayerId);
        if (!currentPlayer) return prev;
    
        const newBreak = currentPlayer.break + points;
        let newRankForPlayer: number | null = null;
        
        if (newBreak >= 100 && currentPlayer.rank === null) {
          const existingRanks = prev.players.map(p => p.rank).filter(r => r !== null) as number[];
          newRankForPlayer = existingRanks.length > 0 ? Math.max(...existingRanks) + 1 : 1;
        }
    
        const updatedPlayers = prev.players.map(p => {
          if (p.id === prev.currentPlayerId) {
            return {
              ...p,
              score: p.score + points,
              break: newBreak,
              rank: p.rank || newRankForPlayer,
            };
          }
          return p;
        });
    
        return { ...prev, players: updatedPlayers };
      });
      setAnimation(null);
    }, 800);
  };

  const handleFoul = (foulValue: number) => {
    saveToHistory();
    setGameState(prev => {
        const currentPlayerIndex = prev.players.findIndex(p => p.id === prev.currentPlayerId);
        const nextPlayerIndex = (currentPlayerIndex + 1) % prev.players.length;
        const nextPlayerId = prev.players[nextPlayerIndex].id;

        const updatedPlayers = prev.players.map(p => {
            if (p.id === nextPlayerId) {
                return { ...p, score: p.score + foulValue };
            }
            if(p.id === prev.currentPlayerId) {
                return { ...p, break: 0 };
            }
            return p;
        });

        return { ...prev, players: updatedPlayers };
    });
    setIsFoulMode(false);
  };

  const handlePlayerSelect = (selectedPlayerId: number) => {
    if (selectedPlayerId === gameState.currentPlayerId) return;

    saveToHistory();
    setGameState(prev => {
        const playersWithResetBreak = prev.players.map(p => 
            p.id === prev.currentPlayerId ? { ...p, break: 0 } : p
        );
        
        return {
            ...prev,
            players: playersWithResetBreak,
            currentPlayerId: selectedPlayerId,
        };
    });
  }
  
  const handleUndo = () => {
    if (history.length > 0) {
      const lastState = history[history.length - 1];
      setGameState(lastState);
      setHistory(prev => prev.slice(0, -1));
    }
  };
  
  const handleNewGame = () => {
    setHistory([]);
    setGameState(prev => {
        const resetPlayers = prev.players.map(p => ({
            ...p,
            score: 0,
            break: 0,
            rank: null,
        }));
        return {
            ...prev,
            players: resetPlayers,
            currentPlayerId: prev.players.length > 0 ? prev.players[0].id : 1,
        };
    });
    setResetStopwatchTrigger(c => c + 1);
  };

  const handleAddPlayer = () => {
    if (gameState.players.length >= 8) {
      alert("Maximum of 8 players reached.");
      return;
    }
    saveToHistory();
    setGameState(prev => {
      const newId = prev.players.length > 0 ? Math.max(...prev.players.map(p => p.id)) + 1 : 1;
      const newPlayer: Player = { id: newId, name: `Player ${newId}`, score: 0, break: 0, rank: null };
      return { ...prev, players: [...prev.players, newPlayer] };
    });
  };

  const handleRemovePlayer = (idToRemove: number) => {
    if (gameState.players.length <= 2) {
      alert("Cannot have fewer than 2 players.");
      return;
    }
    saveToHistory();
    setGameState(prev => {
      const playerToRemoveIndex = prev.players.findIndex(p => p.id === idToRemove);
      const newPlayers = prev.players.filter(p => p.id !== idToRemove);
      let newCurrentPlayerId = prev.currentPlayerId;
      if (prev.currentPlayerId === idToRemove) {
        const nextPlayerIndex = playerToRemoveIndex % newPlayers.length;
        newCurrentPlayerId = newPlayers[nextPlayerIndex].id;
      }
      return { ...prev, players: newPlayers, currentPlayerId: newCurrentPlayerId };
    });
  };

  const handleNameChange = (id: number, newName: string) => {
    saveToHistory();
    setGameState(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === id ? { ...p, name: newName } : p)
    }));
  };

  return (
    <div className="app-container">
      <header>
        <h1>Snooker Score Board</h1>
        <p className="subtitle">by GNG boys</p>
        <Stopwatch resetTrigger={resetStopwatchTrigger} />
      </header>

      <main>
        {animation && (
          <div
            key={animation.key}
            className="score-fly-animation"
            // Fix: Cast style object to React.CSSProperties to allow for custom CSS properties.
            style={{
              '--start-x': `${animation.startPos.x}px`,
              '--start-y': `${animation.startPos.y}px`,
              '--end-x': `${animation.endPos.x}px`,
              '--end-y': `${animation.endPos.y}px`,
            } as React.CSSProperties}
          >
            +{animation.value}
          </div>
        )}
        <div className="scoreboard">
          {gameState.players.map(player => (
            <PlayerPanel 
              key={player.id} 
              player={player} 
              isActive={gameState.currentPlayerId === player.id}
              onNameChange={handleNameChange}
              onRemove={handleRemovePlayer}
              onPlayerSelect={handlePlayerSelect}
            />
          ))}
        </div>

        <div className="controls">
          {isFoulMode ? (
            <div className="foul-mode-controls">
              <p className="foul-prompt">Select foul value:</p>
              <div className="foul-ball-buttons">
                {FOUL_BALLS.map(ball => (
                  <button key={ball.color + ball.value} className="btn btn-ball btn-foul" data-color={ball.color} onClick={() => handleFoul(ball.value)}>
                    {ball.emoji} -{ball.value}
                  </button>
                ))}
              </div>
              <button className="btn btn-action" onClick={() => setIsFoulMode(false)}>Cancel</button>
            </div>
          ) : (
            <>
              <div className="ball-buttons">
                {BALLS.map(ball => (
                  <button key={ball.color} className="btn btn-ball" data-color={ball.color} onClick={(e) => handlePot(ball.value, e)}>
                    {ball.emoji} {ball.value}
                  </button>
                ))}
              </div>
              <div className="action-buttons">
                <button className="btn btn-action foul" onClick={() => setIsFoulMode(true)}>Foul</button>
                <button className="btn btn-action" onClick={handleUndo} disabled={history.length === 0}>Undo</button>
                <button className="btn btn-action" onClick={handleNewGame}>New Game</button>
              </div>
              <div className="player-management">
                <button className="btn btn-action add-player-btn" onClick={handleAddPlayer} disabled={gameState.players.length >= 8}>+ Add Player</button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

const PlayerPanel = ({ player, isActive, onNameChange, onRemove, onPlayerSelect }: { player: Player; isActive: boolean; onNameChange: (id: number, newName: string) => void; onRemove: (id: number) => void; onPlayerSelect: (id: number) => void; }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(player.name);

  useEffect(() => {
    setName(player.name);
  }, [player.name]);

  const handleNameUpdate = () => {
    if (name.trim()) {
      onNameChange(player.id, name.trim());
    } else {
      setName(player.name);
    }
    setIsEditing(false);
  };

  const handleNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };
  
  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(player.id);
  };

  return (
    <div className={`player-panel ${isActive ? 'active' : ''}`} onClick={() => onPlayerSelect(player.id)}>
      <button className="remove-player" onClick={handleRemoveClick} aria-label={`Remove ${player.name}`}>×</button>
      {isEditing ? (
        <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameUpdate}
            onKeyDown={(e) => e.key === 'Enter' && handleNameUpdate()}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="player-name-input"
        />
      ) : (
        <div className="player-name" onClick={handleNameClick} title="Click to edit name">{player.name}</div>
      )}
      <div className="player-score" aria-live="polite">{player.score}</div>
      <div className="player-break">Break: {player.break}</div>
      <div className="player-frames">
        {player.rank ? `Rank: 🏆 ${player.rank}` : 'Rank: -'}
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);