# Complete Setup Guide

## 1. Package Installation
### For Game Developers
1. In Unity, open Package Manager
2. Add package via git URL: `https://github.com/tadashijei/ht2peer.git`
3. Unity will automatically import all necessary components

## 2. Server Infrastructure Setup

### A. Signaling Server Setup
```bash
# On your VPS
git clone https://github.com/tadashijei/ht2peer-signaling
cd ht2peer-signaling
npm install
npm run setup
```

Configuration (`config.json`):
```json
{
    "port": 3000,
    "ssl": {
        "enabled": true,
        "cert": "/path/to/cert.pem",
        "key": "/path/to/key.pem"
    },
    "authentication": {
        "enabled": true,
        "secret": "your-secret-key"
    }
}
```

### B. TURN Server Setup
```bash
# Install coturn on your VPS
sudo apt-get update
sudo apt-get install coturn

# Configure coturn
sudo nano /etc/turnserver.conf
```

Example TURN configuration:
```conf
listening-port=3478
tls-listening-port=5349
listening-ip=YOUR_SERVER_IP
external-ip=YOUR_SERVER_IP
realm=yourdomain.com
server-name=yourdomain.com
user-quota=12
total-quota=1200
authentication-method=long-term
user=username:password
```

## 3. Unity Project Configuration

### A. Network Settings
1. Create `HT2PeerSettings` asset:
   - Right-click in Project window
   - Create > HT2Peer > Network Settings

2. Configure settings:
```json
{
    "signaling": {
        "url": "wss://your-signaling-server.com",
        "authentication": {
            "enabled": true,
            "apiKey": "your-api-key"
        }
    },
    "iceServers": [
        {
            "urls": ["stun:stun.yourdomain.com:3478"],
            "username": "username",
            "credential": "password"
        },
        {
            "urls": ["turn:turn.yourdomain.com:3478"],
            "username": "username",
            "credential": "password"
        }
    ]
}
```

### B. Scene Setup
1. Add Network Manager:
   ```csharp
   // In your scene's startup script
   void Start()
   {
       HT2PeerNetwork.Initialize(settings);
       await HT2PeerNetwork.Connect();
   }
   ```

2. Configure Network Objects:
   ```csharp
   // Add to objects that need networking
   gameObject.AddComponent<HT2PeerView>();
   ```

## 4. Connection Flow

### A. Initial Connection
1. Client connects to Signaling Server
2. Authentication check
3. Room creation/joining
4. WebRTC peer connection establishment

### B. P2P Connection Process
1. ICE Candidate gathering
2. SDP exchange through signaling server
3. Direct P2P connection establishment
4. Data channel creation

## 5. Monitoring and Management

### A. Server Monitoring
```bash
# Install monitoring tools
npm install -g pm2
pm2 start signaling-server.js

# Monitor server
pm2 monit
```

### B. Analytics Setup
```json
{
    "analytics": {
        "enabled": true,
        "endpoint": "https://your-analytics-server.com",
        "metrics": [
            "connections",
            "bandwidth",
            "latency",
            "rooms"
        ]
    }
}
```

## 6. Security Considerations

### A. Server Security
- Enable SSL/TLS
- Configure firewall
- Set up DDoS protection
- Implement rate limiting

### B. Client Security
- API key validation
- Data encryption
- Anti-cheat measures
- Input validation

## 7. Scaling Considerations

### A. Signaling Server Scaling
- Load balancer setup
- Multiple server regions
- Database sharding
- Cache implementation

### B. TURN Server Scaling
- Regional TURN servers
- Load balancing
- Failover configuration
- Bandwidth management

## 8. Troubleshooting

### A. Connection Issues
- Check firewall settings
- Verify TURN configuration
- Monitor network metrics
- Review error logs

### B. Performance Issues
- Enable debug logging
- Monitor bandwidth usage
- Check latency metrics
- Analyze packet loss
