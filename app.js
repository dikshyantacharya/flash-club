"use strict";
const $ = id => document.getElementById(id);
let link, game, state, seat = 0, host = false, busy = false, session = 0;
const status = message => $('connection-status').textContent = message;
function stop(message) {
  session++;
  busy = false;
  const previous = link;
  link = null;
  previous?.close();
  $('lobby').hidden = false;
  $('game').hidden = true;
  status(message);
  document.querySelectorAll('#room-form button').forEach(b => b.disabled = false);
}
function update() {
  state = Flash.view(game, 0);
  render();
  if (link?.open) link.send({ type: 'state', value: Flash.view(game, 1) });
}
function command(id, type) {
  try {
    if (type === 'ready') {
      if (game.phase === 'playing') throw Error('Finish this hand first.');
      game.ready[id] = true;
      if (game.ready.every(Boolean)) {
        if (game.players.some(p => p.chips < 5)) game = Flash.create(game.players.map(p => p.name));
        Flash.deal(game);
      }
    } else Flash.act(game, id, type);
    update();
  } catch (error) {
    if (id === 0) $('notice').textContent = error.message;
    else link?.send({ type: 'error', message: error.message });
  }
}
$('room-form').addEventListener('submit', event => {
  event.preventDefault();
  if (busy) return;
  const name = $('name').value.trim();
  const room = $('room').value.trim().toLowerCase();
  const password = $('password').value;
  if (!name) return status('Please enter your name.');
  if (!window.RelayRoom || !window.mqtt) return status('Game files did not load. Refresh this page and try again.');
  host = event.submitter?.value !== 'join';
  seat = host ? 0 : 1;
  busy = true;
  const token = ++session;
  document.querySelectorAll('#room-form button').forEach(b => b.disabled = true);
  link = new RelayRoom({
    room, password, name, isHost: host,
    onStatus: message => { if (token === session) status(message); },
    onError: message => { if (token === session) stop(message); },
    onConnect: guestName => {
      if (token !== session) return;
      $('room-label').textContent = 'ROOM / ' + room.toUpperCase();
      if (host) {
        game = Flash.create([name, guestName]);
        Flash.deal(game);
        $('lobby').hidden = true;
        $('game').hidden = false;
        update();
      } else status('Connected. Taking your seat…');
    },
    onResync: () => { if (token === session && host) update(); },
    onMessage: data => {
      if (token !== session || !data || typeof data !== 'object') return;
      if (host) {
        if (data.type === 'action' && typeof data.action === 'string') command(1, data.action);
      } else if (data.type === 'state') {
        state = data.value;
        $('lobby').hidden = true;
        $('game').hidden = false;
        render();
      } else if (data.type === 'error') $('notice').textContent = String(data.message);
    }
  });
  link.start();
});
$('leave').onclick = () => stop('You left the table.');
window.addEventListener('pagehide', () => link?.close());
function card(c){const el=document.createElement('div');el.className='card';if(!c){el.classList.add('back');el.textContent='♠';el.setAttribute('aria-label','Hidden card');return el;}if(c.s===1||c.s===2)el.classList.add('red');el.textContent=({11:'J',12:'Q',13:'K',14:'A'})[c.r]||c.r;const suit=document.createElement('span');suit.textContent=['♠','♥','♦','♣'][c.s];el.append(suit);return el;}
function render(){if(!state)return;const me=state.players[seat],active=state.phase==='playing'&&state.turn===seat;for(const [id,i]of [['you',seat],['opponent',1-seat]]){const p=state.players[i],box=$(id);box.replaceChildren();const title=document.createElement('h3');title.textContent=p.name+(i===seat?' · You':'')+(state.phase==='playing'&&state.turn===i?' · TO PLAY':'');if(state.turn===i)title.className='active';const sub=document.createElement('small');sub.textContent=`${p.chips} chips · ${p.seen?'Seen':'Blind'}`;const cards=document.createElement('div');cards.className='cards';p.cards.forEach(c=>cards.append(card(c)));box.append(title,sub,cards);}$('pot').textContent=state.pot;$('notice').textContent=state.phase==='over'?(state.winner===null?'Split pot.':state.players[state.winner].name+' takes the pot!'):active?'Your move. Trust your instinct.':state.players[1-seat].name+' is thinking…';const actions=$('actions');actions.replaceChildren();const button=(text,type,enabled=true)=>{const b=document.createElement('button');b.textContent=text;b.disabled=!enabled;b.onclick=()=>{if(host)command(0,type);else if(link?.open)link.send({type:'action',action:type});};actions.append(b);};if(state.phase!=='playing'){button(state.ready[seat]?'Waiting for rival…':state.players.some(p=>p.chips<5)?'Agree to restart · 100 each':'Ready for next hand','ready',!state.ready[seat]);$('bet-info').textContent='Both players must be ready to deal.';}else{const l=Flash.limits(state,seat);button('See cards','see',active&&!me.seen);button('Check','check',active&&l.call===0);button('Call '+l.call,'call',active&&l.call>0&&l.call<=me.chips);const cost=(state.target+1-me.units)*5*l.factor;button((state.target?'Raise':'Bet')+' '+cost,'raise',active&&state.target+1<=l.max);button('Fold','fold',active);$('bet-info').textContent=`Hand ${state.hand} · ${me.seen?'Seen: 10':'Blind: 5'} chips per unit · A call goes to showdown.`;}$('history').replaceChildren();state.log.slice().reverse().forEach(t=>{const li=document.createElement('li');li.textContent=t;$('history').append(li);});}
