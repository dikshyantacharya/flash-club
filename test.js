const assert=require('node:assert/strict');
const F=require('./engine.js');
const hand=(r,s=[0,1,2])=>r.map((r,i)=>({r,s:s[i]}));
assert(F.compare(hand([2,2,2]),hand([14,13,12],[0,0,0]))>0);
assert(F.compare(hand([14,13,12]),hand([14,2,3]))>0);
assert(F.compare(hand([14,2,3]),hand([13,12,11]))>0);
assert.equal(F.compare(hand([14,9,4]),hand([14,9,4],[1,2,3])),0);
let g=F.create(['A','B']);F.deal(g);assert.equal(g.pot,10);assert.equal(new Set(g.players.flatMap(p=>p.cards.map(c=>c.r+':'+c.s))).size,6);
assert(F.view(g,0).players.every(p=>p.cards.every(c=>c===null)));
assert.throws(()=>F.act(g,1,'raise'));F.act(g,0,'raise');assert.equal(g.players[0].chips,90);F.act(g,1,'see');assert(F.view(g,1).players[1].cards.every(Boolean));assert(F.view(g,0).players[1].cards.every(c=>c===null));assert.equal(F.limits(g,1).call,10);assert.throws(()=>F.act(g,1,'check'));F.act(g,1,'raise');assert.equal(g.players[1].chips,75);F.act(g,0,'call');assert.equal(g.phase,'playing');assert.equal(g.turn,1);assert.equal(g.pot,40);assert(F.view(g,0).players[1].cards.every(c=>c===null));F.act(g,1,'raise');assert.equal(g.phase,'playing');F.act(g,0,'call');F.act(g,1,'check');assert.equal(g.phase,'playing');F.act(g,0,'check');assert.equal(g.phase,'over');assert(F.view(g,0).players.every(p=>p.cards.every(Boolean)));assert.equal(g.players.reduce((a,p)=>a+p.chips,0),200);
F.deal(g);assert.equal(g.turn,1);F.act(g,1,'check');F.act(g,0,'check');assert.equal(g.phase,'over');
g=F.create(['A','B']);F.deal(g);F.act(g,0,'fold');assert.equal(g.players[1].chips,105);assert.equal(g.players[0].chips,95);assert.throws(()=>F.act(g,1,'raise'));
g=F.create(['A','B']);F.deal(g);g.players[0].cards=hand([14,9,4]);g.players[1].cards=hand([14,9,4],[1,2,3]);F.act(g,0,'check');F.act(g,1,'check');assert.equal(g.winner,null);assert.deepEqual(g.players.map(p=>p.chips),[100,100]);
g=F.create(['A','B']);F.deal(g);while(g.target<19)F.act(g,g.turn,'raise');assert.throws(()=>F.act(g,g.turn,'raise'));F.act(g,g.turn,'call');assert.equal(g.phase,'playing');F.act(g,g.turn,'check');F.act(g,g.turn,'check');assert.equal(g.phase,'over');assert.equal(g.players.reduce((a,p)=>a+p.chips,0),200);
for(let i=0;i<300;i++){g=F.create(['A','B']);F.deal(g);for(let j=0;j<100&&g.phase==='playing';j++){let id=g.turn,l=F.limits(g,id);let action=l.max>g.target&&Math.random()<.65?'raise':l.call?'call':'check';F.act(g,id,action);assert.equal(g.players.reduce((a,p)=>a+p.chips,0)+g.pot,200);assert(g.players.every(p=>p.chips>=0));}assert.equal(g.phase,'over');}
console.log('Passed: rankings, deals, hidden cards, turns, blind/seen costs, raises, showdown, checks, and 300 chip-conservation simulations.');

// Consecutive checks reset after betting; completed hands carry balances forward.
g=F.create(['A','B']);F.deal(g);F.act(g,0,'check');F.act(g,1,'raise');F.act(g,0,'call');F.act(g,1,'check');assert.equal(g.phase,'playing');F.act(g,0,'check');assert.equal(g.phase,'over');const balances=g.players.map(p=>p.chips);F.deal(g);assert.deepEqual(g.players.map(p=>p.chips),balances.map(n=>n-5));assert.equal(g.hand,2);assert.deepEqual(g.ready,[false,false]);assert(F.view(g,0).players.every(p=>p.cards.every(c=>c===null)));

// Paid show: settle immediately; flat fee is added to the pot, never doubled.
function total(g){return g.pot+g.players.reduce((n,p)=>n+p.chips,0);}
g=F.create(['A','B']);F.deal(g);F.act(g,0,'raise');assert.equal(F.limits(g,1).show,10);F.act(g,1,'show');assert.equal(g.phase,'over');assert.equal(g.players[1].units,1);assert.equal(total(g),200);assert(F.view(g,0).players.every(p=>p.cards.every(Boolean)));assert(g.log.some(s=>s.includes('5 call + 5 show')));
g=F.create(['A','B']);F.deal(g);F.act(g,0,'raise');F.act(g,1,'see');assert.equal(F.limits(g,1).show,15);F.act(g,1,'show');assert.equal(g.phase,'over');assert.equal(total(g),200);assert(g.log.some(s=>s.includes('10 call + 5 show')));
g=F.create(['A','B']);F.deal(g);F.act(g,0,'raise');F.act(g,1,'call');assert.equal(F.limits(g,0).show,5);F.act(g,0,'show');assert.equal(g.phase,'over');assert.equal(total(g),200);
g=F.create(['A','B']);F.deal(g);F.act(g,0,'check');assert.equal(F.limits(g,1).show,5);F.act(g,1,'show');assert.equal(g.phase,'over');assert.equal(total(g),200);
g=F.create(['A','B']);F.deal(g);g.players[0].cards=hand([2,2,2]);g.players[1].cards=hand([3,3,3]);F.act(g,0,'show');assert.equal(g.winner,1);assert.deepEqual(g.players.map(p=>p.chips),[90,110]);
g=F.create(['A','B']);F.deal(g);g.players[0].cards=hand([14,9,4]);g.players[1].cards=hand([14,9,4],[1,2,3]);F.act(g,0,'show');assert.equal(g.winner,null);assert.equal(total(g),200);
g=F.create(['A','B']);F.deal(g);while(g.target<19)F.act(g,g.turn,'raise');let snapshot=JSON.stringify(g);assert.throws(()=>F.act(g,g.turn,'show'),/Not enough chips/);assert.equal(JSON.stringify(g),snapshot);F.act(g,g.turn,'call');F.act(g,g.turn,'check');F.act(g,g.turn,'check');assert.equal(g.phase,'over');assert.equal(total(g),200);
console.log('Paid show passed: blind/seen, matched bets, one check, winner payout, ties, and insufficient chips.');
