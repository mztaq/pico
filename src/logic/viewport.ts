type Bounds = {x:number;y:number;width:number;height:number};

export function fitCircuitBounds(bounds:Bounds,width:number,height:number) {
  if(![bounds.x,bounds.y,bounds.width,bounds.height,width,height].every(Number.isFinite)||
    width<=0||height<=0||bounds.width<0||bounds.height<0)return null;
  // SVG getBBox excludes stroke widths. Reserve eight world units per side,
  // plus screen-space padding that also works in small viewports.
  const padding=Math.min(24,width/4,height/4);
  const w=Math.max(1,bounds.width+16),h=Math.max(1,bounds.height+16);
  const zoom=Math.min(1.7,(width-2*padding)/w,(height-2*padding)/h);
  return {zoom,offset:{x:width/2-(bounds.x+bounds.width/2)*zoom,y:height/2-(bounds.y+bounds.height/2)*zoom}};
}

export function stepCircuitZoom(zoom:number,factor:number) {
  // Keep manual zoom usable below the old 35% floor, including a fitted
  // view below the ordinary manual zoom floor.
  return Math.min(2.5,Math.max(Math.min(.001,zoom),zoom*factor));
}
