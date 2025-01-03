# Network Setup Guide

## WebRTC Configuration

### STUN/TURN Setup
```json
{
    "stunServers": [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302"
    ],
    "turnServers": [
        {
            "urls": "turn:your-turn-server.com",
            "username": "username",
            "credential": "credential"
        }
    ]
}
```

### Connection Flow
1. Initialize WebRTC
2. Create Peer Connection
3. Create Data Channels
4. Exchange ICE Candidates
5. Establish Connection

## Data Channels

### Reliable Channel
- Used for: Critical game events, state updates
- Configuration:
  - Ordered: true
  - Reliable: true
  - MaxRetransmits: null

### Unreliable Channel
- Used for: Position updates, animations
- Configuration:
  - Ordered: false
  - Reliable: false
  - MaxRetransmits: 0

## Security Considerations
- Use secure TURN servers
- Implement proper authentication
- Validate all network messages
- Use encryption for sensitive data

## Troubleshooting
- ICE Connection failures
- NAT traversal issues
- Bandwidth limitations
- Connection stability
