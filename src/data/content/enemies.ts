/**
 * Starter enemies (per D11).
 *
 * 3 regular enemies with escalating stats + 1 boss enemy.
 * Tunable starting values; exact balance pass is scheduled for M1-15.
 */
import type { EnemyDef } from '../schemas.js';

export const starterEnemies: EnemyDef[] = [
  {
    id: 'slime',
    name: 'Forest Slime',
    maxHp: 25,
    damage: 2,           // M1-15: reduced from 3 to reduce early deaths
    attackInterval: 2.0,
    xpReward: 7,         // M1-15: reduced from 10
    isBoss: false,
    onHitEffects: [],
  },
  {
    id: 'goblin',
    name: 'Goblin Scout',
    maxHp: 45,
    damage: 4,           // M1-15: reduced from 6
    attackInterval: 1.5,
    xpReward: 12,        // M1-15: reduced from 18
    isBoss: false,
    onHitEffects: [],
  },
  {
    id: 'wolf',
    name: 'Dire Wolf',
    maxHp: 75,
    damage: 7,           // M1-15: reduced from 10
    attackInterval: 1.2,
    xpReward: 20,        // M1-15: reduced from 30
    isBoss: false,
    onHitEffects: [],
  },
  {
    id: 'goblin-chief',
    name: 'Goblin Chief',
    maxHp: 400,          // M1-15: increased from 200 to make boss harder at level 5
    damage: 10,          // M1-15: reduced from 15
    attackInterval: 2.5,
    xpReward: 70,        // M1-15: reduced from 100
    isBoss: true,
    onHitEffects: ['stun'],
  },
];
