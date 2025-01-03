# Architecture Overview

## System Architecture

### Core Components
1. **WebRTC Network Manager**
   - Handles peer connections
   - Manages data channels
   - Processes connection states
   - Integrates with STUN/TURN servers

2. **Room Management System**
   - Room lifecycle management
   - Player session handling
   - Room state synchronization
   - Room discovery services

3. **State Synchronization System**
   - Delta compression
   - State snapshots
   - Interpolation
   - Authority management

4. **Player Management System**
   - Player authentication
   - State tracking
   - Spawn/despawn handling
   - Input processing

5. **Host Migration Controller**
   - Authority transfer
   - State preservation
   - Host selection
   - Recovery mechanisms

6. **Lag Compensation System**
   - Client-side prediction
   - Server reconciliation
   - Input buffering
   - Rollback mechanisms

## Data Flow
```
[Client] <-> [WebRTC] <-> [Host/Server]
     ↓          ↓            ↓
[Input] -> [Prediction] -> [Validation]
     ↓          ↓            ↓
[Render] <- [Interpolation] <- [State Update]
```

## Network Protocol
- Reliable channel: Critical game state, player events
- Unreliable channel: Position updates, non-critical data
- Custom serialization for optimal performance

## State Management
- Hierarchical state system
- Authority-based validation
- Delta compression
- Snapshot interpolation
