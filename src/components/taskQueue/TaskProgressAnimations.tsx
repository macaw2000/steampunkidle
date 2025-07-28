/**
 * Task Progress Animations Component
 * Visual feedback for continuous task processing with Steampunk theming
 */

import React, { useEffect, useState } from 'react';
import { Task, TaskProgress, TaskType } from '../../types/taskQueue';
import './TaskProgressAnimations.css';

interface TaskProgressAnimationsProps {
  task: Task | null;
  progress: TaskProgress | null;
  className?: string;
  showParticles?: boolean;
  showGears?: boolean;
}

interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  type: 'spark' | 'steam' | 'gear' | 'crystal';
}

const TaskProgressAnimations: React.FC<TaskProgressAnimationsProps> = ({
  task,
  progress,
  className = '',
  showParticles = true,
  showGears = true
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [animationFrame, setAnimationFrame] = useState<number | null>(null);

  // Generate particles based on task type
  const generateParticles = (taskType: TaskType, count: number = 3): Particle[] => {
    const newParticles: Particle[] = [];
    
    for (let i = 0; i < count; i++) {
      const particle: Particle = {
        id: `${Date.now()}-${i}`,
        x: Math.random() * 300,
        y: Math.random() * 100 + 50,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        life: 0,
        maxLife: 60 + Math.random() * 60, // 1-2 seconds at 60fps
        type: getParticleType(taskType)
      };
      newParticles.push(particle);
    }
    
    return newParticles;
  };

  const getParticleType = (taskType: TaskType): Particle['type'] => {
    switch (taskType) {
      case TaskType.HARVESTING:
        return Math.random() > 0.5 ? 'spark' : 'crystal';
      case TaskType.CRAFTING:
        return Math.random() > 0.5 ? 'gear' : 'spark';
      case TaskType.COMBAT:
        return Math.random() > 0.5 ? 'spark' : 'steam';
      default:
        return 'spark';
    }
  };

  // Update particles animation
  const updateParticles = () => {
    setParticles(prevParticles => {
      const updatedParticles = prevParticles
        .map(particle => ({
          ...particle,
          x: particle.x + particle.vx,
          y: particle.y + particle.vy,
          life: particle.life + 1,
          vy: particle.vy + 0.05, // Gravity effect
        }))
        .filter(particle => particle.life < particle.maxLife);

      // Add new particles if task is active
      if (task && progress && progress.progress < 1 && showParticles) {
        const shouldAddParticle = Math.random() > 0.7; // 30% chance each frame
        if (shouldAddParticle) {
          updatedParticles.push(...generateParticles(task.type, 1));
        }
      }

      return updatedParticles;
    });
  };

  // Animation loop
  useEffect(() => {
    if (task && progress && progress.progress < 1) {
      const animate = () => {
        updateParticles();
        setAnimationFrame(requestAnimationFrame(animate));
      };
      setAnimationFrame(requestAnimationFrame(animate));
    } else {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        setAnimationFrame(null);
      }
      // Clear particles when task completes
      setParticles([]);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [task, progress]);

  // Get task-specific animation class
  const getTaskAnimationClass = (taskType: TaskType): string => {
    switch (taskType) {
      case TaskType.HARVESTING:
        return 'harvesting-animation';
      case TaskType.CRAFTING:
        return 'crafting-animation';
      case TaskType.COMBAT:
        return 'combat-animation';
      default:
        return 'default-animation';
    }
  };

  // Get progress color based on task type
  const getProgressColor = (taskType: TaskType): string => {
    switch (taskType) {
      case TaskType.HARVESTING:
        return '#32cd32'; // Green
      case TaskType.CRAFTING:
        return '#ffd700'; // Gold
      case TaskType.COMBAT:
        return '#ff6347'; // Red
      default:
        return '#87ceeb'; // Sky blue
    }
  };

  // Get particle emoji based on type
  const getParticleEmoji = (type: Particle['type']): string => {
    switch (type) {
      case 'spark':
        return '✨';
      case 'steam':
        return '💨';
      case 'gear':
        return '⚙️';
      case 'crystal':
        return '💎';
      default:
        return '✨';
    }
  };

  if (!task || !progress) {
    return null;
  }

  const progressPercentage = Math.min(100, progress.progress * 100);
  const taskAnimationClass = getTaskAnimationClass(task.type);
  const progressColor = getProgressColor(task.type);

  return (
    <div className={`task-progress-animations ${taskAnimationClass} ${className}`}>
      {/* Main progress container */}
      <div className="progress-container">
        {/* Animated background based on task type */}
        <div className="progress-background">
          {task.type === TaskType.HARVESTING && (
            <div className="mining-background">
              <div className="rock-layer"></div>
              <div className="ore-veins"></div>
            </div>
          )}
          
          {task.type === TaskType.CRAFTING && (
            <div className="workshop-background">
              <div className="workbench"></div>
              {showGears && (
                <div className="gear-system">
                  <div className="gear gear-large rotating"></div>
                  <div className="gear gear-medium rotating-reverse"></div>
                  <div className="gear gear-small rotating"></div>
                </div>
              )}
            </div>
          )}
          
          {task.type === TaskType.COMBAT && (
            <div className="combat-background">
              <div className="battlefield"></div>
              <div className="energy-field pulsing"></div>
            </div>
          )}
        </div>

        {/* Progress bar with custom styling */}
        <div className="enhanced-progress-bar">
          <div className="progress-track">
            <div 
              className="progress-fill"
              style={{ 
                width: `${progressPercentage}%`,
                background: `linear-gradient(90deg, ${progressColor}aa 0%, ${progressColor} 50%, ${progressColor}dd 100%)`
              }}
            >
              <div className="progress-shine"></div>
            </div>
          </div>
          
          {/* Progress indicators */}
          <div className="progress-markers">
            {[25, 50, 75].map(marker => (
              <div 
                key={marker}
                className={`progress-marker ${progressPercentage >= marker ? 'completed' : ''}`}
                style={{ left: `${marker}%` }}
              >
                <div className="marker-dot"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Task-specific visual elements */}
        <div className="task-visual-elements">
          {task.type === TaskType.HARVESTING && (
            <div className="harvesting-tools">
              <div className="pickaxe swinging">⛏️</div>
              <div className="ore-chunks">
                <span className="ore-chunk">🪨</span>
                <span className="ore-chunk">💎</span>
              </div>
            </div>
          )}
          
          {task.type === TaskType.CRAFTING && (
            <div className="crafting-tools">
              <div className="hammer hammering">🔨</div>
              <div className="anvil">🪨</div>
              <div className="sparks">
                <span className="spark">✨</span>
                <span className="spark">✨</span>
                <span className="spark">✨</span>
              </div>
            </div>
          )}
          
          {task.type === TaskType.COMBAT && (
            <div className="combat-effects">
              <div className="weapon slashing">⚔️</div>
              <div className="impact-effects">
                <span className="impact">💥</span>
                <span className="impact">⚡</span>
              </div>
            </div>
          )}
        </div>

        {/* Particle system */}
        {showParticles && (
          <div className="particle-system">
            {particles.map(particle => (
              <div
                key={particle.id}
                className={`particle particle-${particle.type}`}
                style={{
                  left: `${particle.x}px`,
                  top: `${particle.y}px`,
                  opacity: 1 - (particle.life / particle.maxLife),
                  transform: `scale(${1 - (particle.life / particle.maxLife) * 0.5})`
                }}
              >
                {getParticleEmoji(particle.type)}
              </div>
            ))}
          </div>
        )}

        {/* Progress text overlay */}
        <div className="progress-text-overlay">
          <div className="progress-percentage">
            {Math.round(progressPercentage)}%
          </div>
          <div className="progress-status">
            {progress.isComplete ? 'Completing...' : 'In Progress'}
          </div>
        </div>
      </div>

      {/* Completion celebration */}
      {progress.isComplete && (
        <div className="completion-celebration">
          <div className="celebration-burst">
            <span className="celebration-particle">🎉</span>
            <span className="celebration-particle">✨</span>
            <span className="celebration-particle">🎊</span>
            <span className="celebration-particle">⭐</span>
          </div>
          <div className="completion-text">Task Complete!</div>
        </div>
      )}
    </div>
  );
};

export default TaskProgressAnimations;