
# Combat Progression Design Notes

**Development Stage:** Very Early Development  
**Status:** Proposed Design  
**Related Playtest:** `docs/playtest.md`

## 1. Design Goals

The combat progression system should make character growth meaningful, provide reasons to grind, and make boss encounters a meaningful progression checkpoint.

The intended gameplay loop is:

1. Fight regular waves.
2. Gain experience and collect available rewards.
3. Grind additional waves when the character is underpowered.
4. Improve the character through available progression systems.
5. Choose when to challenge the boss.
6. Defeat the boss to unlock further progression.

Regular waves provide repeatable combat and resource acquisition, while bosses test whether the player is sufficiently prepared to advance.

## 2. Wave and Boss Progression

### 2.1 Regular Waves

**Proposal:**

- Regular waves should be repeatable and grindable.
- Players should be able to replay waves to gain experience and, when implemented, collect resources.
- Some waves should feature multiple monsters simultaneously.
- Wave compositions should provide variety rather than relying exclusively on increasing enemy statistics.

Regular waves should provide a reliable recovery path for players who are not yet strong enough to defeat the boss.

### 2.2 Challenge Boss

**Proposal:**

Introduce a `Challenge Boss` button that allows players to initiate the boss encounter manually.

- Clearing regular waves should not automatically force the player into a boss fight.
- Players should be able to continue grinding before challenging the boss.
- Defeating the boss should be the primary requirement for clearing the stage and progressing.
- Bosses should have skills and combat mechanics that distinguish them from regular wave monsters.

**Design Rationale:**

Manual boss challenges give players control over when they accept a difficult encounter. This creates a meaningful decision between continuing to grind and attempting to progress.

It also provides a recovery path for underpowered players, provided regular waves remain accessible and repeatable.

### 2.3 Boss Difficulty

Boss encounters should be the primary difficulty checkpoint within a stage.

Bosses should challenge players through their skills and combat mechanics, not merely through larger HP and Attack values.

Difficulty should encourage players to improve their characters and prepare before attempting the encounter.

## 3. Proposed Progression Structure

| Level Range | Intended Progression |
|---|---|
| 1–10 | Easy leveling and introduction to basic combat. |
| 10–20 | Introduce other gameplay mechanics while keeping stage progression relatively forgiving. |
| 20–50 | Encourage engagement with additional progression systems, such as equipment, crafting, and resource collection. |
| 50–100 | Require longer-term investment in character stats and multiple progression systems. |

### 3.1 Levels 1–10: Basic Combat

Leveling should be easy. Players should learn the basic combat loop and experience frequent progression without excessive grinding.

### 3.2 Levels 10–20: Introduction to Other Mechanics

Introduce additional gameplay systems gradually.

Players should begin learning how these systems work while still being able to clear stages without fully understanding or optimizing every mechanic.

### 3.3 Levels 20–50: Broader Character Development

Progression should increasingly reward engagement with systems beyond repetitive combat.

Equipment, crafting, materials, and stat enhancement may become more important as the player advances.

### 3.4 Levels 50–100: Long-Term Investment

Character advancement should require more time and deliberate investment across multiple progression systems.

**Design Principle:**

Character levels provide a foundation for strength, while other gameplay systems provide additional ways to improve that strength.

**Status:** Proposed progression outline. Exact experience curves, costs, and difficulty scaling remain undefined.

## 4. Level-Up Stat Growth

### 4.1 Proposed Level-Up Bonuses

Leveling up should directly increase only:

- HP
- Attack

Leveling up should not directly increase:

- Critical Rate
- Attack Speed

### 4.2 Design Rationale

Restricting direct level-up bonuses to HP and Attack gives leveling a predictable purpose.

Critical Rate and Attack Speed can instead be developed through other progression systems, such as equipment or future stat-enhancement mechanics.

### 4.3 Implementation Check

Inspect the character configuration and stat-growth logic to determine whether Critical Rate and Attack Speed currently scale with character level.

If they do, adjust their growth rates so they no longer increase directly through leveling.

Verify the change through testing rather than assuming that changing the configuration alone is sufficient.

## 5. Wave Count and Scaling

### 5.1 Proposed Minimum Wave Count

A stage should contain at least 50 waves as a potential long-term grinding structure.

However, the wave count should not be justified solely by potion usage. Since HP resets between waves, potions may have limited value during ordinary encounters.

The purpose of repeatable waves should primarily be to provide a grinding and resource-acquisition loop.

### 5.2 Wave Templates

**Reviewer Recommendation:**

Avoid manually designing 50 unique waves.

Instead, define a small set of approximately 3–5 wave templates and reuse them with scaling.

Potential variations include:

- Different numbers of monsters.
- Different monster combinations.
- Increasing enemy statistics as the wave number rises.
- Occasional stronger or more demanding wave compositions.

The wave system should provide variety without requiring excessive amounts of manually authored content.

### 5.3 Open Questions

- Does wave progression continue indefinitely, or is there a defined endpoint?
- Does enemy scaling increase linearly, exponentially, or through predefined difficulty milestones?
- Are all waves equally grindable, or should certain waves be more efficient for specific rewards?
- Can players replay earlier waves directly, or must they progress through the sequence again?

## 6. Death and Recovery

### 6.1 Experience Retention

Retaining earned experience after death is acceptable as an initial design direction.

However, death should have a meaningful consequence.

### 6.2 Proposed Consequence

A dead character should be unable to clear the next stage until the current challenge is overcome.

The exact death penalty remains undecided.

### 6.3 Recovery Through Grinding

Repeatable regular waves may provide a way for underpowered players to recover.

Players can continue improving their characters before attempting the boss again, rather than being permanently blocked by a failed attempt.

### 6.4 Open Questions

- Does death reset the current boss attempt?
- Are resources consumed during a failed boss fight?
- Can players return to earlier stages without losing access to their current stage?
- Is there any additional death penalty beyond failing the encounter?

## 7. Proposed Economy and Stat Enhancement

**Status: Deferred.** These systems are proposed concepts, not confirmed implementation requirements.

The economy should provide meaningful uses for resources and give players additional ways to strengthen their characters.

### 7.1 Resource Categories

Proposed resources:

- Coins
- Materials
- Equipment

Each resource should have a distinct role in character progression.

### 7.2 Special Stat-Enhancement Items

Coins could be used to purchase special items that improve selected stats.

| Stat | Intended Effect |
|---|---|
| Attack | Increases damage dealt. |
| HP | Increases survivability. |
| Mana | Increases available mana. |
| Critical Rate | Increases the chance of critical hits. |
| Resistance | Reduces applicable incoming damage or effects. |
| Attack Speed | Increases attack frequency. |

The acquisition method, costs, and permanence of these bonuses remain undecided.

### 7.3 Crafting and Consumables

Materials and coins could be used to craft consumable items, including combat potions.

Potential examples:

- HP Potion: Restores health.
- Mana Potion: Restores mana.
- Attack Potion: Temporarily increases Attack.
- Resistance Potion: Temporarily increases Resistance.
- Critical Potion: Temporarily increases Critical Rate.
- Attack Speed Potion: Temporarily increases Attack Speed.

Unlike equipment, consumables should provide temporary or limited-use benefits.

### 7.4 Potion Design Considerations

Since HP resets between waves, potion usage should be evaluated around encounters where consumables provide meaningful advantages.

Potential uses include:

- Difficult waves with multiple strong enemies.
- Boss encounters.
- Encounters where a temporary stat increase meaningfully improves the chance of success.

Potion availability, duration, costs, and usage limits should be defined only after the boss challenge loop has been tested.

### 7.5 Economy Scope

Coins, materials, equipment drops, stat-enhancement items, crafting, and potions collectively form an economy system.

These features should be deferred until the core wave-and-boss progression loop is implemented and evaluated.

The economy design should eventually define what each resource is used for, what progression it gates, and how its costs and rewards scale.

## 8. Core Design Principles

1. **Regular waves provide a recovery path.** Players should have a way to continue grinding when underpowered.
2. **Bosses gate progression.** Defeating the boss is the primary requirement for clearing a stage.
3. **Players choose when to challenge the boss.** The encounter should not be forced immediately after wave completion.
4. **Leveling has a defined purpose.** Direct level-up bonuses are limited to HP and Attack.
5. **Progression diversifies over time.** Other gameplay systems should become increasingly relevant at higher levels.
6. **Resources should have distinct purposes.** Future economy systems should give players meaningful choices.
7. **Difficulty should encourage preparation.** Players should have reasons to improve their characters before difficult encounters.

## 9. Implementation Priorities

### Priority 1: Challenge Boss Loop

Implement and test the manual boss challenge before expanding the economy.

Verify that:
- Players can grind regular waves.
- Players can choose when to challenge the boss.
- Boss defeat correctly clears the stage.
- Failed boss attempts allow players to return to grinding.

### Priority 2: Level-Up Stat Growth

Inspect the current stat-growth configuration.

Ensure that leveling directly increases HP and Attack without increasing Critical Rate or Attack Speed.

### Priority 3: Combat Difficulty Tuning

Tune early-stage difficulty after the Challenge Boss loop is functional.

The first goal is to make combat and boss encounters meaningfully challenging without making early progression unnecessarily frustrating.

### Priority 4: Economy Specification

Defer the implementation of coins, materials, equipment drops, stat-enhancement items, crafting, and potions.

Develop a dedicated economy specification after the core progression loop has been tested.

## 10. Deferred Decisions

The following remain open for future design work:

- Exact death penalties.
- Wave scaling formula.
- Boss difficulty and skill design.
- Resource drop rates.
- Equipment progression.
- Stat-enhancement costs and limits.
- Crafting recipes.
- Potion duration and usage restrictions.
- Economy progression and resource sinks.
