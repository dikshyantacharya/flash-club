/* Run `node transport.test.js` or `node transport.test.js --live` for real WSS. */
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const live = process.argv.includes('--live');
const channels = new Map();
const wireMessages = [];
if (live) {
  // Select MQTT.js's browser transport, using Node's native standards-based WebSocket.
  globalThis.window = { document: {} };
  globalThis.self = globalThis;
  globalThis.mqtt = vm.runInThisContext(readFileSync('vendor/mqtt.min.js', 'utf8') + ';mqtt;');
} else {
  globalThis.mqtt = { connect() {
    const client = new EventEmitter();
    client.connected = true;
    client.subscribe = (topic, options, cb) => {
      client.topic = topic;
      if (!channels.has(topic)) channels.set(topic, new Set());
      channels.get(topic).add(client);
      queueMicrotask(() => cb(null, [{ qos: 1 }]));
    };
    client.publish = (topic, body, options, cb) => {
      wireMessages.push(body);
      setTimeout(() => {
        for (const subscriber of channels.get(topic) || []) subscriber.emit('message', topic, new TextEncoder().encode(body), {});
        cb();
      }, 1);
    };
    client.end = () => { channels.get(client.topic)?.delete(client); client.connected = false; client.emit('close'); };
    queueMicrotask(() => client.emit('connect'));
    return client;
  } };
}
const RelayRoom = require('./transport.js');
const Flash = require('./engine.js');
const rooms = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, label, ms = live ? 20000 : 6000) {
  const deadline = Date.now() + ms;
  while (!test()) { if (Date.now() > deadline) throw Error('Timed out: ' + label); await pause(30); }
}
function room(options) { const value = new RelayRoom(options); rooms.push(value); return value; }
(async () => {
  const code = 'test-' + crypto.randomUUID();
  const password = 'not-a-real-password';
  const errors = [];
  let game, guestState, hostConnected = 0;
  const host = room({ room: code, password, isHost: true, name: 'Host',
    onError: error => errors.push(error),
    onConnect: name => { hostConnected++; game = Flash.create(['Host', name]); Flash.deal(game); host.send({ type: 'state', value: Flash.view(game, 1) }); },
    onMessage: data => { if (data.type === 'action') { Flash.act(game, 1, data.action, data.amount); host.send({ type: 'state', value: Flash.view(game, 1) }); } }
  });
  await host.start();
  await until(() => host.active || errors.length, 'host registration');
  assert.deepEqual(errors, []);
  if (live) {
    // A created room must remain available beyond the relay connection timeout.
    await pause(21000);
    assert.equal(host.closed, false);
    assert.deepEqual(errors, []);
  }
  const duplicateErrors = [];
  const duplicate = room({ room: code, password, isHost: true, name: 'Duplicate', onError: e => duplicateErrors.push(e) });
  await duplicate.start();
  await until(() => duplicateErrors.length, 'duplicate host rejection');
  assert.match(duplicateErrors[0], /already exists/);
  const guest = room({ room: code, password, isHost: false, name: 'Guest', onError: e => errors.push(e), onMessage: data => { if (data.type === 'state') guestState = data.value; } });
  await guest.start();
  await until(() => guestState, 'encrypted host/guest handshake and initial cards');
  assert.equal(hostConnected, 1);
  assert.equal(guestState.players[1].name, 'Guest');
  assert(guestState.players[0].cards.every(c => c === null));
  assert(guestState.players[1].cards.every(c => c === null));
  Flash.act(game, 0, 'call');
  host.send({ type: 'state', value: Flash.view(game, 1) });
  await until(() => guestState.turn === 1, 'host action');
  guest.send({ type: 'action', action: 'see' });
  await until(() => guestState.players[1].seen, 'guest reveal');
  assert(guestState.players[1].cards.every(Boolean));
  assert(guestState.players[0].cards.every(c => c === null));
  guest.send({ type: 'action', action: 'call' });
  await until(() => guestState.turn === 0 && guestState.wagers === 2, 'call keeps hand open');
  assert.equal(guestState.phase, 'playing');
  assert(guestState.players[0].cards.every(c => c === null));
  assert.equal(Flash.limits(game, 1).canShow, false);
  Flash.act(game, 0, 'show');
  host.send({ type: 'state', value: Flash.view(game, 1) });
  await until(() => guestState.phase === 'over', 'blind host paid Show against seen guest');
  assert(guestState.players.every(p => p.cards.every(Boolean)));
  Flash.deal(game);
  host.send({ type: 'state', value: Flash.view(game, 1) });
  await until(() => guestState.hand === 2, 'next hand in same room');
  assert.equal(guestState.phase, 'playing');
  assert(guestState.players.every(p => p.cards.every(c => c === null)));
  assert.equal(game.players.reduce((n, p) => n + p.chips, 0) + game.pot, 2000);
  guest.send({ type: 'action', action: 'raise', amount: 35 });
  await until(() => guestState.turn === 0 && guestState.target === 7, 'second hand guest raise');
  Flash.act(game, 0, 'call');
  host.send({ type: 'state', value: Flash.view(game, 1) });
  await until(() => guestState.turn === 1, 'host call keeps betting open');
  guest.send({ type: 'action', action: 'show' });
  await until(() => guestState.phase === 'over', 'guest paid show');
  assert(guestState.players.every(p => p.cards.every(Boolean)));
  assert(game.log.some(s => s.includes('35 call + 5 show')));
  assert.equal(game.players.reduce((n, p) => n + p.chips, 0), 2000);
  const thirdErrors = [];
  const third = room({ room: code, password, isHost: false, name: 'Third', onError: e => thirdErrors.push(e) });
  await third.start();
  await until(() => thirdErrors.length, 'third seat rejection');
  assert.match(thirdErrors[0], /two players/);
  assert.equal(hostConnected, 1);
  if (!live) {
    const wrong = room({ room: code, password: 'incorrect', isHost: false, name: 'Wrong' });
    await wrong.start();
    await until(() => wrong.subscribed, 'wrong password subscription');
    await pause(100);
    assert.equal(wrong.partner, null);
    assert.notEqual(wrong.topic, host.topic);
    assert(wireMessages.every(body => !body.includes('Guest') && !body.includes('Host') && !body.includes(password) && !body.includes('cards')));
    // A duplicate encrypted action is delivered once; tampering is ignored.
    let messages = 0;
    guest.options.onMessage = () => messages++;
    await host.send({ type: 'probe-test' });
    await until(() => messages === 1, 'test message');
    await guest.receive(new TextEncoder().encode(wireMessages.at(-1)));
    await guest.receive(new TextEncoder().encode('{"iv":"invalid","body":"invalid"}'));
    assert.equal(messages, 1);
  }
  guest.close();
  await until(() => errors.length, 'leave notification');
  assert.match(errors[0], /other player left/);
  console.log((live ? 'LIVE WSS' : 'LOCAL') + ' PASS: encrypted room handshake, duplicate room, two-seat limit, hidden cards, host/guest actions, paid show, showdown, and leave.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { rooms.forEach(r => r.dispose()); });
