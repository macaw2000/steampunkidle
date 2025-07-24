import React, { useState, useEffect } from 'react';
import { TaskQueue, Task, TaskQueueStats } from '../../types/taskQueue';
import { TaskQueueAdminService } from '../../services/taskQueueAdminService';
import './TaskQueueAdminInterface.css';

interface TaskQueueAdminInterfaceProps {
  adminService: TaskQueueAdminService;
}

interface PlayerQueueInfo {
  playerId: string;
  playerName: string;
  queue: TaskQueue;
  stats: TaskQueueStats;
  lastActivity: number;
}

export const TaskQueueAdminInterface: React.FC<TaskQueueAdminInterfaceProps> = ({
  adminService
}) => {
  const [playerQueues, setPlayerQueues] = useState<PlayerQueueInfo[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interventionLog, setInterventionLog] = useState<string[]>([]);

  useEffect(() => {
    loadPlayerQueues();
    const interval = setInterval(loadPlayerQueues, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadPlayerQueues = async () => {
    try {
      setLoading(true);
      const queues = await adminService.getAllPlayerQueues();
      setPlayerQueues(queues);
      setError(null);
    } catch (err) {
      setError(`Failed to load player queues: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePauseQueue = async (playerId: string) => {
    try {
      await adminService.pausePlayerQueue(playerId, 'Admin intervention');
      logIntervention(`Paused queue for player ${playerId}`);
      await loadPlayerQueues();
    } catch (err) {
      setError(`Failed to pause queue: ${err}`);
    }
  };

  const handleResumeQueue = async (playerId: string) => {
    try {
      await adminService.resumePlayerQueue(playerId);
      logIntervention(`Resumed queue for player ${playerId}`);
      await loadPlayerQueues();
    } catch (err) {
      setError(`Failed to resume queue: ${err}`);
    }
  };

  const handleClearQueue = async (playerId: string) => {
    if (!window.confirm(`Are you sure you want to clear the queue for player ${playerId}?`)) {
      return;
    }
    
    try {
      await adminService.clearPlayerQueue(playerId);
      logIntervention(`Cleared queue for player ${playerId}`);
      await loadPlayerQueues();
    } catch (err) {
      setError(`Failed to clear queue: ${err}`);
    }
  };

  const handleForceCompleteTask = async (playerId: string, taskId: string) => {
    if (!window.confirm(`Force complete task ${taskId} for player ${playerId}?`)) {
      return;
    }

    try {
      await adminService.forceCompleteTask(playerId, taskId);
      logIntervention(`Force completed task ${taskId} for player ${playerId}`);
      await loadPlayerQueues();
    } catch (err) {
      setError(`Failed to force complete task: ${err}`);
    }
  };

  const handleRemoveTask = async (playerId: string, taskId: string) => {
    if (!window.confirm(`Remove task ${taskId} from player ${playerId}'s queue?`)) {
      return;
    }

    try {
      await adminService.removeTaskFromQueue(playerId, taskId);
      logIntervention(`Removed task ${taskId} from player ${playerId}'s queue`);
      await loadPlayerQueues();
    } catch (err) {
      setError(`Failed to remove task: ${err}`);
    }
  };

  const logIntervention = (message: string) => {
    const timestamp = new Date().toISOString();
    setInterventionLog(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 99)]);
  };

  const filteredQueues = playerQueues.filter(queue =>
    queue.playerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    queue.playerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedQueue = selectedPlayer ? 
    playerQueues.find(q => q.playerId === selectedPlayer) : null;

  return (
    <div className="task-queue-admin-interface">
      <div className="admin-header">
        <h2>Task Queue Administration</h2>
        <div className="admin-controls">
          <input
            type="text"
            placeholder="Search players..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button onClick={loadPlayerQueues} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="admin-content">
        <div className="player-list">
          <h3>Active Players ({filteredQueues.length})</h3>
          <div className="player-queue-list">
            {filteredQueues.map(queue => (
              <div
                key={queue.playerId}
                className={`player-queue-item ${selectedPlayer === queue.playerId ? 'selected' : ''}`}
                onClick={() => setSelectedPlayer(queue.playerId)}
              >
                <div className="player-info">
                  <strong>{queue.playerName}</strong>
                  <span className="player-id">{queue.playerId}</span>
                </div>
                <div className="queue-status">
                  <span className={`status ${queue.queue.isRunning ? 'running' : 'paused'}`}>
                    {queue.queue.isRunning ? 'Running' : 'Paused'}
                  </span>
                  <span className="task-count">
                    {queue.queue.queuedTasks.length} tasks
                  </span>
                </div>
                <div className="queue-actions">
                  {queue.queue.isRunning ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePauseQueue(queue.playerId);
                      }}
                      className="pause-btn"
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResumeQueue(queue.playerId);
                      }}
                      className="resume-btn"
                    >
                      Resume
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearQueue(queue.playerId);
                    }}
                    className="clear-btn"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="queue-details">
          {selectedQueue ? (
            <div className="selected-queue">
              <h3>Queue Details - {selectedQueue.playerName}</h3>
              
              <div className="queue-stats">
                <div className="stat">
                  <label>Status:</label>
                  <span className={selectedQueue.queue.isRunning ? 'running' : 'paused'}>
                    {selectedQueue.queue.isRunning ? 'Running' : 'Paused'}
                  </span>
                </div>
                <div className="stat">
                  <label>Current Task:</label>
                  <span>{selectedQueue.queue.currentTask?.name || 'None'}</span>
                </div>
                <div className="stat">
                  <label>Queued Tasks:</label>
                  <span>{selectedQueue.queue.queuedTasks.length}</span>
                </div>
                <div className="stat">
                  <label>Total Completed:</label>
                  <span>{selectedQueue.stats.completedTasks}</span>
                </div>
                <div className="stat">
                  <label>Last Activity:</label>
                  <span>{new Date(selectedQueue.lastActivity).toLocaleString()}</span>
                </div>
              </div>

              {selectedQueue.queue.currentTask && (
                <div className="current-task">
                  <h4>Current Task</h4>
                  <div className="task-item">
                    <div className="task-info">
                      <strong>{selectedQueue.queue.currentTask.name}</strong>
                      <span>Progress: {Math.round(selectedQueue.queue.currentTask.progress * 100)}%</span>
                    </div>
                    <div className="task-actions">
                      <button
                        onClick={() => handleForceCompleteTask(
                          selectedQueue.playerId,
                          selectedQueue.queue.currentTask!.id
                        )}
                        className="force-complete-btn"
                      >
                        Force Complete
                      </button>
                      <button
                        onClick={() => handleRemoveTask(
                          selectedQueue.playerId,
                          selectedQueue.queue.currentTask!.id
                        )}
                        className="remove-task-btn"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="queued-tasks">
                <h4>Queued Tasks ({selectedQueue.queue.queuedTasks.length})</h4>
                <div className="task-list">
                  {selectedQueue.queue.queuedTasks.map((task, index) => (
                    <div key={task.id} className="task-item">
                      <div className="task-info">
                        <span className="task-position">#{index + 1}</span>
                        <strong>{task.name}</strong>
                        <span className="task-type">{task.type}</span>
                        <span className="task-duration">
                          {Math.round(task.duration / 1000)}s
                        </span>
                      </div>
                      <div className="task-actions">
                        <button
                          onClick={() => handleRemoveTask(selectedQueue.playerId, task.id)}
                          className="remove-task-btn"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <p>Select a player to view queue details</p>
            </div>
          )}
        </div>
      </div>

      <div className="intervention-log">
        <h3>Intervention Log</h3>
        <div className="log-entries">
          {interventionLog.map((entry, index) => (
            <div key={index} className="log-entry">
              {entry}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};