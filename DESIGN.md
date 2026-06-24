# Bobiverse Strategy Game — Design Document

## Concept
Browser-based 4X-lite strategy game inspired by "We Are Legion (We Are Bob)" by Dennis E. Taylor.
The player is Bob-1: a human mind uploaded into a Von Neumann probe, responsible for expanding humanity's reach across the stars while managing crises back home.

## Tech Stack
- **Runtime**: Browser (HTML5)
- **Language**: Vanilla TypeScript compiled to JS (no framework overhead)
- **Rendering**: HTML5 Canvas 2D (no Phaser — simpler, smaller)
- **Build**: Vite
- **Styling**: Plain CSS

## Core Loop
1. **Mine** asteroid belts in your current system for metal/fuel
2. **Build** autofactories, drones, ships using 3D printers
3. **Replicate** — spend resources to create a new Bob copy
4. **Launch** the copy to an adjacent star system
5. **Manage** multiple systems simultaneously (tabbed view)
6. **Respond** to events: Earth crisis, Deltans, the Others

## Win / Lose Conditions
- **Win**: Establish at least 2 human colonies AND protect the Deltans long enough for them to reach Iron Age
- **Lose**: Earth's 15M survivors die (climate timer hits zero) OR the Others destroy Bob-Prime before replication

## Systems

### Star Map
- ~12 star systems arranged on a 2D map (Sol center, others at varying distances)
- Systems: Sol, Epsilon Eridani, Delta Eridani, Alpha Centauri A/B, Omicron2 Eridani, 82 Eridani, Epsilon Indi, Beta Hydri
- Each system has: resource nodes (asteroids), planet slots, events, hazard level
- Travel time = distance in light-years × travel ticks (no instant teleport)

### Resources (per system)
| Resource | Source | Used for |
|---|---|---|
| Metal | Asteroid mining | Ships, factories, probes |
| Energy | Reactor (free, limited) | Manufacturing rate |
| Data | Research / observation | Tech unlocks |
| Population | Earth only | Colony ships |

### Structures (buildable per system)
- **Autofactory** — multiplies manufacturing rate
- **Mine Drone** — increases metal income
- **SUDDAR Array** — reveals adjacent systems, detects ships
- **Buster** — weapons payload (vs gorilloids, later vs Others)
- **Colony Ship** — moves population off Earth (costs huge resources)

### Bob Replication
- Each new Bob is a copy but diverges slightly (personality trait assigned)
- Bobs in other systems operate semi-autonomously (player sets directives)
- Directives: Explore / Mine / Protect / Build / Colonise
- Bob can only be in one system at a time; new systems need a copy sent

### Tech Tree (simplified)
- Tier 1: Better mining, autofactory, basic drones
- Tier 2: SCUT comms (Bobs share research across light-years), SUDDAR
- Tier 3: SURGE drive upgrade (faster travel), colony ship
- Tier 4: Defensive busters, Medeiros detection
- Tier 5: Others counter-measures

### Events (scripted + random)
**Earth (Sol)**
- Climate degradation timer (150 turns to zero)
- UN factions arguing over colony ship seats
- VEHEMENT sabotage attempts
- FAITH ministry interference

**Delta Eridani**
- Deltans discovered (primitive humanoid species)
- Gorilloid attacks on Deltan settlements
- Deltan tech progression (Stone → Bronze → Iron)
- The Others first contact

**Other systems**
- Medeiros probe (hostile competing probe — attack or evade)
- Resource windfalls (rich asteroid belt)
- Habitable planet found (colony candidate)

### The Others (end-game)
- Detected first via SUDDAR anomaly
- Arrive in force after turn ~120
- Attack systems sequentially from outer rim inward
- Can be slowed with busters, deflected with SCUT comms (warn other Bobs)
- Cannot be fully defeated — goal is to survive and evacuate

## UI Layout
```
[STAR MAP]          [SYSTEM PANEL]
  · Sol ──────────  Name: Sol
  · Eps Eri         Resources: Metal 240 / Energy 100
  · Delta Eri       Structures: [Autofactory x2] [Mine x3]
  · Alpha Cen       Bob: Riker (directive: Build)
                    Turn: 47 / Earth timer: 103 turns left

[EVENT LOG]         [BUILD QUEUE]
 Turn 45: Deltans   [ ] Autofactory  (cost: 80 metal)
  attacked by       [ ] Mine Drone   (cost: 30 metal)
  gorilloids        [ ] Bob Copy     (cost: 200 metal)
 Turn 43: Colony    [BUILD]
  ship launched
```

## Tick / Turn Structure
- Turn-based, player clicks "End Turn"
- Each turn: income collected → structures built → events fire → Bob actions resolve
- Earth climate timer decrements each turn

## Bob Names (in order of replication)
Bob-1 (player), Riker, Bill, Milo, Calvin, Linus, Homer, Mario, Khan, Howard

## Key Design Principles
- No micromanagement hell — Bobs on directive run themselves
- Tension comes from Earth timer + Others arrival, not unit spam
- Choices matter: spend resources colonising vs researching vs protecting Deltans
- Tone: nerdy, optimistic, occasional humour (Bob's voice)
