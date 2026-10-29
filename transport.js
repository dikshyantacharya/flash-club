/* Encrypted room messages over WSS: no WebRTC, UDP, STUN or TURN required. */
(function (root) {
  'use strict';
  const encode = new TextEncoder(), decode = new TextDecoder();
  const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  const base64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const unbase64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
  class RelayRoom {
    constructor(options) {
      this.options = options;
      this.id = crypto.randomUUID();
      this.partner = null;
      this.closed = false;
      this.active = false;
      this.timers = [];
      this.received = new Set();
      this.outgoing = Promise.resolve();
      this.incoming = Promise.resolve();
    }
    later(fn, ms) { const t = setTimeout(() => { if (!this.closed) fn(); }, ms); this.timers.push(t); return t; }
    every(fn, ms) { const t = setInterval(() => { if (!this.closed) fn(); }, ms); this.timers.push(t); return t; }
    status(message) { this.options.onStatus?.(message); }
    fail(message) {
      if (this.closed) return;
      this.dispose();
      this.options.onError?.(message);
    }
    async start() {
      try {
        if (!root.mqtt || !root.crypto?.subtle) throw Error('This browser needs an HTTPS page with Web Crypto support.');
        const { room, password } = this.options;
        this.topic = 'flashclub/v2/' + hex(await crypto.subtle.digest('SHA-256', encode.encode(room + '\0' + password)));
        const material = await crypto.subtle.importKey('raw', encode.encode(password), 'PBKDF2', false, ['deriveKey']);
        this.key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: encode.encode('flashclub/v2/' + room), iterations: 150000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        if (this.closed) return;
        this.status('Connecting to the encrypted room relay…');
        this.client = root.mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
          clientId: 'fc' + this.id.replaceAll('-', '').slice(0, 20),
          protocolVersion: 4, clean: true, keepalive: 20, timerVariant: 'native',
          connectTimeout: 15000, reconnectPeriod: 0, resubscribe: false,
          queueQoSZero: false
        });
        this.later(() => { if (!this.subscribed) this.fail('The room relay did not respond. Check whether your browser, VPN or firewall blocks broker.emqx.io:8084.'); }, 20000);
        this.client.on('error', error => this.fail('Room relay error: ' + error.message));
        this.client.on('close', () => this.fail('The room relay connection closed. Create or join the table again.'));
        this.client.on('message', (topic, bytes, packet) => {
          // No retained sessions or unbounded queue of messages from a public topic.
          if (packet?.retain || topic !== this.topic || bytes.length > 65536 || this.closed) return;
          this.incoming = this.incoming.then(() => this.receive(bytes)).catch(() => {});
        });
        this.client.on('connect', () => {
          this.client.subscribe(this.topic, { qos: 1 }, (error, grants) => {
            if (this.closed) return;
            if (error || !grants?.length || grants.some(g => g.qos === 128)) return this.fail('The relay refused the room subscription. Please try again.');
            this.subscribed = true;
            this.discover();
          });
        });
      } catch (error) { this.fail('Could not open the room: ' + error.message); }
    }
    discover() {
      if (this.options.isHost) {
        this.status('Checking whether this table is already open…');
        this.sendPacket('probe');
        this.sendPacket('claim');
        this.later(() => {
          this.active = true;
          this.status('Table created. Waiting for your friend to join with the same room and password…');
          this.sendPacket('presence');
        }, 2000);
      } else {
        this.status('Looking for your table… Keep the creator’s tab open.');
        this.sendPacket('join', { name: this.options.name });
        this.every(() => { if (!this.partner) this.sendPacket('join', { name: this.options.name }); }, 2000);
        this.later(() => { if (!this.partner) this.fail('No table answered. Create it first, then check that both browsers use the same room and password.'); }, 20000);
      }
      this.every(() => {
        if (this.partner) {
          if (Date.now() - this.lastSeen > 60000) return this.fail('The other player stopped responding. Keep both tabs open, then create or join a new table.');
          this.sendPacket('heartbeat', null, this.partner);
        } else if (this.active) this.sendPacket('presence');
      }, 5000);
    }
    sendPacket(kind, value = null, to = null) {
      const packet = { v: 2, id: crypto.randomUUID(), from: this.id, to, time: Date.now(), kind, value };
      this.outgoing = this.outgoing.then(async () => {
        if (this.closed || !this.client?.connected) return;
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.key, encode.encode(JSON.stringify(packet)));
        if (this.closed) return;
        const wire = JSON.stringify({ iv: base64(iv), body: base64(encrypted) });
        await new Promise((resolve, reject) => this.client.publish(this.topic, wire, { qos: 1, retain: false }, error => error ? reject(error) : resolve()));
      }).catch(error => this.fail('Could not send a room message: ' + error.message));
      return this.outgoing;
    }
    async receive(bytes) {
      let packet;
      try {
        const wire = JSON.parse(decode.decode(bytes));
        const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unbase64(wire.iv) }, this.key, unbase64(wire.body));
        packet = JSON.parse(decode.decode(plaintext));
      } catch { return; } // Ignore other users' or invalid ciphertext on the public relay.
      if (this.closed || packet.v !== 2 || typeof packet.from !== 'string' || typeof packet.id !== 'string' || typeof packet.time !== 'number' || Math.abs(Date.now() - packet.time) > 120000 || packet.from === this.id || (packet.to && packet.to !== this.id) || this.received.has(packet.id)) return;
      this.received.add(packet.id);
      if (this.received.size > 512) this.received.delete(this.received.values().next().value);
      const { kind, from, value } = packet;
      if (this.options.isHost) {
        if (kind === 'probe' || kind === 'claim') {
          if (this.active) this.sendPacket('presence', null, from);
          else if (kind === 'claim') {
            if (from < this.id) this.fail('This table is being created in another tab. Use Join table.');
            else this.sendPacket('claim', null, from);
          }
          return;
        }
        if (kind === 'presence') return this.fail('This room already exists. Use Join table, or choose a new room code.');
        if (kind === 'join' && this.active) {
          if (this.partner && this.partner !== from) return void this.sendPacket('full', null, from);
          if (!this.partner) {
            this.partner = from;
            this.lastSeen = Date.now();
            this.sendPacket('welcome', { name: this.options.name }, from);
            this.options.onConnect?.(String(value?.name || 'Guest').slice(0, 24));
          } else {
            this.sendPacket('welcome', { name: this.options.name }, from);
            this.options.onResync?.();
          }
          return;
        }
      } else if (!this.partner) {
        if (kind === 'full') return this.fail('This table already has two players. Choose another room code.');
        if (kind === 'welcome') {
          this.partner = from;
          this.lastSeen = Date.now();
          this.options.onConnect?.(String(value?.name || 'Host').slice(0, 24));
          return;
        }
      }
      if (from !== this.partner) return;
      this.lastSeen = Date.now();
      if (kind === 'leave') return this.fail('The other player left. Create or join a new table.');
      if (kind === 'data') this.options.onMessage?.(value);
    }
    send(value) { if (this.partner) return this.sendPacket('data', value, this.partner); }
    get open() { return !this.closed && !!this.partner && !!this.client?.connected; }
    close() {
      if (this.closed) return;
      if (this.partner) {
        this.sendPacket('leave', null, this.partner).finally(() => this.dispose());
        this.later(() => this.dispose(), 1000);
      } else this.dispose();
    }
    dispose() {
      if (this.closed) return;
      this.closed = true;
      this.timers.forEach(t => { clearTimeout(t); clearInterval(t); });
      this.client?.end(true);
    }
  }
  root.RelayRoom = RelayRoom;
  if (typeof module !== 'undefined') module.exports = RelayRoom;
})(globalThis);
