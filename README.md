# Flash Club

A responsive, two-person Teen Patti house variant. Static HTML, CSS and JavaScript, with PeerJS 1.5.5 for browser-to-browser multiplayer. Play chips only.

## Play

Open the hosted HTTPS page. Enter your name, a shared room code and a password (default `pass`). One person creates the table; the other joins. Keep both pages open. Exactly two seats are accepted. Each starts with 100 chips and antes 5 per hand. Blind wagers are 5 per unit; seen wagers are 10. Check, bet, raise, call, reveal or fold on your turn. A call or two checks triggers showdown. Both players agree before another hand or a fresh match. Full house rules appear in the page.

## Run and test

No build or install required. Serve the folder using `python -m http.server 8000`, then visit `http://localhost:8000`. Run `node test.js` for rule checks. Localhost works for development; remote players should use HTTPS.

## GitHub Pages

Create a public GitHub repository and push these source files to `main`. Under **Settings → Pages**, select **Deploy from a branch**, `main`, and `/(root)`, then Save. GitHub Free supports Pages on public repositories. No long-running server or paid hosting is needed. The deployment workflow completes after publishing; the page remains hosted.

## Multiplayer limits

PeerJS Cloud provides free external signaling; this is not a fully offline app. Some firewalls/NAT combinations require a separately configured TURN relay and may fail to connect. Google Fonts is optional; system fonts are the fallback. A room ID is a SHA-256 digest of the normalized room code and password. Passwords are never stored in this repository. A weak password such as `pass` is not strong access protection. Names are session labels, not verified accounts.

The host is authoritative and keeps the deck in its browser; the guest receives only their revealed cards and public state. The host can inspect its own memory, so this is a casual game for trusted friends, not a cheating-resistant service. Disconnects end the session; there is no persistent balance, reconnection or real-money functionality. Do not use for real stakes.

## Files

`index.html`: interface; `style.css`: responsive styling; `engine.js`: game rules; `app.js`: rooms and multiplayer; `test.js`: engine verification.
