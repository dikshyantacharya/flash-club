const assert = require('node:assert/strict');
const F = require('./engine.js');
const hand = (r, s = [0,1,2]) => r.map((r,i) => ({r,s:s[i]}));
const fresh = () => {const g=F.create(['A','B']);F.deal(g);return g;};
const total = g => g.pot + g.players.reduce((n,p)=>n+p.chips,0);
const unchanged = (g, action, pattern) => {const before=JSON.stringify(g);assert.throws(()=>F.act(g,g.turn,action),pattern);assert.equal(JSON.stringify(g),before);};
assert(F.compare(hand([2,2,2]),hand([14,13,12],[0,0,0]))>0);
assert(F.compare(hand([14,13,12]),hand([14,2,3]))>0);
assert(F.compare(hand([14,2,3]),hand([13,12,11]))>0);
assert.equal(F.compare(hand([14,9,4]),hand([14,9,4],[1,2,3])),0);
let g=fresh();
assert.deepEqual(g.players.map(p=>p.chips),[95,95]);assert.equal(g.pot,10);
assert.equal(new Set(g.players.flatMap(p=>p.cards.map(c=>c.r+':'+c.s))).size,6);
assert(F.view(g,0).players.every(p=>p.cards.every(c=>c===null)));
assert.throws(()=>F.act(g,1,'call'),/turn/);
unchanged(g,'check',/Choose/);
// Opening blind wager 5; seen reply 10; repeated calls are fresh wagers.
F.act(g,0,'call');assert.equal(g.players[0].chips,90);
F.act(g,1,'see');assert.equal(F.limits(g,1).call,10);
assert(F.view(g,1).players[1].cards.every(Boolean));assert(F.view(g,1).players[0].cards.every(c=>c===null));
assert.equal(F.limits(g,1).canShow,false);unchanged(g,'show',/seen player cannot Show/);
F.act(g,1,'call');assert.equal(g.players[1].chips,85);assert.equal(g.pot,25);
assert.equal(F.limits(g,0).call,5);assert.equal(F.limits(g,0).show,10);
F.act(g,0,'call');assert.equal(g.players[0].chips,85);assert.equal(g.phase,'playing');
F.act(g,1,'raise');assert.equal(g.target,2);assert.equal(g.players[1].chips,65);
assert.equal(F.limits(g,0).call,10);assert.equal(F.limits(g,0).canShow,true);
F.act(g,0,'show');assert.equal(g.phase,'over');assert.equal(total(g),200);
assert(g.log.some(s=>s.includes('10 call + 5 show')));
assert(F.view(g,0).players.every(p=>p.cards.every(Boolean)));
// Both seen: either seat can request Show, including immediately after a call.
for(const showingSeat of [0,1]){
  g=fresh();F.act(g,0,'see');F.act(g,0,'call');F.act(g,1,'see');
  assert.equal(F.limits(g,1).canShow,true);
  if(showingSeat===0)F.act(g,1,'call');
  assert.equal(g.turn,showingSeat);assert.equal(F.limits(g,showingSeat).show,15);
  F.act(g,showingSeat,'show');assert.equal(g.phase,'over');assert.equal(total(g),200);
}
// Blind versus blind: either may show; seen versus blind rejects for either seat.
for(const seat of [0,1]){
  g=fresh();if(seat===1)F.act(g,0,'call');assert(F.limits(g,seat).canShow);F.act(g,seat,'show');assert.equal(g.phase,'over');
  g=fresh();if(seat===1)F.act(g,0,'call');F.act(g,seat,'see');unchanged(g,'show',/seen player cannot Show/);
}
g=fresh();g.players[0].cards=hand([2,2,2]);g.players[1].cards=hand([3,3,3]);F.act(g,0,'show');assert.equal(g.winner,1);assert.deepEqual(g.players.map(p=>p.chips),[85,115]);
g=fresh();g.players[0].cards=hand([14,9,4]);g.players[1].cards=hand([14,9,4],[1,2,3]);F.act(g,0,'show');assert.equal(g.winner,null);assert.equal(total(g),200);
g=fresh();F.act(g,0,'fold');assert.deepEqual(g.players.map(p=>p.chips),[95,105]);assert.throws(()=>F.act(g,1,'call'));
const balances=g.players.map(p=>p.chips);F.deal(g);assert.equal(g.turn,1);assert.deepEqual(g.players.map(p=>p.chips),balances.map(n=>n-5));assert.deepEqual(g.ready,[false,false]);
// Exhaustion cannot trap the game now that Check is gone.
g=fresh();for(let i=0;i<37;i++)F.act(g,g.turn,'call');assert.equal(g.phase,'playing');unchanged(g,'show',/Not enough chips/);F.act(g,g.turn,'call');assert.equal(g.phase,'over');assert.equal(total(g),200);
g=F.create(['A','B']);g.players[0].chips=5;g.players[1].chips=195;F.deal(g);assert.equal(g.phase,'over');assert.equal(total(g),200);
// Randomized legal play covers turns, doubling, raises, Show eligibility and payouts.
for(let i=0;i<300;i++){
  g=fresh();
  for(let j=0;j<100&&g.phase==='playing';j++){
    const id=g.turn;if(!g.players[id].seen&&Math.random()<.2)F.act(g,id,'see');
    const l=F.limits(g,id),chips=g.players[id].chips;
    const action=l.canShow&&l.show<=chips&&Math.random()<.25?'show':l.max>g.target&&Math.random()<.3?'raise':l.call<=chips?'call':'fold';
    F.act(g,id,action);assert.equal(total(g),200);assert(g.players.every(p=>p.chips>=0));
  }
  assert.equal(g.phase,'over');
}
console.log('PASS: antes, fresh blind/seen wagers, no Check, Show permissions in every pairing, raises, all-in responses, hidden cards, payouts, next hand and 300 simulations.');
