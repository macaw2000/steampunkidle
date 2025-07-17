/**
 * Progress Animations Component
 * Provides visual feedback and animations for activity progress
 */

import React, { useEffect, useState, useRef } from 'react';
import { Character } from '../../types/character';
import { ActivityProgress } from '../../services/activityService';
import { ActivityService } from '../../services/activityService';
import './ProgressAnimations.css';

interface ProgressAnimationsProps {
  activityProgress: ActivityProgress | null;
  character: Character;
  isConnected: boolean;
}

interface AnimatedNumber {
  current: number;
  target: number;
  isAnimating: boolean;
}

const ProgressAnimations: React.FC<ProgressAnimationsProps> = ({
  activityProgress,
  character,
  isConnected
}) => {
  const [animatedExperience, setAnimatedExperience] = useState<AnimatedNumber>({
    current: character.experience,
    target: character.experience,
    isAnimating: false
  });
  
  const [animatedCurrency, setAnimatedCurrency] = useState<AnimatedNumber>({
    current: character.currency,
    target: character.currency,
    isAnimating: false
  });

  const [progressPulse, setProgressPulse] = useState(false);
  const [activityGlow, setActivityGlow] = useState(false);
  const [rewardBurst, setRewardBurst] = useState<string[]>([]);
  
  const progressBarRef = useRef<HTMLDivElement>(null);
  const experienceRef = useRef<HTMLDivElement>(null);
  const currencyRef = useRef<HTMLDivElement>(null);

  // Animate experience changes
  useEffect(() => {
    if (animatedExperience.target !== character.experience) {
      setAnimatedExperience(prev => ({
        ...prev,
        target: character.experience,
        isAnimating: true
      }));

      const startValue = animatedExperience.current;
      const endValue = character.experience;
      const duration = 1000; // 1 second animation
      const startTime = Date.now();

      const animateValue = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = Math.floor(startValue + (endValue - startValue) * easeOutQuart);
        
        setAnimatedExperience(prev => ({
          ...prev,
          current: currentValue,
          isAnimating: progress < 1
        }));

        if (progress < 1) {
          requestAnimationFrame(animateValue);
        }
      };

      requestAnimationFrame(animateValue);
    }
  }, [character.experience, animatedExperience.current, animatedExperience.target]);

  // Animate currency changes
  useEffect(() => {
    if (animatedCurrency.target !== character.currency) {
      setAnimatedCurrency(prev => ({
        ...prev,
        target: character.currency,
        isAnimating: true
      }));

      const startValue = animatedCurrency.current;
      const endValue = character.currency;
      const duration = 800;
      const startTime = Date.now();

      const animateValue = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = Math.floor(startValue + (endValue - startValue) * easeOutQuart);
        
        setAnimatedCurrency(prev => ({
          ...prev,
          current: currentValue,
          isAnimating: progress < 1
        }));

        if (progress < 1) {
          requestAnimationFrame(animateValue);
        }
      };

      requestAnimationFrame(animateValue);
    }
  }, [character.currency, animatedCurrency.current, animatedCurrency.target]);

  // Progress bar pulse effect
  useEffect(() => {
    if (!activityProgress) return;

    const interval = setInterval(() => {
      if (isConnected) {
        setProgressPulse(true);
        setTimeout(() => setProgressPulse(false), 500);
      }
    }, 3000); // Pulse every 3 seconds when connected

    return () => clearInterval(interval);
  }, [activityProgress, isConnected]);

  // Activity glow effect
  useEffect(() => {
    if (!activityProgress) return;

    const interval = setInterval(() => {
      if (isConnected && activityProgress.progressPercentage > 0) {
        setActivityGlow(true);
        setTimeout(() => setActivityGlow(false), 1000);
      }
    }, 5000); // Glow every 5 seconds

    return () => clearInterval(interval);
  }, [activityProgress, isConnected]);

  // Reward burst animation
  const triggerRewardBurst = (rewards: string[]) => {
    setRewardBurst(rewards);
    setTimeout(() => setRewardBurst([]), 2000);
  };

  // Trigger reward burst when rewards are gained
  useEffect(() => {
    if (activityProgress?.potentialRewards && activityProgress.potentialRewards.length > 0) {
      const rewardTexts = activityProgress.potentialRewards.map(reward => 
        `+${reward.amount} ${reward.type}`
      );
      
      // Only trigger if we have new rewards (this is a simplified check)
      if (Math.random() < 0.1) { // 10% chance to show burst for demo
        triggerRewardBurst(rewardTexts);
      }
    }
  }, [activityProgress?.potentialRewards]);

  if (!activityProgress) {
    return (
      <div className="progress-animations progress-animations--inactive">
        <div className="inactive-message">
          <div className="inactive-icon">⚡</div>
          <p>Select an activity to see live progress!</p>
        </div>
      </div>
    );
  }

  const activityInfo = ActivityService.getActivityDisplayInfo(activityProgress.activityType);
  const efficiency = ActivityService.calculateActivityEfficiency(character, activityProgress.activityType);

  return (
    <div className={`progress-animations ${isConnected ? 'progress-animations--connected' : 'progress-animations--offline'}`}>
      {/* Activity Header with Glow Effect */}
      <div className={`activity-header ${activityGlow ? 'activity-header--glowing' : ''}`}>
        <div className="activity-icon">{activityInfo.icon}</div>
        <div className="activity-info">
          <h3 className="activity-name">{activityInfo.name}</h3>
          <p className="activity-status">
            {isConnected ? 'Live Progress' : 'Offline Mode'}
          </p>
        </div>
        <div className="efficiency-indicator">
          <span className="efficiency-value">{(efficiency * 100).toFixed(0)}%</span>
          <span className="efficiency-label">Efficiency</span>
        </div>
      </div>

      {/* Animated Progress Bar */}
      <div className="progress-container">
        <div 
          ref={progressBarRef}
          className={`progress-bar ${progressPulse ? 'progress-bar--pulsing' : ''}`}
        >
          <div 
            className="progress-fill"
            style={{ 
              width: `${Math.min(activityProgress.progressPercentage, 100)}%`,
              transition: 'width 0.5s ease-out'
            }}
          >
            <div className="progress-shine" />
          </div>
          <div className="progress-text">
            {Math.floor(activityProgress.progressPercentage)}%
          </div>
        </div>
        
        {/* Progress Particles */}
        {isConnected && (
          <div className="progress-particles">
            {[...Array(5)].map((_, i) => (
              <div 
                key={i} 
                className="particle"
                style={{
                  animationDelay: `${i * 0.2}s`,
                  left: `${20 + i * 15}%`
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Animated Stats */}
      <div className="animated-stats">
        <div 
          ref={experienceRef}
          className={`stat-item ${animatedExperience.isAnimating ? 'stat-item--animating' : ''}`}
        >
          <span className="stat-icon">⭐</span>
          <span className="stat-value">{animatedExperience.current.toLocaleString()}</span>
          <span className="stat-label">Experience</span>
        </div>
        
        <div 
          ref={currencyRef}
          className={`stat-item ${animatedCurrency.isAnimating ? 'stat-item--animating' : ''}`}
        >
          <span className="stat-icon">💰</span>
          <span className="stat-value">{animatedCurrency.current.toLocaleString()}</span>
          <span className="stat-label">Steam Coins</span>
        </div>

        <div className="stat-item">
          <span className="stat-icon">⏱️</span>
          <span className="stat-value">
            {ActivityService.formatActivityDuration(activityProgress.minutesActive)}
          </span>
          <span className="stat-label">Active Time</span>
        </div>
      </div>

      {/* Reward Burst Animation */}
      {rewardBurst.length > 0 && (
        <div className="reward-burst">
          {rewardBurst.map((reward, index) => (
            <div 
              key={index}
              className="reward-burst-item"
              style={{
                animationDelay: `${index * 0.1}s`,
                left: `${30 + index * 10}%`
              }}
            >
              {reward}
            </div>
          ))}
        </div>
      )}

      {/* Connection Status Indicator */}
      <div className={`connection-pulse ${isConnected ? 'connection-pulse--connected' : 'connection-pulse--disconnected'}`}>
        <div className="pulse-dot" />
      </div>

      {/* Milestone Indicator */}
      {activityProgress && (
        <div className="milestone-indicator">
          {(() => {
            const milestone = ActivityService.calculateNextRewardMilestone(activityProgress);
            return milestone.timeRemaining > 0 ? (
              <div className="milestone-countdown">
                <span className="milestone-label">Next Reward:</span>
                <span className="milestone-time">{milestone.timeRemaining}m</span>
              </div>
            ) : (
              <div className="milestone-ready">
                <span className="milestone-ready-icon">🎁</span>
                <span className="milestone-ready-text">Reward Ready!</span>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default ProgressAnimations;