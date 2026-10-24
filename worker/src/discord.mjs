export class Discord{
 constructor(env){this.env=env;}
 async api(path,method='GET',body){
  const r=await fetch('https://discord.com/api/v10'+path,{method,headers:{Authorization:'Bot '+this.env.DISCORD_BOT_TOKEN,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(!r.ok){const e=Error('Discord request failed ('+r.status+').');e.status=r.status;if(r.status===429)e.retryAfter=Number((await r.json()).retry_after)||60;throw e;}return r.status===204?null:r.json();
 }
 async verify(request,body){
  const signature=request.headers.get('X-Signature-Ed25519'),timestamp=request.headers.get('X-Signature-Timestamp');
  if(!signature||!/^\d+$/.test(timestamp||'')||Math.abs(Date.now()/1000-Number(timestamp))>300)return false;
  try{const hex=s=>Uint8Array.from(s.match(/.{2}/g)||[],x=>parseInt(x,16));const key=await crypto.subtle.importKey('raw',hex(this.env.DISCORD_PUBLIC_KEY),{name:'Ed25519'},false,['verify']);return crypto.subtle.verify('Ed25519',key,hex(signature),new TextEncoder().encode(timestamp+body));}catch{return false;}
 }
 async followup(token,content){return this.api('/webhooks/'+this.env.DISCORD_APPLICATION_ID+'/'+token,'POST',{content:String(content).slice(0,1800),flags:64,allowed_mentions:{parse:[]}});}
}
