import {equal} from './firebase.mjs';
import {officer,setupPlan,SITE,safeUrl,ranks} from './policy.mjs';
import {audit,synchronizeOfficer} from './workflows.mjs';
const now=()=>new Date();
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
export const commands=[
 {name:'link',description:'Link your approved website account privately',options:[{type:3,name:'code',description:'One-time website code (expires after five minutes)',required:true}]},
 {name:'announce',description:'Publish a department announcement (owners only)'},
 {name:'training',description:'View upcoming department training'},
 {name:'roster',description:'Search officer records',options:[{type:3,name:'search',description:'Name, badge or callsign'}]},
 {name:'officer',description:'View your officer profile'},
 {name:'warrant',description:'View warrant instructions and your submissions'},
 {name:'sync',description:'Synchronize your authorized department roles'},
 {name:'setup',description:'Preview the server configuration wizard (owners only)'},
 {name:'botstatus',description:'Check serverless integration status'},
 {name:'help',description:'Show available commands'}
].map(c=>({...c,contexts:[0],integration_types:[0]}));
export async function interactionIdentity(store,interaction){
 const discordId=interaction.member?.user?.id||interaction.user?.id;
 const mapping=await store.get('discordIdentities/'+discordId);if(!mapping) return {discordId,role:null};
 const role=await store.get('userRoles/'+mapping.uid);return {discordId,uid:mapping.uid,role};
}
export async function createActivity(store,uid,entry){
 const logId=crypto.randomUUID(),jobId=crypto.randomUUID();
 await store.commit([{path:'portalLogs/'+logId,data:{...entry,actorUid:uid,createdAt:now()}},{path:'discordJobs/'+jobId,data:{kind:'activity',logId,actorUid:uid,category:entry.category,targetUid:entry.targetUid||'',status:'pending',attempts:0,createdAt:now()}}]);return jobId;
}
export async function handleInteraction(store,discord,interaction){
 const identity=await interactionIdentity(store,interaction),name=interaction.data?.name,id=interaction.data?.custom_id;
 const option=k=>interaction.data?.options?.find(o=>o.name===k)?.value;
 if(name==='link'){
  const code=String(option('code')||'');if(!/^[a-f0-9]{32}$/.test(code))throw Error('Invalid linking code.');
  const key=await hash(code),record=await store.get('discordLinkCodes/'+key);
  if(!record||record.used||Date.parse(record.expiresAt)<=Date.now())throw Error('Code is expired or already used.');
  const role=await store.get('userRoles/'+record.uid);if(!officer(role))throw Error('Website account is not an approved officer.');
  const existing=await store.get('discordLinks/'+record.uid),reverse=await store.get('discordIdentities/'+identity.discordId);
  if((existing&&existing.discordId!==identity.discordId)||(reverse&&reverse.uid!==record.uid))throw Error('An account is already linked. An owner must review any unlink request.');
  await store.commit([{path:'discordLinkCodes/'+key,data:{used:true,usedAt:now()},mask:['used','usedAt'],precondition:{updateTime:record._updateTime}},{path:'discordLinks/'+record.uid,data:{discordId:identity.discordId,linkedAt:now()},precondition:existing?{updateTime:existing._updateTime}:{exists:false}},{path:'discordIdentities/'+identity.discordId,data:{uid:record.uid,linkedAt:now()},precondition:reverse?{updateTime:reverse._updateTime}:{exists:false}}]);
  const config=await store.get('discordConfig/main');if(config)await synchronizeOfficer(store,discord,config,record.uid);
  await audit(store,record.uid,'Discord linked',identity.discordId,'success');return 'Discord account linked to your website account.';
 }
 if(!officer(identity.role))throw Error('Link an approved website account with /link first.');
 if(id?.startsWith('attend:')||id?.startsWith('unable:')){
  const eventId=id.split(':')[1],event=await store.get('calendarEvents/'+eventId);if(!event)throw Error('This event no longer exists.');
  const status=id.startsWith('attend:')?'attending':'unable';await store.set('trainingAttendance/'+eventId+'_'+identity.uid,{eventId,uid:identity.uid,status,updatedAt:now()});return 'Your attendance response is saved: '+status+'.';
 }
 if(id==='approve-server-layout'){
  if(!identity.role.admin)throw Error('Owner access required.');
  const me=await discord.api('/users/@me'),existing=await store.get('discordConfig/main')||{};
  await store.set('discordConfig/main',{...existing,botId:me.id,serverId:discord.env.DISCORD_GUILD_ID});
  await store.set('discordJobs/'+crypto.randomUUID(),{kind:'setup',payload:{approved:true},actorUid:identity.uid,status:'pending',attempts:0,createdAt:now()});
  return 'Approved. The scheduled Worker will configure the layout incrementally. Monitor the website Discord dashboard.';
 }
 if(interaction.type===5&&id==='announcement-compose'){
  if(!identity.role.admin)throw Error('Owner access required.');
  const values=Object.fromEntries(interaction.data.components.flatMap(r=>r.components).map(c=>[c.custom_id,c.value]));
  if(!values.message||values.message.length>1800)throw Error('Announcement must be 1–1,800 characters for plain Discord delivery.');
  const record={title:String(values.title||'Department Announcement').slice(0,200),message:values.message,category:'General',priority:'Normal',author:identity.role.displayName||'APD Command',pingApd:true,format:'plain',publishState:'published',createdByUid:identity.uid,updatedByUid:identity.uid,createdAt:now(),updatedAt:now()};
  const recordId=crypto.randomUUID();await store.set('announcements/'+recordId,record);
  await createActivity(store,identity.uid,{action:'Announcement Published',category:'Announcements',targetUid:recordId,targetLabel:record.title,announcement:record,message:'Published department announcement.'});return 'Announcement saved and queued for Discord delivery.';
 }
 if(name==='setup'){
  if(!identity.role.admin)throw Error('Owner access required.');
  return 'Server layout preview: '+setupPlan().length+' steps. Creates APD membership and approved rank/special roles, department channels, and restricted supervisor/CID/command categories. Existing matching channels are reused. Approve using the button below.';
 }
 if(name==='sync'){const config=await store.get('discordConfig/main');if(!config)throw Error('Server setup is not complete.');await synchronizeOfficer(store,discord,config,identity.uid);return 'Your approved department roles were synchronized. No website permissions were changed.';}
 if(name==='training'){
  const events=await store.list('calendarEvents',20);return events.filter(e=>e.date>=new Date().toISOString().slice(0,10)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,10).map(e=>e.title+' — '+e.date+' '+(e.start||'All day')).join('\n')||'No upcoming events in the current 20-event window. Full calendar: '+SITE+'training.html';
 }
 if(name==='roster'){
  const search=String(option('search')||'').toLowerCase();const people=await store.list('officerRecords',40);
  return people.filter(p=>[p.name,p.badge,p.callsign,p.rank].some(x=>String(x||'').toLowerCase().includes(search))).slice(0,10).map(p=>[p.name,p.rank,p.callsign].filter(Boolean).join(' • ')).join('\n')||'No matching officer in the current roster window.';
 }
 if(name==='officer'){const r=await store.get('officerRecords/'+identity.uid);return r?[r.name,r.rank,r.callsign,r.badge,r.division,r.status].filter(Boolean).join(' • '):'Your officer profile has not been entered by command staff.';}
 if(name==='warrant')return 'Use the existing warrant templates: '+SITE+'warrantform.html\nSubmit and track a private review at '+SITE+'officer.html';
 if(name==='botstatus')return 'Serverless HTTP integration is responding. Scheduled jobs run once per minute, subject to free quotas. Automatic membership reconciliation: '+(discord.env.RECONCILE_MEMBERS==='true'?'periodic, not instantaneous':'disabled; use /sync for onboarding');
 return 'Commands: /link, /announce (owners), /training, /roster, /officer, /warrant, /sync, /setup (owners), /botstatus, /help.';
}
