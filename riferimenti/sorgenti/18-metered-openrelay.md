<div id="__docusaurus">

<div id="docusaurus-base-url-issue-banner-container">

</div>

<div role="region">

[Skip to main content](#)

</div>

<div class="navbar__inner">

<div class="navbar__items">

[](/tools/openrelay/)

<div class="navbar__logo">

![Metered Video](/tools/openrelay/img/logo.png)![Metered Video](/tools/openrelay/img/logo.png)

</div>

**Open Relay: Free WebRTC TURN Server**

</div>

<div class="navbar__items navbar__items--right">

[Signalling Server](/tools/openrelay/webrtc-signaling-server)

<div class="navbar__item dropdown dropdown--hoverable dropdown--right">

[WebRTC SDKs](#)

  - [JavaScript SDK](/tools/openrelay/webrtc-library)
  - [Flutter SDK](/tools/openrelay/webrtc-library-flutter)
  - [Python SDK](/tools/openrelay/webrtc-library-python)

</div>

Login

<div class="toggle_Pssr toggle_TdHA toggleDisabled_jDku">

<div class="toggleTrack_SSoT" role="button" tabindex="-1">

<div class="toggleTrackCheck_XobZ">

<span class="toggleIcon_eZtF">🌜</span>

</div>

<div class="toggleTrackX_YkSC">

<span class="toggleIcon_eZtF">🌞</span>

</div>

<div class="toggleTrackThumb_uRm4">

</div>

</div>

</div>

</div>

</div>

<div class="navbar-sidebar__backdrop" role="presentation">

</div>

<div class="main-wrapper docs-wrapper docs-doc-page">

<div class="docPage_P2Lg">

<div class="sidebar_CW9Y">

  - 
    
    <div class="menu__list-item-collapsible">
    
    [Open Relay Project](/tools/openrelay/)
    
    </div>
    
      - [Getting Started](/tools/openrelay/)
      - [Stun Server](/tools/openrelay/stun-servers-and-friends)

  - 
    
    <div class="menu__list-item-collapsible">
    
    [WebRTC SDK & Signalling](/tools/openrelay/webrtc-signaling-server)
    
    </div>
    
      - [WebRTC Signalling Server](/tools/openrelay/webrtc-signaling-server)
    
      - 
        
        <div class="menu__list-item-collapsible">
        
        [Client SDKs](/tools/openrelay/webrtc-library)
        
        </div>
        
          - [JavaScript WebRTC Library (SDK)](/tools/openrelay/webrtc-library)
          - [Flutter WebRTC Library (SDK)](/tools/openrelay/webrtc-library-flutter)
          - [Python WebRTC Library (SDK)](/tools/openrelay/webrtc-library-python)

  - 
    
    <div class="menu__list-item-collapsible">
    
    [Tutorials](/tools/openrelay/tutorials/datachannel)
    
    </div>
    
      - [WebRTC DataChannel Tutorial](/tools/openrelay/tutorials/datachannel)
      - [Python AI Voice Agent](/tools/openrelay/webrtc-with-python)

</div>

<div class="docMainContainer_TCnq" role="main">

<div class="container padding-top--md padding-bottom--lg">

<div class="row">

<div class="col docItemCol_DM6M">

<div class="docItemContainer_vinB">

<div class="tocCollapsible_jdIR theme-doc-toc-mobile tocMobile_TmEX">

On this page

</div>

<div class="theme-doc-markdown markdown">

# Open Relay: Free WebRTC TURN Server

-----

## Need a Premium TURN Server[​](#need-a-premium-turn-server "Direct link to heading")

Metered also offers a premium TURN server service that automatically routes users to nearest server offering lowest possible latency. Plus also offer powerful REST API that allows creation, automatic expiry of credentials and ability to fetch detailed usage stats.

Learn more about it here.

[Premium TURN server by Metered](https://metered.ca/stun-turn)

## What is a TURN Server?[​](#what-is-a-turn-server "Direct link to heading")

-----

WebRTC TURN Server is required to relay the traffic between the peers when direct connection cannot be established among them.

WebRTC protocol establishes a direct connection between the peers, but the sometimes a direct connection cannot be established for this a TURN Server is required to relay the traffic between the peers.

As peers cannot directly connect to each other the TURN Server acts as an intermediary among the peers and forwards the traffic from one peer to another.

All the traffic (video/audio + data) that passes through the TURN server is already end-to-end encrypted by the peers and the TURN Server cannot decode/read the encrypted packet, it just relays the packet to other peers.

![turn server](/tools/openrelay/assets/images/turn-server-21d0a088ff33ba667aa62b5101226d57.png)

## Overview[​](#overview "Direct link to heading")

-----

Open Relay is a free TURN server provided by [Metered Video](https://www.metered.ca/docs/) that you can use in your WebRTC applications. The Open Relay TURN server is highly available, reliable and offers both STUN and TURN Capabilities.

The Open Relay runs on port 80 and 443 to bypass corporate firewalls, many corporate/enterprise firewall only allow port 80 or 443, it also supports `turns` + SSL for maximum compatibility.

The TURN Server provides **20 GB** of free TURN Usage every month.

  - ✅ Runs on port 80 and 443
  - ✅ Tested to bypass most firewall rules
  - ✅ Support TURNS + SSL to allow connections through deep packet inspection firewalls.
  - ✅ Support STUN
  - ✅ Supports both TCP and UDP
  - ✅ Dynamic routing to the nearest server
  - ✅ 20GB of free TURN Usage Every Month

[Signup for free account](https://dashboard.metered.ca/signup?tool=turnserver)

## Global TURN server Cloud Infrastructure[​](#global-turn-server-cloud-infrastructure "Direct link to heading")

![Nextcloud Talk TURN Server Setting](/tools/openrelay/assets/images/turn-servers1-c45c18cc859fb7ad9b6b442e3759f7da.png)

## ✨ How to use[​](#-how-to-use "Direct link to heading")

-----

You can use the Open Relay TURN Server in your Javascript Code.

To use the TURN Server you will have to call the TURN Server REST API, the TURN Server REST API will return the `iceServers` array that you can use in the front-end.

The REST API automatically returns `iceServers` that are nearest to the geo-location of the user for the lowest latency.

<div class="admonition admonition-info alert alert--info">

<div class="admonition-heading">

##### <span class="admonition-icon"></span>info

</div>

<div class="admonition-content">

To obtain your **`API_KEY`** sign-up for a free account.

</div>

</div>

### Using the JavaScript Fetch() API[​](#using-the-javascript-fetch-api "Direct link to heading")

<div class="codeBlockContainer_I0IT language-js theme-code-block">

<div class="codeBlockContent_wNvx js">

``` prism-code language-js codeBlock_jd64 thin-scrollbar
const peerConfiguration = {};

(async () => {
  const response = await fetch("https://yourappname.metered.live/api/v1/turn/credentials?apiKey=API_KEY");
  const iceServers = await response.json();
  peerConfiguration.iceServers = iceServers;
})();

const myPeerConnection = new RTCPeerConnection(peerConfiguration);
```

Copy

</div>

</div>

### Using Axios[​](#using-axios "Direct link to heading")

<div class="codeBlockContainer_I0IT language-js theme-code-block">

<div class="codeBlockContent_wNvx js">

``` prism-code language-js codeBlock_jd64 thin-scrollbar
const peerConfiguration = {};

(async () => {
  const response = await axios.get("https://yourappname.metered.live/api/v1/turn/credentials?apiKey=API_KEY");
  const iceServers = response.data;
  peerConfiguration.iceServers = iceServers;
})();

const myPeerConnection = new RTCPeerConnection(peerConfiguration);
```

Copy

</div>

</div>

### Using a Metered realtime SDK[​](#using-a-metered-realtime-sdk "Direct link to heading")

The examples above fetch `iceServers` for a raw `RTCPeerConnection` — you still have to build signalling, reconnect, and negotiation yourself. Metered's free, open-source realtime SDKs bundle all of it and **auto-inject your Open Relay TURN credentials** at connect time. Pick your language:

<div class="tabs-container">

  - JavaScript
  - Flutter
  - Python

<div class="margin-vert--md">

<div role="tabpanel">

<div class="codeBlockContainer_I0IT language-js theme-code-block">

<div class="codeBlockContent_wNvx js">

``` prism-code language-js codeBlock_jd64 thin-scrollbar
import { MeteredPeer } from "@metered-ca/realtime";

const peer = new MeteredPeer({ apiKey: "pk_live_..." }); // free key in your dashboard
await peer.join("my-room");                              // discovers peers; TURN auto-applied

peer.on("peer-joined", ({ peer: remote }) => {
  remote.on("stream-added", ({ stream }) => {
    remoteVideo.srcObject = stream;
  });
});

const cam = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
peer.addStream(cam);
```

Copy

</div>

</div>

</div>

<div role="tabpanel" hidden="">

<div class="codeBlockContainer_I0IT language-dart theme-code-block">

<div class="codeBlockContent_wNvx dart">

``` prism-code language-dart codeBlock_jd64 thin-scrollbar
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:metered_realtime/metered_realtime.dart';

final peer = MeteredPeer(MeteredPeerOptions(apiKey: 'pk_live_...'));
await peer.join('my-room');                       // discovers peers; TURN auto-applied

peer.onPeerJoined.listen((remote) {
  remote.onStreamAdded.listen((ev) {
    renderer.srcObject = (ev.stream as FlutterWebrtcMediaStream).native;
  });
});

final cam = await navigator.mediaDevices
    .getUserMedia({'audio': true, 'video': true});
await peer.addStream(wrapMediaStream(cam), metadata: {'role': 'camera'});
```

Copy

</div>

</div>

</div>

<div role="tabpanel" hidden="">

<div class="codeBlockContainer_I0IT language-python theme-code-block">

<div class="codeBlockContent_wNvx python">

``` prism-code language-python codeBlock_jd64 thin-scrollbar
import asyncio
from metered_realtime import MeteredPeer, PeerJoined, Track, iter_frames

async def main():
    async with MeteredPeer(api_key="pk_live_...") as peer:

        @peer.on(PeerJoined)
        def on_peer(ev):
            @ev.peer.on(Track)
            async def on_track(t):
                async for frame in iter_frames(t.track):
                    process(frame)        # render, record, transcode…

        await peer.join("my-room")        # discovers peers; TURN auto-applied
        await asyncio.Future()

asyncio.run(main())
```

Copy

</div>

</div>

</div>

</div>

</div>

<div class="admonition admonition-note alert alert--secondary">

<div class="admonition-heading">

##### <span class="admonition-icon"></span>note

</div>

<div class="admonition-content">

The SDK's `apiKey` here is your **signalling publishable key** (`pk_live_...`), separate from the TURN REST `API_KEY` used above — both are free in your dashboard. Create it from **[Dashboard](https://dashboard.metered.ca/signup?tool=turnserver) → Realtime Messaging → Keys → Create key → Publishable**, and **make sure `Send` is enabled** — it's off by default, and without it WebRTC connects but the video never negotiates.

</div>

</div>

Free signalling + 20 GB/mo free Open Relay TURN, no backend to run:

  - **[JavaScript SDK](/tools/openrelay/webrtc-library)** — `@metered-ca/realtime`, the open-source browser WebRTC library
  - **[Flutter SDK](/tools/openrelay/webrtc-library-flutter)** — `metered_realtime`, native mobile, web & desktop on flutter\_webrtc
  - **[Python SDK](/tools/openrelay/webrtc-library-python)** — `metered-realtime`, server-side & headless on aiortc
  - **[Free WebRTC signalling server](/tools/openrelay/webrtc-signaling-server)** — the managed signalling layer

### 🔓 Credentials[​](#-credentials "Direct link to heading")

To Connect to the Open Relay TURN Server, you need to sign-up for a free account and obtain your API Key.

Using the API you can call the end-point to fetch the `iceServers` array that you can use in the `RTCPeerConnection`.

[Signup for free account](https://dashboard.metered.ca/signup?tool=turnserver)

### 🔐 Static Auth[​](#-static-auth "Direct link to heading")

Services like Nextcloud Talk or Matrix+Synapse+Riot uses static auth instead of username and password authentication for the TURN Server. To use the TURN Server with those services use the static auth url which is `staticauth.openrelay.metered.ca`

<div class="codeBlockContainer_I0IT theme-code-block">

<div class="codeBlockContent_wNvx">

``` prism-code language-text codeBlock_jd64 thin-scrollbar
secret: openrelayprojectsecret
```

Copy

</div>

</div>

## TURN Server for Nextcloud Talk[​](#turn-server-for-nextcloud-talk "Direct link to heading")

-----

Open Relay Project also works with Nextcloud talk, follow the instructions below to learn how to configure Nextcloud talk to work with Open Relay.

Nextcloud talk require the `auth-secret-authentication` so we have to use the Open Relay Project's TURN Server with auth-secret-authentication. Use the turn server url `staticauth.openrelay.metered.ca` with Nextcloud talk and turn secret: `openrelayprojectsecret`.

  - Go to `Nextcloud-> Settings -> Talk` and under TURN Servers press the + button
  - Then select `turn:only`
  - Under turnserver:port enter `staticauth.openrelay.metered.ca:80`
  - Under secret enter `openrelayprojectsecret`

Add another entry for port 443

  - Select `turn:only`
  - Under turnserver:port enter `staticauth.openrelay.metered.ca:443`
  - Under secret enter `openrelayprojectsecret`

![Nextcloud Talk TURN Server Setting](/tools/openrelay/assets/images/nextcloud-talk-turn-server-setting-updated-daaa4171259031d1e226b440229d9640.png)

## 🧰 Testing the TURN and STUN Server[​](#-testing-the-turn-and-stun-server "Direct link to heading")

-----

You can test the TURN Server using our TURN Server Testing tool

### Trickle ICE[​](#trickle-ice "Direct link to heading")

-----

Go to the [**TURN Server Testing tool**](https://www.metered.ca/turn-server-testing) website at: <https://www.metered.ca/turn-server-testing> and enter the TURN Server credentials.

**1. Add TURN Server Info** Add the TURN Server Credential. If you do not have the TURN Server credentials you can obtain them by signup for a free account.

![](/tools/openrelay/assets/images/add-ice-server-5d4638b0e2664e7b98c6739bb77d2de6.png)

**2. Add STUN Server Info**

Click the Launch Button to Launch the test. If you don't specify the STUN Server address it will not display your PUBLIC IP address.

![](/tools/openrelay/assets/images/test-server-3cb875292aeadbb99c27273bd36c10e3.jpg)

## 🧰 Complete your free WebRTC stack[​](#-complete-your-free-webrtc-stack "Direct link to heading")

-----

A TURN server is just one piece of WebRTC. To actually connect two peers you also need **signalling** (to exchange connection info) and a **client library** (to manage the connection and reconnects). Metered gives you all three — free to start:

| Piece                               | What it does                                                                             | Free tier                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------- |
| 🟢 **Open Relay TURN**               | Relays media when peers can't connect directly                                           | 20 GB / month                       |
| 🔵 **Metered Realtime** (signalling) | Coordinates connections over WebSocket                                                   | 100 connections · 100k msgs / month |
| 🟣 **@metered-ca/realtime** (JS)     | Open-source JS library — auto-reconnect, TURN built in                                   | MIT · free                          |
| 📱 **metered\_realtime** (Flutter)   | Open-source Flutter/Dart library on flutter\_webrtc — same auto-reconnect, TURN built in | MIT · free                          |
| 🐍 **metered-realtime** (Python)     | Open-source Python library on aiortc — async, same auto-reconnect, TURN built in         | MIT · free                          |

→ [Free WebRTC signalling server](/tools/openrelay/webrtc-signaling-server) · [The open-source PeerJS & simple-peer alternative](/tools/openrelay/webrtc-library) · [Flutter WebRTC SDK (on flutter\_webrtc)](/tools/openrelay/webrtc-library-flutter) · [Python WebRTC SDK (on aiortc)](/tools/openrelay/webrtc-library-python)

## 📡 Free WebRTC Signalling Server[​](#-free-webrtc-signalling-server "Direct link to heading")

-----

A TURN server only relays media once a connection exists — to *establish* the connection, peers must first exchange SDP offers/answers and ICE candidates over a **signalling** channel. Metered's **Realtime Messaging** is a free, managed signalling server that pairs with Open Relay, so you don't have to build or host your own.

  - ✅ Pub/sub over a single WebSocket (`wss://rms.metered.ca/v1`)
  - ✅ Channels, presence (join/leave + per-peer metadata), and direct peer-to-peer messages
  - ✅ JWT-minted credentials — your backend decides who can do what
  - ✅ REST API to mint tokens, list peers, and publish server-side
  - ✅ Auto-injects your Open Relay TURN credentials at connect time — no manual fetch

[Explore the signalling server →](/tools/openrelay/webrtc-signaling-server)

## 🧩 @metered-ca/realtime — WebRTC Peer Library[​](#-metered-carealtime--webrtc-peer-library "Direct link to heading")

-----

The fastest way to use Open Relay and Realtime Messaging together. A free, open-source (MIT) browser SDK (\~12.5 KB) that bundles signalling, WebRTC negotiation, and TURN injection into a few lines of code — a modern, batteries-included alternative to PeerJS and simple-peer.

  - ✅ Auto-reconnect that survives Wi-Fi drops (WebSocket reconnect + ICE-restart + identity-preserving reconcile)
  - ✅ Perfect-negotiation — no glare or initiator-role bugs
  - ✅ Multi-stream with per-stream metadata (route camera + screen through one peer)
  - ✅ \~12.5 KB gzipped, zero dependencies, TypeScript-native

<div class="codeBlockContainer_I0IT language-bash theme-code-block">

<div class="codeBlockContent_wNvx bash">

``` prism-code language-bash codeBlock_jd64 thin-scrollbar
npm install @metered-ca/realtime
```

Copy

</div>

</div>

  - Replacing **PeerJS**? → [PeerJS migration guide](https://www.metered.ca/docs/realtime-messaging/sdk-javascript/migration/from-peerjs)
  - Replacing **simple-peer**? → [simple-peer migration guide](https://www.metered.ca/docs/realtime-messaging/sdk-javascript/migration/from-simple-peer)

[Explore the @metered-ca/realtime SDK →](/tools/openrelay/webrtc-library)

## 📱 metered\_realtime — Flutter WebRTC SDK[​](#-metered_realtime--flutter-webrtc-sdk "Direct link to heading")

-----

The same model for **native mobile, web, and desktop**. A free, open-source (MIT) Flutter/Dart library built on **flutter\_webrtc** that adds signalling, multi-peer rooms, auto-reconnect, and TURN injection — so a Flutter app joins the same room as your browser users, from one Dart codebase.

  - ✅ One Dart codebase — Android, iOS, web, macOS, Windows, Linux
  - ✅ Built on flutter\_webrtc — keep full access to the underlying connection + renderers
  - ✅ Auto-reconnect across Wi-Fi → cellular handoffs + auto-injected free TURN
  - ✅ Shares rooms with the JavaScript/browser SDK

<div class="codeBlockContainer_I0IT language-bash theme-code-block">

<div class="codeBlockContent_wNvx bash">

``` prism-code language-bash codeBlock_jd64 thin-scrollbar
flutter pub add metered_realtime
```

Copy

</div>

</div>

[Explore the Flutter WebRTC SDK →](/tools/openrelay/webrtc-library-flutter)

## 🐍 metered-realtime — Python WebRTC SDK[​](#-metered-realtime--python-webrtc-sdk "Direct link to heading")

-----

The same model for **server-side and headless** WebRTC. A free, open-source (MIT) Python library built on **aiortc** that adds signalling, multi-peer rooms, auto-reconnect, and TURN injection — so a Python process can join the same room as your browser users. Built for **AI voice agents, recording bots, IoT bridges, and server-side media**.

  - ✅ Async/asyncio-native, production-stable (1.0.0)
  - ✅ Built on aiortc — keep full access to the underlying peer connection
  - ✅ Auto-reconnect + auto-injected free TURN
  - ✅ Shares rooms with the JavaScript/browser SDK

<div class="codeBlockContainer_I0IT language-bash theme-code-block">

<div class="codeBlockContent_wNvx bash">

``` prism-code language-bash codeBlock_jd64 thin-scrollbar
pip install metered-realtime
```

Copy

</div>

</div>

[Explore the Python WebRTC SDK →](/tools/openrelay/webrtc-library-python)

## 🛡️Security[​](#️security "Direct link to heading")

-----

All the WebRTC traffic is end-to-end encrypted using DTLS-SRTP and the TURN server just relays the traffic. The TURN server only parse the UDP layer of WebRTC packet for routing purposes, and do not (and cannot) touch the DTLS encryption.

All the application layer data, include video and datachannel is encrypted using DTLS+SRTP and the TURN server cannot decrypt that data and it only relays the encrypted data among the peers.

You can read more about it here: <https://webrtc-security.github.io/>

To read more about the TURN proposed standard refer to [RFC 5766](https://www.rfc-editor.org/rfc/rfc5766)

## ℹ️ Contact[​](#ℹ️-contact "Direct link to heading")

-----

If you have any questions, comments or suggestions you can email us at `contact[at]openrelayproject.org`

## 🚀 Powered by [Metered Video](https://www.metered.ca)[​](#-powered-by-metered-video "Direct link to heading")

-----

**[Metered Video](https://www.metered.ca)** provides enterprise grade WebRTC video calling apis that you can use to create video conferencing applications that can scale upto thousands of simultaneous online users, with live streaming and recording capabilities.

Building peer-to-peer WebRTC? Metered's free [`@metered-ca/realtime`](/tools/openrelay/webrtc-library) (JavaScript), [`metered_realtime`](/tools/openrelay/webrtc-library-flutter) (Flutter), and [`metered-realtime`](/tools/openrelay/webrtc-library-python) (Python) SDKs and [Realtime Messaging](/tools/openrelay/webrtc-signaling-server) signalling service pair with Open Relay for signalling, presence, and auto-reconnect.

-----

## Terms and Conditions[​](#terms-and-conditions "Direct link to heading")

By using Open Relay Project Website or TURN server, you agree to our [terms and conditions.](/tools/openrelay/terms-and-conditions)

</div>

<div class="pagination-nav__item">

</div>

<div class="pagination-nav__item pagination-nav__item--next">

[](/tools/openrelay/stun-servers-and-friends)

<div class="pagination-nav__sublabel">

Next

</div>

<div class="pagination-nav__label">

Stun Server

</div>

</div>

</div>

</div>

<div class="col col--3">

<div class="tableOfContents_cNA8 thin-scrollbar theme-doc-toc-desktop">

  - [Need a Premium TURN Server](#need-a-premium-turn-server)
  - [What is a TURN Server?](#what-is-a-turn-server)
  - [Overview](#overview)
  - [Global TURN server Cloud Infrastructure](#global-turn-server-cloud-infrastructure)
  - [✨ How to use](#-how-to-use)
      - [Using the JavaScript Fetch() API](#using-the-javascript-fetch-api)
      - [Using Axios](#using-axios)
      - [Using a Metered realtime SDK](#using-a-metered-realtime-sdk)
      - [🔓 Credentials](#-credentials)
      - [🔐 Static Auth](#-static-auth)
  - [TURN Server for Nextcloud Talk](#turn-server-for-nextcloud-talk)
  - [🧰 Testing the TURN and STUN Server](#-testing-the-turn-and-stun-server)
      - [Trickle ICE](#trickle-ice)
  - [🧰 Complete your free WebRTC stack](#-complete-your-free-webrtc-stack)
  - [📡 Free WebRTC Signalling Server](#-free-webrtc-signalling-server)
  - [🧩 @metered-ca/realtime — WebRTC Peer Library](#-metered-carealtime--webrtc-peer-library)
  - [📱 metered\_realtime — Flutter WebRTC SDK](#-metered_realtime--flutter-webrtc-sdk)
  - [🐍 metered-realtime — Python WebRTC SDK](#-metered-realtime--python-webrtc-sdk)
  - [🛡️Security](#️security)
  - [ℹ️ Contact](#ℹ️-contact)
  - [🚀 Powered by Metered Video](#-powered-by-metered-video)
  - [Terms and Conditions](#terms-and-conditions)

</div>

</div>

</div>

</div>

</div>

</div>

</div>

<div class="container container-fluid">

<div class="footer__bottom text--center">

<div class="footer__copyright">

Copyright © 2026 Next Path Software Consulting Inc.

</div>

</div>

</div>

</div>
