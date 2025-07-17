/**
 * Harvesting Interface Component - Simple interface for harvesting activities
 */

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { HarvestingNode, HarvestingArea, HarvestingSkillType } from '../../types/harvesting';
import { HarvestingService } from '../../services/harvestingService';
import { HARVESTING_AREAS } from '../../data/harvestingData';

const HarvestingInterface: React.FC = () => {
  const { character } = useSelector((state: RootState) => state.game);
  const [availableAreas, setAvailableAreas] = useState<HarvestingArea[]>([]);
  const [selectedArea, setSelectedArea] = useState<HarvestingArea | null>(null);
  const [availableNodes, setAvailableNodes] = useState<HarvestingNode[]>([]);

  useEffect(() => {
    if (character) {
      const areas = HarvestingService.getAvailableAreas(character);
      setAvailableAreas(areas);
      
      const nodes = HarvestingService.getAvailableNodes(character);
      setAvailableNodes(nodes);
      
      if (areas.length > 0 && !selectedArea) {
        setSelectedArea(areas[0]);
      }
    }
  }, [character, selectedArea]);

  const getSkillLevel = (skillType: HarvestingSkillType): number => {
    if (!character) return 0;
    // For now, map harvesting skills to general skill levels
    // This is a temporary solution until we have proper harvesting skill tracking
    switch (skillType) {
      case 'mining':
        return character.stats.harvestingSkills.level || 1;
      case 'foraging':
        return character.stats.harvestingSkills.level || 1;
      case 'salvaging':
        return character.stats.harvestingSkills.level || 1;
      case 'crystal_extraction':
        return character.stats.harvestingSkills.level || 1;
      default:
        return 1;
    }
  };

  const canHarvestNode = (node: HarvestingNode): boolean => {
    if (!character) return false;
    return getSkillLevel(node.requiredSkill) >= node.requiredLevel;
  };

  if (!character) {
    return (
      <div className="harvesting-interface">
        <div className="harvesting-interface__loading">
          Loading character data...
        </div>
      </div>
    );
  }

  return (
    <div className="harvesting-interface">
      <div className="harvesting-interface__header">
        <h2>Resource Harvesting</h2>
        <p>Gather valuable materials from the steam-powered world</p>
      </div>

      <div className="harvesting-interface__skills">
        <h3>Harvesting Skills</h3>
        <div className="harvesting-skills-grid">
          {(['mining', 'foraging', 'salvaging', 'crystal_extraction'] as const).map(skillType => {
            const skillInfo = HarvestingService.getSkillDisplay(skillType);
            const skillLevel = getSkillLevel(skillType);
            const skillExp = character.stats.harvestingSkills.experience || 0;

            return (
              <div key={skillType} className="harvesting-skill">
                <div className="harvesting-skill__header">
                  <span className="harvesting-skill__icon">{skillInfo.icon}</span>
                  <div className="harvesting-skill__info">
                    <h4>{skillInfo.name}</h4>
                    <span>Level {skillLevel}</span>
                  </div>
                </div>
                <p className="harvesting-skill__description">{skillInfo.description}</p>
                <div className="harvesting-skill__experience">
                  Experience: {skillExp}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="harvesting-interface__areas">
        <h3>Harvesting Areas</h3>
        <div className="harvesting-areas-list">
          {availableAreas.map(area => (
            <div 
              key={area.areaId} 
              className={`harvesting-area ${selectedArea?.areaId === area.areaId ? 'harvesting-area--selected' : ''}`}
              onClick={() => setSelectedArea(area)}
            >
              <h4>{area.name}</h4>
              <p>{area.description}</p>
              <div className="harvesting-area__info">
                <span>Required Level: {area.requiredLevel}</span>
                <span>Nodes: {area.nodes.length}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedArea && (
        <div className="harvesting-interface__nodes">
          <h3>Available Nodes in {selectedArea.name}</h3>
          <div className="harvesting-nodes-grid">
            {selectedArea.nodes.map(node => {
              const canHarvest = canHarvestNode(node);
              const skillInfo = HarvestingService.getSkillDisplay(node.requiredSkill);
              const harvestTime = HarvestingService.calculateHarvestingTime(
                node.harvestTime,
                getSkillLevel(node.requiredSkill),
                node.requiredLevel
              );

              return (
                <div 
                  key={node.nodeId} 
                  className={`harvesting-node ${canHarvest ? 'harvesting-node--available' : 'harvesting-node--locked'}`}
                >
                  <div className="harvesting-node__header">
                    <h4>{node.name}</h4>
                    <div className="harvesting-node__skill">
                      <span>{skillInfo.icon}</span>
                      <span>Lv.{node.requiredLevel}</span>
                    </div>
                  </div>
                  
                  <p className="harvesting-node__description">{node.description}</p>
                  <p className="harvesting-node__flavor">{node.steampunkTheme.flavorText}</p>
                  
                  <div className="harvesting-node__details">
                    <div className="harvesting-node__time">
                      <span>Harvest Time:</span>
                      <span>{HarvestingService.formatHarvestingTime(harvestTime)}</span>
                    </div>
                    <div className="harvesting-node__respawn">
                      <span>Respawn:</span>
                      <span>{HarvestingService.formatHarvestingTime(node.respawnTime)}</span>
                    </div>
                  </div>

                  <div className="harvesting-node__resources">
                    <h5>Potential Resources:</h5>
                    <ul>
                      {node.resources.map((resource, index) => (
                        <li key={index}>
                          <span>{resource.name}</span>
                          <span>x{resource.quantity}</span>
                          <span>({Math.floor(resource.dropChance * 100)}%)</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="harvesting-node__actions">
                    {canHarvest ? (
                      <button 
                        className="harvesting-node__harvest-button"
                        onClick={() => alert(`Starting to harvest ${node.name}...`)}
                      >
                        Start Harvesting
                      </button>
                    ) : (
                      <div className="harvesting-node__locked">
                        <span>Requires {skillInfo.name} Level {node.requiredLevel}</span>
                        <span>(Current: {getSkillLevel(node.requiredSkill)})</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default HarvestingInterface;