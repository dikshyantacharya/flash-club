/* Pure game rules; no DOM or network dependencies. */
(function(root){
function score(cards){const r=cards.map(c=>c.r).sort((a,b)=>b-a),flush=cards.every(c=>c.s===cards[0].s);let straight=0;if(r[0]-r[1]===1&&r[1]-r[2]===1)straight=r[0]===14?15:r[0];if(r.join()==='14,3,2')straight=14;if(r[0]===r[2])return[6,r[0]];if(flush&&straight)return[5,straight];if(straight)return[4,straight];if(flush)return[3,...r];if(r[0]===r[1])return[2,r[0],r[2]];if(r[1]===r[2])return[2,r[1],r[0]];return[1,...r];}
function compare(a,b){const x=score(a),y=score(b);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return Math.sign(x[i]-y[i]);return 0;}
function random(n){const a=new Uint32Array(1),limit=2**32-(2**32%n);do{crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%n;}
function create(names){return {players:names.map(name=>({name,chips:100,seen:false,cards:[]})),hand:0,pot:0,phase:'ready',log:[],ready:[false,false]};}
function log(g,s){g.log.push(s);g.log=g.log.slice(-40);}
function deal(g){if(g.phase==='playing')throw Error('Hand is still active.');if(g.players.some(p=>p.chips<5))throw Error('Both players must restart the match.');const deck=[];for(let s=0;s<4;s++)for(let r=2;r<=14;r++)deck.push({r,s});for(let i=deck.length-1;i>0;i--){const j=random(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}g.hand++;g.phase='playing';g.pot=10;g.target=1;g.wagers=0;g.turn=(g.hand-1)%2;g.ready=[false,false];g.winner=null;g.players.forEach(p=>{p.chips-=5;p.cards=deck.splice(0,3);p.seen=false;});log(g,`Hand ${g.hand}: both players ante 5.`);if(g.players.some(p=>p.chips===0))showdown(g);}
function finish(g,winner){g.phase='over';g.winner=winner;if(winner===null){g.players.forEach(p=>p.chips+=g.pot/2);log(g,'Tie. Pot split equally.');}else{g.players[winner].chips+=g.pot;log(g,`${g.players[winner].name} wins ${g.pot} chips.`);}g.pot=0;}
function showdown(g){const c=compare(g.players[0].cards,g.players[1].cards);finish(g,c===0?null:c>0?0:1);}
function limits(g,id){const p=g.players[id],q=g.players[1-id],factor=p.seen?2:1,call=g.target*5*factor;return {factor,call,show:call+5,canShow:!p.seen||q.seen,max:Math.min(Math.floor(p.chips/(5*factor)),Math.floor(q.chips/(5*(q.seen?2:1))))};}
function act(g,id,type){
  if(g.phase!=='playing'||g.turn!==id)throw Error('Wait for your turn.');
  const p=g.players[id];
  if(type==='fold'){log(g,`${p.name} folds.`);finish(g,1-id);return;}
  if(type==='see'){if(p.seen)throw Error('Cards already seen.');p.seen=true;log(g,`${p.name} sees their cards.`);return;}
  const l=limits(g,id);
  if(type==='show'){
    if(!l.canShow)throw Error('A seen player cannot Show against a blind player.');
    if(l.show>p.chips)throw Error('Not enough chips to call and pay 5 for show.');
    p.chips-=l.show;g.pot+=l.show;
    log(g,`${p.name} pays ${l.show} (${l.call} call + 5 show).`);showdown(g);return;
  }
  if(type!=='call'&&type!=='raise')throw Error('Choose call, raise, show or fold.');
  const target=type==='raise'?g.target+1:g.target,cost=target*5*l.factor;
  if(cost>p.chips||(type==='raise'&&target>l.max))throw Error('Not enough chips for this wager.');
  p.chips-=cost;g.pot+=cost;g.target=target;g.wagers++;
  log(g,`${p.name} ${type==='raise'?'raises':'bets / calls'} ${cost}${p.seen?' seen':' blind'}.`);
  // An all-in player gets one response before an automatic showdown.
  if(g.players[1-id].chips===0){showdown(g);return;}
  g.turn=1-id;
}
function view(g,id){const copy=JSON.parse(JSON.stringify(g));copy.players.forEach((p,i)=>{if(g.phase!=='over'&&(i!==id||!p.seen))p.cards=[null,null,null];});return copy;}
const api={score,compare,create,deal,act,limits,view};if(typeof module!=='undefined')module.exports=api;root.Flash=api;
})(globalThis);
