import {Store,websiteUser} from './firebase.mjs';
import {Discord} from './discord.mjs';
import {commands,handleInteraction,interactionIdentity} from './interactions.mjs';
import {tick,reconcileMembers,audit,publishScheduled,trainingReminder} from './workflows.mjs';
import {redact} from './policy.mjs';
import {privateDestination,sendOnce} from './workflows.mjs';
const json=(data,status=200,headers={})=>Response.json(data,{status,headers});
export default {
 async fetch(request,env,context){
  const url=new URL(request.url),store=new Store(env),discord=new Discord(env);
  const origin=request.headers.get('Origin'),cors=origin===env.ALLOWED_ORIGIN?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
  if(url.pathname==='/health')return json({service:'Rattler Nation APD',architecture:'serverless',configured:!!(env.DISCORD_BOT_TOKEN&&env.FIREBASE_PRIVATE_KEY),membershipReconciliation:env.RECONCILE_MEMBERS==='true'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Authorization,Content-Type'}});
  if(url.pathname==='/interactions'&&request.method==='POST'){
   if(Number(request.headers.get('Content-Length')||0)>32000)return new Response('Too large',{status:413});
   const body=await request.text();if(body.length>32000||!await discord.verify(request,body))return new Response('Invalid signature',{status:401});
   let interaction;try{interaction=JSON.parse(body);}catch{return new Response('Invalid JSON',{status:400});}
   if(interaction.type===1)return json({type:1});
   if(interaction.guild_id!==env.DISCORD_GUILD_ID)return json({type:4,data:{content:'This application is restricted to the configured APD server.',flags:64}});
   if(interaction.type===2&&interaction.data?.name==='announce'){
    const identity=await interactionIdentity(store,interaction);if(!identity.role?.admin)return json({type:4,data:{content:'Owner access required.',flags:64}});
    return json({type:9,data:{custom_id:'announcement-compose',title:'Department Announcement',components:[{type:1,components:[{type:4,custom_id:'title',label:'Title',style:1,max_length:200,required:true}]},{type:1,components:[{type:4,custom_id:'message',label:'Announcement',style:2,max_length:1800,required:true}]}]}});
   }
   context.waitUntil((async()=>{
    try{
     const seen=await store.get('discordInteractions/'+interaction.id);if(seen)return;
     try{await store.commit([{path:'discordInteractions/'+interaction.id,data:{createdAt:new Date()},precondition:{exists:false}}]);}catch(e){if([409,412].includes(e.status))return;throw e;}
     const content=await handleInteraction(store,discord,interaction);
     if(interaction.data?.name==='setup')await discord.api('/webhooks/'+env.DISCORD_APPLICATION_ID+'/'+interaction.token,'POST',{content,flags:64,allowed_mentions:{parse:[]},components:[{type:1,components:[{type:2,style:4,label:'Approve Server Layout',custom_id:'approve-server-layout'}]}]});
     else await discord.followup(interaction.token,content);
    }catch(error){try{await discord.followup(interaction.token,redact(error));}catch{} }
   })());return json({type:5,data:{flags:64}});
  }
  if(url.pathname==='/forms'&&request.method==='POST'){
   const timestamp=request.headers.get('X-APD-Timestamp'),signature=request.headers.get('X-APD-Signature'),body=await request.text();
   if(!env.FORMS_HMAC_KEY||!/^\d+$/.test(timestamp||'')||!/^\w{64}$/.test(signature||'')||body.length>8000||Math.abs(Date.now()/1000-Number(timestamp))>300)return json({error:'Rejected'},401);
   const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.FORMS_HMAC_KEY),{name:'HMAC',hash:'SHA-256'},false,['verify']);
   const valid=await crypto.subtle.verify('HMAC',key,Uint8Array.from(signature.match(/.{2}/g),x=>parseInt(x,16)),new TextEncoder().encode(timestamp+'.'+body));
   if(!valid)return json({error:'Rejected'},401);
   try{
    const data=JSON.parse(body);if(!['complaint','suggestion','support'].includes(data.type)||typeof data.id!=='string'||data.id.length>200)return json({error:'Rejected'},400);
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data.type+':'+data.id))),x=>x.toString(16).padStart(2,'0')).join('');
    const config=await store.get('discordConfig/main');const name=data.type==='complaint'?'internal-affairs':data.type==='suggestion'?'suggestions':'portal-support',channel=config?.channels?.[name];
    if(data.type==='complaint')await privateDestination(discord,config,channel,'admin');
    await sendOnce(store,discord,{id:'form_'+hash},'form',channel,{content:'A new '+data.type+' was received through Google Forms. Authorized reviewers should check the private response spreadsheet.',allowed_mentions:{parse:[]}});
    return json({ok:true});
   }catch(error){return json({error:redact(error)},503);}
  }
  if(url.pathname.startsWith('/api/')&&request.method==='POST'){
   if(origin!==env.ALLOWED_ORIGIN)return json({error:'Origin rejected'},403);
   try{
    const user=await websiteUser(request,env,store);if(!user.role?.admin)return json({error:'Owner access required'},403,cors);if(user.authTime<Math.floor(Date.now()/1000)-600)return json({error:'Verify your session again before sensitive configuration.'},401,cors);
    if(url.pathname==='/api/catalog'){const channels=await discord.api('/guilds/'+env.DISCORD_GUILD_ID+'/channels'),roles=await discord.api('/guilds/'+env.DISCORD_GUILD_ID+'/roles');return json({channels:channels.filter(c=>c.type===0).map(c=>({id:c.id,name:c.name})),roles:roles.filter(r=>r.id!==env.DISCORD_GUILD_ID).map(r=>({id:r.id,name:r.name}))},200,cors);}
    if(url.pathname==='/api/register'){
     const me=await discord.api('/users/@me'),config=await store.get('discordConfig/main')||{};
     await store.set('discordConfig/main',{...config,botId:me.id,serverId:env.DISCORD_GUILD_ID});
     await discord.api('/applications/'+env.DISCORD_APPLICATION_ID+'/guilds/'+env.DISCORD_GUILD_ID+'/commands','PUT',commands);
     await audit(store,user.uid,'Register slash commands',env.DISCORD_GUILD_ID,'success');return json({ok:true},200,cors);
    }
    if(url.pathname==='/api/wake'){context.waitUntil(tick(store,discord,env));return json({ok:true},202,cors);}
   }catch(error){return json({error:redact(error)},401,cors);}
  }
  return json({error:'Not found'},404);
 },
 async scheduled(controller,env,context){
  if(!env.DISCORD_BOT_TOKEN||!env.FIREBASE_PRIVATE_KEY||!env.FIREBASE_CLIENT_EMAIL)return;
  const store=new Store(env),discord=new Discord(env);
  context.waitUntil((async()=>{try{const minute=new Date(controller.scheduledTime).getUTCMinutes();
if(minute%10===0)await reconcileMembers(store,discord,env);
else if(minute%10===5)await trainingReminder(store,discord,env);
else if(minute%5===2)await publishScheduled(store);
else await tick(store,discord,env);
if(minute%5===0){const config=await store.get('discordConfig/main');await store.set('botStatus/main',{state:'serverless ready',heartbeatAt:new Date(),serverId:env.DISCORD_GUILD_ID,roleCount:Object.keys(config?.roles||{}).length,channelCount:Object.keys(config?.channels||{}).length});}}catch(error){console.error(redact(error));}})());
 }
};
