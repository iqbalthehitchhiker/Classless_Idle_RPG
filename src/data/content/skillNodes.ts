/**
 * Starter skill tree nodes (M2-01).
 * 
 * About 16 nodes across three branches:
 * - center: general passives (max HP, attack, crit chance)
 * - berserker: attack and crit damage bonuses, attack speed, Ignite capstone
 * - paladin: max HP percent bonuses and defensive bonuses
 * 
 * All stat numbers are PLACEHOLDER values.
 */
import type { SkillNodeDef } from '../schemas.js';

export const starterSkillNodes: SkillNodeDef[] = [
  // Center branch - general passives arranged as a connected group
  {
    id: 'center-root',
    name: 'Vitality',
    branch: 'center',
    cost: 1, // general passive
    prerequisites: [],
    requirements: [],
    pos: { x: 0, y: 0 },
    effects: [
      { kind: 'statBonus', stat: 'maxHp', mode: 'flat', value: 10 }, // PLACEHOLDER
    ],
  },
  {
    id: 'center-attack-1',
    name: 'Strength',
    branch: 'center',
    cost: 1,
    prerequisites: ['center-root'],
    requirements: [],
    pos: { x: 0, y: 1 },
    effects: [
      { kind: 'statBonus', stat: 'attack', mode: 'flat', value: 2 }, // PLACEHOLDER
    ],
  },
  {
    id: 'center-hp-2',
    name: 'Endurance',
    branch: 'center',
    cost: 1,
    prerequisites: ['center-attack-1'],
    requirements: [],
    pos: { x: 0, y: 2 },
    effects: [
      { kind: 'statBonus', stat: 'maxHp', mode: 'flat', value: 15 }, // PLACEHOLDER
    ],
  },
  {
    id: 'center-crit-1',
    name: 'Precision',
    branch: 'center',
    cost: 1,
    prerequisites: ['center-hp-2'],
    requirements: [],
    pos: { x: 0, y: 3 },
    effects: [
      { kind: 'statBonus', stat: 'critChance', mode: 'flat', value: 0.05 }, // PLACEHOLDER
    ],
  },
  {
    id: 'center-attack-2',
    name: 'Power',
    branch: 'center',
    cost: 1,
    prerequisites: ['center-crit-1'],
    requirements: [],
    pos: { x: 0, y: 4 },
    effects: [
      { kind: 'statBonus', stat: 'attack', mode: 'flat', value: 3 }, // PLACEHOLDER
    ],
  },
  {
    id: 'center-hp-3',
    name: 'Fortified',
    branch: 'center',
    cost: 1,
    prerequisites: ['center-attack-2'],
    requirements: [],
    pos: { x: 0, y: 5 },
    effects: [
      { kind: 'statBonus', stat: 'maxHp', mode: 'percent', value: 0.1 }, // PLACEHOLDER
    ],
  },

  // Berserker branch - attack and crit damage, attack speed
  {
    id: 'berserker-entry',
    name: 'Fury',
    branch: 'berserker',
    cost: 2, // branch node
    prerequisites: ['center-attack-2'],
    requirements: [],
    pos: { x: -2, y: 5 },
    effects: [
      { kind: 'statBonus', stat: 'attack', mode: 'percent', value: 0.08 }, // PLACEHOLDER
    ],
  },
  {
    id: 'berserker-crit-damage',
    name: 'Brutality',
    branch: 'berserker',
    cost: 2,
    prerequisites: ['berserker-entry'],
    requirements: [],
    pos: { x: -3, y: 6 },
    effects: [
      { kind: 'statBonus', stat: 'critDamage', mode: 'flat', value: 0.25 }, // PLACEHOLDER
    ],
  },
  {
    id: 'berserker-attack-speed',
    name: 'Frenzy',
    branch: 'berserker',
    cost: 2,
    prerequisites: ['berserker-crit-damage'],
    requirements: [{ kind: 'proficiency', disciplineId: 'swordsmanship', level: 3 }],
    pos: { x: -4, y: 7 },
    effects: [
      { kind: 'statBonus', stat: 'attackRate', mode: 'percent', value: 0.15 }, // PLACEHOLDER
    ],
  },
  {
    id: 'berserker-attack-2',
    name: 'Rage',
    branch: 'berserker',
    cost: 2,
    prerequisites: ['berserker-attack-speed'],
    requirements: [],
    pos: { x: -4, y: 8 },
    effects: [
      { kind: 'statBonus', stat: 'attack', mode: 'percent', value: 0.12 }, // PLACEHOLDER
    ],
  },
  {
    id: 'berserker-ignite',
    name: 'Ignite',
    branch: 'berserker',
    cost: 3, // capstone
    prerequisites: ['berserker-attack-2'],
    requirements: [],
    pos: { x: -4, y: 9 },
    effects: [
      { kind: 'grantOnHitEffect', effectId: 'burn' },
    ],
  },

  // Paladin branch - max HP percent and defensive bonuses
  {
    id: 'paladin-entry',
    name: 'Resolve',
    branch: 'paladin',
    cost: 2, // branch node
    prerequisites: ['center-hp-3'],
    requirements: [],
    pos: { x: 2, y: 6 },
    effects: [
      { kind: 'statBonus', stat: 'maxHp', mode: 'percent', value: 0.12 }, // PLACEHOLDER
    ],
  },
  {
    id: 'paladin-hp-2',
    name: 'Resilience',
    branch: 'paladin',
    cost: 2,
    prerequisites: ['paladin-entry'],
    requirements: [],
    pos: { x: 3, y: 7 },
    effects: [
      { kind: 'statBonus', stat: 'maxHp', mode: 'percent', value: 0.15 }, // PLACEHOLDER
    ],
  },
  {
    id: 'paladin-defense',
    name: 'Stalwart',
    branch: 'paladin',
    cost: 2,
    prerequisites: ['paladin-hp-2'],
    requirements: [{ kind: 'proficiency', disciplineId: 'fortitude', level: 3 }],
    pos: { x: 4, y: 8 },
    effects: [
      { kind: 'statBonus', stat: 'maxHp', mode: 'flat', value: 25 }, // PLACEHOLDER
    ],
  },
  {
    id: 'paladin-hp-3',
    name: 'Bastion',
    branch: 'paladin',
    cost: 2,
    prerequisites: ['paladin-defense'],
    requirements: [],
    pos: { x: 4, y: 9 },
    effects: [
      { kind: 'statBonus', stat: 'maxHp', mode: 'percent', value: 0.18 }, // PLACEHOLDER
    ],
  },
  {
    id: 'paladin-capstone',
    name: 'Aegis',
    branch: 'paladin',
    cost: 3, // capstone
    prerequisites: ['paladin-hp-3'],
    requirements: [],
    pos: { x: 4, y: 10 },
    effects: [
      { kind: 'statBonus', stat: 'maxHp', mode: 'percent', value: 0.25 }, // PLACEHOLDER
    ],
  },
];
