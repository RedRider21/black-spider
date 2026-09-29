# Extreme WebSocket connection delay (6+ minutes) on 0.peerjs.com #1350

https://github.com/peers/peerjs/issues/1350

---
*red-reddington — 2025-10-14T20:53:19Z — stato: open*

### Please, check for existing issues to avoid duplicates.

- [x] No similar issues found.

### What happened?

## Description
The PeerJS cloud server (0.peerjs.com) is experiencing extreme connection delays of 6+ minutes, despite the status page showing all systems operational.

## Additional Notes
Status page (https://status.peerjs.com/ib0l) shows all systems operational (green), but the issue is reproducible consistently across:
- Different networks (home ISP, mobile data)
- Different devices (desktop, mobile)
- Both local and deployed (Vercel) applications

The delay occurs specifically during the WebSocket handshake phase before `peer.on('open')` fires.

## Console Output
```
[MP] Before new Peer(): 3118.3000000000466
[MP] After new Peer(): 3119
PeerJS: Socket open
[... 6 minute delay ...]
PeerJS: Server message received: {type: 'OPEN'}
peer-open: 373694.9450683594 ms
```


### How can we reproduce the issue?

## Steps to Reproduce
```javascript
const peer = new Peer({ debug: 3 });
const start = performance.now();
peer.on('open', (id) => {
  console.log('Connected after:', performance.now() - start, 'ms');
});
```

## Expected Behavior
Connection should complete in 1-3 seconds

## Actual Behavior
- Connection takes 373,000+ ms (6+ minutes)
- Tested from multiple networks (home ISP, mobile data)
- Tested from multiple devices (desktop, mobile)
- Affects both local development and deployed applications


### What do you expected to happen?

Please advise.

### Environment setup

## Environment
- Browser: Chrome (latest)
- PeerJS version: Latest from CDN


### Is this a regression?

_No response_

### Anything else?

This used to work flawlessly up to a couple hours ago.
