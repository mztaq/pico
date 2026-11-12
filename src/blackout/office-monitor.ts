export interface OfficeFeed {
  traffic: number;
  health: number;
  proxies: number;
  dispatchActive: boolean;
  alert: boolean;
  history: {traffic:number}[];
  requests: {status:number;path:string}[];
}
export function renderOfficeFeed(ctx:CanvasRenderingContext2D, feed:OfficeFeed):void{
  const {width,height}=ctx.canvas;
  ctx.setTransform(width/768,0,0,height/432,0,0);
  ctx.clearRect(0,0,768,432);
  ctx.fillStyle='#0c1424';ctx.fillRect(0,0,768,432);
  ctx.fillStyle='#17263a';ctx.fillRect(0,0,768,64);
  ctx.fillStyle='#e1e9fa';ctx.font='bold 25px monospace';
  ctx.fillText('SECURITY / LIVE TRAFFIC',22,40);
  ctx.fillStyle=feed.alert?'#f38ba8':'#a6e3a1';ctx.fillRect(665,24,15,15);
  ctx.font='bold 14px monospace';ctx.fillText(feed.alert?'ALERT':'ONLINE',687,38);
  ctx.fillStyle='#aebbd3';ctx.font='16px monospace';
  ctx.fillText('INBOUND REQUESTS / SECOND',22,100);
  ctx.font='bold 44px monospace';ctx.fillStyle='#f2f4fa';
  ctx.fillText(Math.round(feed.traffic).toLocaleString('en-US'),22,147);
  ctx.font='14px monospace';ctx.fillStyle='#aebbd3';
  ctx.fillText(feed.dispatchActive?'OFFICERS DEPLOYED':'CONTROL ROOM MONITORING',22,177);
  const plotX=22,plotY=204,plotW=493,plotH=160;
  ctx.strokeStyle='#34435c';ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y=plotY+i*plotH/4;
    ctx.beginPath();ctx.moveTo(plotX,y);ctx.lineTo(plotX+plotW,y);ctx.stroke();
  }
  const history=feed.history.slice(-100);
  const maxValue=Math.max(8000,feed.traffic*1.25,...history.map(v=>v.traffic*1.18));
  ctx.strokeStyle=feed.alert?'#f38ba8':'#89b4fa';ctx.lineWidth=3;
  ctx.beginPath();
  history.forEach((sample,i)=>{
    const x=plotX+i*plotW/99,y=plotY+plotH-sample.traffic*plotH/maxValue;
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  });
  ctx.lineTo(plotX+Math.max(0,history.length-1)*plotW/99,
    plotY+plotH-feed.traffic*plotH/maxValue);
  ctx.stroke();
  ctx.fillStyle='#93a3bf';ctx.font='14px monospace';
  ctx.fillText('SERVER HEALTH',552,113);
  ctx.fillStyle=feed.health<45?'#f38ba8':'#a6e3a1';
  ctx.font='bold 34px monospace';ctx.fillText(Math.round(feed.health)+'%',552,150);
  ctx.fillStyle='#93a3bf';ctx.font='14px monospace';ctx.fillText('ACTIVE PROXIES',552,194);
  ctx.fillStyle='#cba6f7';ctx.font='bold 33px monospace';
  ctx.fillText(String(feed.proxies),552,231);
  ctx.fillStyle='#93a3bf';ctx.font='14px monospace';ctx.fillText('RECENT RESPONSES',552,268);
  feed.requests.slice(-3).reverse().forEach((req,i)=>{
    ctx.fillStyle=req.status>=500?'#f38ba8':req.status===429?'#f9e2af':'#a6e3a1';
    ctx.font='13px monospace';
    ctx.fillText(req.status+'  '+req.path.slice(0,15),552,294+i*28);
  });
}
