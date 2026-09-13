(() => {
const yard=[
'11111111111111111111',
'10000000000000000001',
'10000000000000000001',
'10002220000003330001',
'10002000000000030001',
'10000000000000000001',
'10000000111000000001',
'10000000111000000001',
'10011000000000110001',
'10011000000000110001',
'10000000000000000001',
'10000000000000000001',
'10000033000022000001',
'10000030000002000001',
'10000000000000000001',
'10000000011000000001',
'10022000011000330001',
'10000000000000000001',
'10000000000000000001',
'11111111111111111111'];
const warehouse=Array.from({length:20},(_,y)=>Array.from({length:20},(_,x)=>x===0||y===0||x===19||y===19?'1':'0'));
for(let i=4;i<=15;i++){if(i!==7&&i!==12){warehouse[4][i]='1';warehouse[15][i]='1';}if(i!==8&&i!==11){warehouse[i][4]='1';warehouse[i][15]='1';}}
for(const [x,y,type] of [[7,7,'2'],[8,7,'2'],[11,12,'3'],[12,12,'3'],[12,6,'2'],[6,12,'3'],[2,8,'3'],[17,11,'2']])warehouse[y][x]=type;
const make=()=>Array.from({length:20},(_,y)=>Array.from({length:20},(_,x)=>x===0||y===0||x===19||y===19?'1':'0')),finish=m=>m.map(row=>row.join(''));
const harbor=make();
for(const [x,y,t] of [[4,3,'2'],[5,3,'2'],[10,3,'3'],[14,3,'2'],[15,3,'2'],[4,7,'3'],[9,7,'2'],[10,7,'2'],[15,7,'3'],[4,12,'2'],[9,12,'3'],[10,12,'3'],[15,12,'2'],[4,16,'3'],[5,16,'3'],[10,16,'2'],[14,16,'3'],[15,16,'3']])harbor[y][x]=t;
for(let y=5;y<15;y++)if(![9,10].includes(y))harbor[y][7]='1';
const metro=make();
for(let y=3;y<=16;y++)for(let x=3;x<=16;x++)if((x<7||x>12)&&(y<7||y>12))metro[y][x]='1';
for(const [x,y,t] of [[9,4,'2'],[10,4,'3'],[4,9,'3'],[15,10,'2'],[9,15,'3'],[10,15,'2'],[8,8,'2'],[11,11,'3']])metro[y][x]=t;
const lab=make();
for(let x=4;x<=15;x++){if(![6,10,14].includes(x))lab[5][x]='1';if(![5,9,13].includes(x))lab[14][x]='1';}
for(let y=5;y<=14;y++){if(![7,11].includes(y))lab[y][6]='1';if(![8,12].includes(y))lab[y][13]='1';}
for(const [x,y,t] of [[3,9,'2'],[9,3,'3'],[16,10,'2'],[10,16,'3'],[9,9,'2'],[10,10,'3']])lab[y][x]=t;
const outpost=make();
for(let x=5;x<=14;x++){if(![8,11].includes(x)){outpost[6][x]='1';outpost[13][x]='1';}}
for(let y=7;y<=12;y++){if(y!==9)outpost[y][5]='1';if(y!==10)outpost[y][14]='1';}
for(const [x,y,t] of [[3,3,'2'],[16,3,'3'],[3,16,'3'],[16,16,'2'],[8,9,'2'],[11,10,'3']])outpost[y][x]=t;
window.TriadMaps={yard:{name:'더스트라인 야드',description:'야외 · 중거리 · 컨테이너 엄폐',grid:yard},warehouse:{name:'블랙사이트 창고',description:'실내 · 근거리 · 교차 통로',grid:finish(warehouse)},harbor:{name:'아이언포트 항만',description:'장거리 · 화물 레인 · 측면 침투',grid:finish(harbor)},metro:{name:'네온시티 교차로',description:'도심 · 사거리 교차 · 건물 엄폐',grid:finish(metro)},lab:{name:'아크랩 연구시설',description:'실내 · 다중 격실 · 기습 동선',grid:finish(lab)},outpost:{name:'화이트아웃 전초기지',description:'혼합 거리 · 중앙 요새 · 외곽 순환',grid:finish(outpost)}};
})();

