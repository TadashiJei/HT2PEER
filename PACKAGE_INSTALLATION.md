# HT2Peer WebRTC Multiplayer Package

## Installation Guide

### Method 1: Using Unity Package Manager (Recommended)
1. Open Unity Package Manager (Window > Package Manager)
2. Click the '+' button in the top-left corner
3. Select "Add package from git URL..."
4. Enter the package URL: `https://github.com/tadashijei/ht2peer.git`
5. Click 'Add'

### Method 2: Manual Installation
1. Download the latest release from the GitHub repository
2. Extract the package into your Unity project's `Packages` folder
3. Unity will automatically detect and import the package

## Quick Start

### 1. Basic Setup
```csharp
// Add to any scene you want to use multiplayer
using HT2Peer;

public class GameManager : MonoBehaviour
{
    private void Start()
    {
        // Initialize the networking system
        HT2PeerNetwork.Initialize();
    }
}
```

### 2. Create or Join Room
```csharp
// Create a room
await HT2PeerNetwork.CreateRoom("MyRoom");

// Or join an existing room
await HT2PeerNetwork.JoinRoom("MyRoom");
```

### 3. Sync Objects
```csharp
// Add to any object you want to sync
[RequireComponent(typeof(HT2PeerView))]
public class PlayerController : MonoBehaviour
{
    private HT2PeerView networkView;

    private void Start()
    {
        networkView = GetComponent<HT2PeerView>();
    }
}
```

## Package Contents

### Core Components
- `HT2PeerNetwork`: Main networking manager
- `HT2PeerView`: Component for network object synchronization
- `HT2PeerTransform`: Component for transform synchronization
- `HT2PeerRoom`: Room management system

### Sample Scenes
1. Basic Example
   - Simple P2P connection demo
   - Basic object synchronization

2. Room Management Example
   - Room creation/joining
   - Player management
   - Chat system

## Configuration

### WebRTC Settings
```csharp
HT2PeerSettings settings = new HT2PeerSettings
{
    IceServers = new[]
    {
        "stun:stun.l.google.com:19302"
    },
    MaxPlayers = 8,
    UpdateRate = 60
};

HT2PeerNetwork.Initialize(settings);
```

### Network View Settings
```csharp
HT2PeerView networkView = gameObject.AddComponent<HT2PeerView>();
networkView.SyncInterval = 0.1f; // 10 times per second
networkView.InterpolatePosition = true;
networkView.InterpolateRotation = true;
```

## Best Practices

1. Object Synchronization
   - Use `HT2PeerView` for network objects
   - Set appropriate sync intervals
   - Use state compression when possible

2. Room Management
   - Handle disconnections gracefully
   - Implement proper cleanup
   - Use room properties for game state

3. Performance
   - Use appropriate update rates
   - Implement interest management
   - Enable compression for large states

## Support

- Documentation: [Full Documentation](docs/README.md)
- Issues: [GitHub Issues](https://github.com/yourusername/ht2peer/issues)
- Discord: [Join Our Community](https://discord.gg/ht2peer)

## Updates

To update the package:
1. Package Manager: Click 'Update'
2. Manual: Download and replace with newer version

## Requirements
- Unity 2020.3 or later
- Unity WebRTC Package 2.4.0 or later
