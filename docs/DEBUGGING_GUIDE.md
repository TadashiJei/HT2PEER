# Debugging Guide

## Common Issues and Solutions

### 1. Connection Issues

#### ICE Connection Failure
**Symptoms:**
- Peers cannot connect
- ICE gathering process fails
- Connection timeout

**Solutions:**
1. Check STUN/TURN configuration
2. Verify network connectivity
3. Check firewall settings
4. Enable ICE logging:
```csharp
RTCPeerConnection.OnIceConnectionStateChange += (state) => {
    Debug.Log($"ICE Connection State: {state}");
};
```

#### Data Channel Issues
**Symptoms:**
- Messages not being received
- One-way communication
- Channel state errors

**Solutions:**
1. Check channel configuration
2. Verify message serialization
3. Monitor channel state:
```csharp
dataChannel.OnStateChange += () => {
    Debug.Log($"Channel State: {dataChannel.ReadyState}");
};
```

### 2. State Synchronization Issues

#### State Desynchronization
**Symptoms:**
- Objects teleporting
- Inconsistent game state
- Input lag

**Debug Steps:**
1. Enable state logging:
```csharp
public void LogStateSnapshot(StateSnapshot snapshot)
{
    Debug.Log($"Tick: {snapshot.TickNumber}");
    Debug.Log($"Objects: {snapshot.GameObjects.Count}");
    Debug.Log($"Delta Size: {snapshot.GetDeltaSize()}");
}
```

2. Monitor network metrics:
```csharp
public class NetworkMetrics
{
    public static void LogMetrics()
    {
        var rtt = PeerConnection.GetRTT();
        var packetLoss = PeerConnection.GetPacketLoss();
        Debug.Log($"RTT: {rtt}ms, Loss: {packetLoss}%");
    }
}
```

### 3. Performance Monitoring

#### Memory Usage
```csharp
public class MemoryMonitor : MonoBehaviour
{
    private void Update()
    {
        if (Time.frameCount % 100 == 0)
        {
            var totalMemory = System.GC.GetTotalMemory(false);
            Debug.Log($"Memory Usage: {totalMemory / 1024 / 1024}MB");
        }
    }
}
```

#### Network Usage
```csharp
public class NetworkMonitor
{
    private static Dictionary<MessageType, int> messageCounter = new Dictionary<MessageType, int>();
    private static Dictionary<MessageType, int> byteCounter = new Dictionary<MessageType, int>();

    public static void TrackMessage(MessageType type, int bytes)
    {
        messageCounter[type] = messageCounter.GetValueOrDefault(type) + 1;
        byteCounter[type] = byteCounter.GetValueOrDefault(type) + bytes;
    }

    public static void LogStats()
    {
        foreach (var type in messageCounter.Keys)
        {
            Debug.Log($"{type}: {messageCounter[type]} messages, {byteCounter[type]} bytes");
        }
    }
}
```

## Logging System

### 1. Network Logging
```csharp
public static class NetworkLogger
{
    public static void LogConnection(string peerId, string event)
    {
        Debug.Log($"[NET][{DateTime.Now:HH:mm:ss.fff}] Peer {peerId}: {event}");
    }

    public static void LogMessage(MessageType type, int size)
    {
        Debug.Log($"[MSG][{DateTime.Now:HH:mm:ss.fff}] {type}: {size} bytes");
    }
}
```

### 2. State Logging
```csharp
public static class StateLogger
{
    public static void LogStateUpdate(uint tick, int objectCount)
    {
        Debug.Log($"[STATE][{DateTime.Now:HH:mm:ss.fff}] Tick {tick}: {objectCount} objects");
    }

    public static void LogReconciliation(uint tick, Vector3 delta)
    {
        Debug.Log($"[RECON][{DateTime.Now:HH:mm:ss.fff}] Tick {tick}: Delta {delta}");
    }
}
```

## Profiling Tools

### 1. Network Profiler
```csharp
public class NetworkProfiler : MonoBehaviour
{
    private float updateInterval = 1.0f;
    private float nextUpdate = 0.0f;
    
    private void Update()
    {
        if (Time.time > nextUpdate)
        {
            ProfileNetwork();
            nextUpdate = Time.time + updateInterval;
        }
    }
    
    private void ProfileNetwork()
    {
        var stats = RTCPeerConnection.GetStats();
        // Log bandwidth usage, packet loss, etc.
    }
}
```

### 2. State Profiler
```csharp
public class StateProfiler : MonoBehaviour
{
    private CircularBuffer<float> syncTimes = new CircularBuffer<float>(100);
    
    public void TrackStateSync(float time)
    {
        syncTimes.Add(time);
        
        if (syncTimes.Count >= 100)
        {
            AnalyzeSyncTimes();
        }
    }
    
    private void AnalyzeSyncTimes()
    {
        float avg = syncTimes.Average();
        float max = syncTimes.Max();
        Debug.Log($"Sync Times - Avg: {avg}ms, Max: {max}ms");
    }
}
```
