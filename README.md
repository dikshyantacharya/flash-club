# Flash Club

A responsive, two-person Teen Patti house variant. Static HTML, CSS and JavaScript, with encrypted room messages over a secure WebSocket relay. Play chips only.

## Play

Open the hosted HTTPS page. Enter your name, a shared room code and a password (default `pass`). One person creates the table; the other joins. Keep both pages open. Exactly two seats are accepted. Each starts with 100 chips and antes 5 per hand. Blind wagers are 5 per unit; seen wagers are 10. Check, bet, raise, call, reveal or fold on your turn. Calling keeps betting open. Show pays the outstanding call plus a flat 5 into the pot and immediately reveals both hands; when bets match, Show costs 5. The extra 5 is the same for blind and seen players. Two consecutive checks immediately reveal both hands and settle the pot for free. Both players choose Next hand to keep playing with their balances, or restart with 100 each when a player cannot ante. Full house rules appear in the page.

## Run and test

No build or install required. Serve the folder using `python -m http.server 8000`, then visit `http://localhost:8000`. Run `node test.js` for rule checks, `node transport.test.js` for isolated room tests, and `node transport.test.js --live` for an actual two-client connection through the public relay. Tests require Node 22 or later. Localhost works for development; remote players should use HTTPS.

## GitHub Pages

Create a public GitHub repository and push these source files to `main`. Under **Settings → Pages**, select **Deploy from a branch**, `main`, and `/(root)`, then Save. GitHub Free supports Pages on public repositories. No long-running server or paid hosting is needed. The deployment workflow completes after publishing; the page remains hosted.

## Multiplayer limits

The relay transport replaces PeerJS/WebRTC with MQTT over secure WebSockets at `wss://broker.emqx.io:8084/mqtt`. Both browsers make outbound connections to the same relay; no direct browser connection, UDP, STUN, TURN, account or application server is required. MQTT.js 5.10.4 is bundled locally under `vendor/`, with its MIT license. Google Fonts is optional; system fonts are the fallback.

EMQX's free public broker is a shared testing service with no availability guarantee. Internet access and permission to reach its secure WebSocket endpoint are required. Relay failures now report relay-specific errors, and a missing room/password mismatch reports that no table answered. A failed session can be created/joined again. Hosting on GitHub Pages remains free and static; GitHub does not provide the multiplayer relay.

All room messages (including cards, names and moves) are encrypted with AES-256-GCM before publishing. The encryption key is derived using PBKDF2-SHA-256 with 150,000 iterations and a room-specific salt. Room topics use a SHA-256 digest of room code and password. Messages are not retained. Duplicate/replayed message IDs and invalid ciphertext are ignored. The relay can see connection metadata, traffic sizes, and hashed topics. The shared default password `pass` is weak: use a unique room code and strong password for private play. Anyone with both can join or impersonate a player. Names are session labels, not verified accounts.

The host is authoritative and keeps the deck in its browser; the guest receives only their revealed cards and public state. The host can inspect its own memory, so this is a casual game for trusted friends, not a cheating-resistant service. Disconnects end the session; there is no persistent balance, reconnection or real-money functionality. Do not use for real stakes.

## Files

`index.html`: interface; `style.css`: responsive styling; `engine.js`: game rules; `app.js`: interface wiring; `transport.js`: encrypted rooms; `test.js`: engine verification; `transport.test.js`: isolated and live transport verification; `vendor/`: bundled MQTT.js and license.

Updated clients use the v4 room namespace, so old-version tables cannot block new tables with the same code/password. Existing tabs keep their old in-memory sessions until they leave, close, or refresh; there is no central table store or global administrative delete.
