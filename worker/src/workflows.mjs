import {authorized,officer,setupPlan,ranks,specials,snowflake,safeUrl,announcementPayload,redact,SITE} from './policy.mjs';
import {equal} from './firebase.mjs';
import {announcementDiscordPayload} from '../../announcement-discord.js';
import {departmentDiscordPayload} from '../../department-discord.js';
const now=()=>new Date();
const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
export async function audit(store,actor,action,target,outcome){await store.set('securityAudit/'+crypto.randomUUID(),{actor,action,target,outcome,createdAt:now()});}
export async function privateDestination(discord,config,id,kind){
 if(!snowflake(id))throw Error('Private notification channel is not configured.');
 const channel=await discord.api('/channels/'+id);if(channel.guild_id!==discord.env.DISCORD_GUILD_ID)throw Error('Channel belongs to another server.');
 const view=1024n,overwrites=channel.permission_overwrites||[];
 const everyone=overwrites.find(x=>x.id===discord.env.DISCORD_GUILD_ID);
 if(!everyone||(BigInt(everyone.deny||0)&view)===0n)throw Error('Private channel must explicitly deny @everyone viewing.');
 const allowed=new Set([config.roles?.['Department Administration'],config.roles?.['Command Staff'],...(kind==='cid'?[config.roles?.['Criminal Investigations']]:kind==='supervisor'?ranks.slice(5).map(r=>config.roles?.[r]):[])].filter(Boolean));
 for(const o of overwrites){if((BigInt(o.allow||0)&view)!==0n&&!allowed.has(o.id)&&o.id!==config.botId)throw Error('Private channel has an unexpected access grant.');}
 return channel;
}
export async function sendOnce(store,discord,job,route,channelId,payload){
 if(!snowflake(channelId))throw Error('Discord destination is not configured.');
 const id=await digest(job.id+':'+route),path='discordReceipts/'+id,receipt=await store.get(path);
 if(receipt?.state==='sent')return receipt.messageId;
 if(receipt?.state==='sending'&&Date.now()-Date.parse(receipt.startedAt)>120000){const e=Error('Delivery outcome needs manual verification before retrying; automatic duplicate avoided.');e.manual=true;throw e;}
 await store.set(path,{state:'sending',jobId:job.id,channelId,startedAt:receipt?.startedAt?new Date(receipt.startedAt):now()});
 const nonce=(BigInt('0x'+id.slice(0,15))).toString();
 const message=await discord.api('/channels/'+channelId+'/messages','POST',{...payload,nonce,enforce_nonce:true});
 await store.set(path,{state:'sent',jobId:job.id,channelId,messageId:message.id,sentAt:now()});return message.id;
}
export async function setupStep(store,discord,job,config){
 if(job.payload?.approved!==true)throw Error('Server layout approval is required.');
 const plan=setupPlan(),index=job.setupStep||0,step=plan[index];if(!step)return {done:true};
 config.roles||={};config.channels||={};config.categories||={};
 const guild=discord.env.DISCORD_GUILD_ID;
 if(step.kind==='role'){
  const roles=await discord.api('/guilds/'+guild+'/roles');let role=roles.find(r=>r.name===step.name&&!r.managed);
  if(role&&BigInt(role.permissions||0)!==0n)throw Error('Existing role '+step.name+' has permissions; review it before reuse.');
  role||=await discord.api('/guilds/'+guild+'/roles','POST',{name:step.name,permissions:'0',mentionable:false});config.roles[step.name]=role.id;if(step.name==='APD')config.apdRoleId=role.id;
 }else{
  const all=await discord.api('/guilds/'+guild+'/channels');
  const accessRoles=step.access==='apd'?[config.apdRoleId]:[config.roles['Department Administration'],config.roles['Command Staff'],...(step.access==='cid'?[config.roles['Criminal Investigations']]:step.access==='supervisor'?ranks.slice(5).map(r=>config.roles[r]):[])];
  const overwrites=[{id:guild,type:0,deny:'1024',allow:'0'},...accessRoles.filter(Boolean).map(id=>({id,type:0,allow:'1024',deny:'0'})),{id:config.botId,type:1,allow:'3072',deny:'0'}];
  const parent=step.kind==='channel'?config.categories[step.parent]:undefined;
  let channel=all.find(c=>c.name===step.name&&c.type===(step.kind==='category'?4:0)&&(step.kind!=='channel'||c.parent_id===parent));
  if(channel){channel=await discord.api('/channels/'+channel.id,'PATCH',{permission_overwrites:overwrites,...(parent?{parent_id:parent}:{})});}
  else channel=await discord.api('/guilds/'+guild+'/channels','POST',{name:step.name,type:step.kind==='category'?4:0,permission_overwrites:overwrites,...(parent?{parent_id:parent}:{})});
  if(step.kind==='category')config.categories[step.name]=channel.id;else config.channels[step.name]=channel.id;
 }
 Object.assign(config,{announcementsPublish:config.channels['department-announcements']||'',announcementLogs:config.channels['website-activity-logs']||'',calendarPublish:config.channels['department-calendar']||'',calendarLogs:config.channels['website-activity-logs']||'',cidPublish:config.channels['cid-announcements']||'',cidLogs:config.channels['cid-case-updates']||''});
 await store.set('discordConfig/main',config);return {done:index+1>=plan.length,next:index+1,total:plan.length};
}
export async function synchronizeOfficer(store,discord,config,uid){
 const role=await store.get('userRoles/'+uid),link=await store.get('discordLinks/'+uid);if(!link)return;
 const member=await discord.api('/guilds/'+discord.env.DISCORD_GUILD_ID+'/members/'+link.discordId);
 const record=await store.get('officerRecords/'+uid);const managed=new Set([...ranks,...specials.filter(x=>x!=='APD Bot')].map(r=>config.roles?.[r]).filter(Boolean));
 const wanted=new Set(member.roles.filter(id=>!managed.has(id)));
 if(config.apdRoleId)wanted.add(config.apdRoleId);
 if(officer(role)&&ranks.includes(record?.rank)&&config.roles?.[record.rank])wanted.add(config.roles[record.rank]);
 if(role?.admin&&config.roles?.['Department Administration'])wanted.add(config.roles['Department Administration']);
 if(role?.cidEditor&&config.roles?.['Criminal Investigations'])wanted.add(config.roles['Criminal Investigations']);
 for(const assignment of record?.specialAssignments||[])if(officer(role)&&specials.includes(assignment)&&!['APD Bot','Department Administration','Criminal Investigations'].includes(assignment)&&config.roles?.[assignment])wanted.add(config.roles[assignment]);
 await discord.api('/guilds/'+discord.env.DISCORD_GUILD_ID+'/members/'+link.discordId,'PATCH',{roles:[...wanted]});
}
export async function processJob(store,discord,job,config){
 const role=await store.get('userRoles/'+job.actorUid);if(!authorized(role,job))throw Error('Sender is no longer authorized for this operation.');
 if(job.kind==='setup'){const result=await setupStep(store,discord,job,config);return result.done?{done:true}:{continue:true,setupStep:result.next};}
 if(job.kind==='configure'){
  const allowed=['apdRoleId','announcementsPublish','announcementLogs','calendarPublish','calendarLogs','cidPublish','cidLogs'];
  for(const [k,v] of Object.entries(job.payload||{})){if(k==='reminderMinutes'){if(!Array.isArray(v)||v.length>3||v.some(n=>!Number.isInteger(n)||n<15||n>1440))throw Error('Use up to three reminder intervals between 15 and 1440 minutes.');config[k]=[...new Set(v)];continue;}if(k==='allowedMentionRoleIds'){if(!Array.isArray(v)||v.length>5||v.some(id=>!snowflake(id)||id===discord.env.DISCORD_GUILD_ID))throw Error('Invalid mention role list.');const roles=await discord.api('/guilds/'+discord.env.DISCORD_GUILD_ID+'/roles');if(v.some(id=>!roles.some(r=>r.id===id)))throw Error('Mention role belongs to another server.');config[k]=v;continue;}if(v==='')continue;if(!allowed.includes(k)||!snowflake(v))throw Error('Invalid channel or role configuration.');if(k==='apdRoleId'){const roles=await discord.api('/guilds/'+discord.env.DISCORD_GUILD_ID+'/roles');if(v===discord.env.DISCORD_GUILD_ID||!roles.some(r=>r.id===v))throw Error('Invalid APD membership role.');}if(k!=='apdRoleId'){const ch=await discord.api('/channels/'+v);if(ch.guild_id!==discord.env.DISCORD_GUILD_ID)throw Error('Channel belongs to another server.');}config[k]=v;}
  await store.set('discordConfig/main',config);return {done:true};
 }
 if(job.kind==='syncRoles'){const links=await store.list('discordLinks',1,undefined,job.syncAfter);if(links.length){await synchronizeOfficer(store,discord,config,links[0].id);return {continue:true,syncAfter:links[0].id};}return {done:true,note:'Linked officers synchronized.'};}
 if(job.kind==='rank'){
  const {uid,rank}=job.payload||{};if(!ranks.includes(rank)||typeof uid!=='string'||uid===job.actorUid)throw Error('Invalid rank change or self-promotion attempt.');
  await store.set('officerRecords/'+uid,{rank,updatedAt:now(),updatedBy:job.actorUid},['rank','updatedAt','updatedBy']);await synchronizeOfficer(store,discord,config,uid);return {done:true};
 }
 if(job.kind==='retry'){
  const failed=await store.get('discordJobs/'+job.payload?.id);if(!failed||!['failed','manual_review'].includes(failed.status))throw Error('No failed job selected.');
  if(failed.status==='manual_review')throw Error('Inspect Discord before retrying uncertain deliveries; use the receipt recovery procedure.');
  await store.set('discordJobs/'+failed.id,{status:'pending',error:'',attempts:0},['status','error','attempts']);return {done:true};
 }
 if(job.kind==='attendance'){
  const p=job.payload||{},event=await store.get('calendarEvents/'+p.eventId);if(!event)throw Error('Training event not found.');
  if(!['attending','unable'].includes(p.status))throw Error('Invalid attendance response.');
  await store.set('trainingAttendance/'+p.eventId+'_'+job.actorUid,{eventId:p.eventId,uid:job.actorUid,status:p.status,updatedAt:now()});return {done:true};
 }
 if(job.kind==='submission'){
  const type=job.payload?.type,id=job.payload?.id;const collections={warrant:'warrantSubmissions',ois:'oisSubmissions',support:'supportRequests',suggestion:'supportRequests',complaint:'supportRequests',request:'supportRequests'};
  if(!collections[type]||typeof id!=='string')throw Error('Invalid submission.');const record=await store.get(collections[type]+'/'+id);if(!record||record.ownerUid!==job.actorUid)throw Error('Submission ownership mismatch.');if(record.type!==type||!Array.isArray(record.links)||record.links.length>10||record.links.some(link=>!safeUrl(link)))throw Error('Invalid submission links or type.');if(type==='warrant'&&!record.links.length)throw Error('Warrant document required.');
  const name=type==='warrant'?'warrant-review':type==='ois'?'ois-evidence-review':type==='complaint'?'internal-affairs':type==='suggestion'?'suggestions':'portal-support';
  const channel=config.channels?.[name];if(['warrant','ois','complaint'].includes(type))await privateDestination(discord,config,channel,type==='warrant'||type==='ois'?'supervisor':'admin');
  const payload={content:'New '+type+' submission. Authorized reviewers: '+SITE+'officer.html',allowed_mentions:{parse:[]}};
  return {done:true,messageId:await sendOnce(store,discord,job,'submission',channel,payload)};
 }
 if(job.kind==='review'){
  const {type,id,status,notes=''}=job.payload||{};const coll=type==='warrant'?'warrantSubmissions':type==='ois'?'oisSubmissions':null;
  const statuses=type==='warrant'?['Approved','Rejected','Correction Requested']:['Pending Review','Accepted','Correction Requested','Missing Footage / Documented Exception'];
  if(!coll||!statuses.includes(status)||typeof id!=='string')throw Error('Invalid review.');const record=await store.get(coll+'/'+id);if(!record)throw Error('Submission not found.');if(record.ownerUid===job.actorUid)throw Error('A different authorized reviewer must review your own submission.');
  await store.set(coll+'/'+id,{status,reviewNotes:String(notes).slice(0,2000),reviewedBy:job.actorUid,reviewedAt:now()},['status','reviewNotes','reviewedBy','reviewedAt']);
  await store.set('officerNotifications/'+job.id,{uid:record.ownerUid,message:type+' submission status: '+status,createdAt:now()});return {done:true};
 }
 if(job.kind!=='activity')throw Error('Unknown job kind.');
 const entry=await store.get('portalLogs/'+job.logId);if(!entry||entry.actorUid!==job.actorUid||entry.category!==job.category||entry.targetUid!==job.targetUid)throw Error('Delivery job does not match its immutable audit record.');
 entry.actorDisplayName=role.displayName||'APD Staff';
 if(entry.category==='Access'){
  if(entry.targetUid)await synchronizeOfficer(store,discord,config,entry.targetUid);
  return {done:true};
 }
 const isNew=entry.action==='Announcement Published'||entry.action==='Calendar Event Created'||entry.action==='CID Case Created';
 const isEdit=/Updated|Edited/.test(entry.action),isDelete=/Deleted|Removed/.test(entry.action);
 const prefix=entry.category==='Announcements'?'announcements':entry.category==='Calendar'?'calendar':entry.category==='CID'?'cid':null;
 if(!prefix)return {done:true};
 let record=entry.category==='Announcements'?await store.get('announcements/'+entry.targetUid):entry.category==='Calendar'?await store.get('calendarEvents/'+entry.targetUid):null;
 if(entry.category==='Announcements'&&!role.admin)throw Error('Department announcements require an owner.');
 if(entry.category==='Announcements'&&record?.publishState==='draft')return {done:true,note:'Draft saved; no Discord publication.'};
 if(record?.scheduledFor&&Date.parse(record.scheduledFor)>Date.now())return {deferUntil:record.scheduledFor};
 const refPath='discordMessageRefs/'+prefix+'_'+entry.targetUid,ref=await store.get(refPath);let messageId;
 if(isNew||isEdit){
  if(['Announcements','Calendar'].includes(entry.category)&&!record)throw Error('Published source no longer exists.');
  const channel=config[prefix+'Publish'];
  if(entry.category==='CID')await privateDestination(discord,config,channel,'cid');
  let payload=entry.category==='Announcements'?announcementPayload(record,config,!!ref):departmentDiscordPayload(entry,true);
  if(entry.category==='Calendar'){
   payload.components=[{type:1,components:[{type:2,style:3,label:'Attending',custom_id:'attend:'+entry.targetUid},{type:2,style:2,label:'Unable to Attend',custom_id:'unable:'+entry.targetUid},{type:2,style:5,label:'View Event',url:SITE+'training.html'}]}];
  }
  if(ref?.messageId){await discord.api('/channels/'+ref.channelId+'/messages/'+ref.messageId,'PATCH',payload);messageId=ref.messageId;}
  else{messageId=await sendOnce(store,discord,job,'publish',channel,payload);await store.set(refPath,{channelId:channel,messageId,sourceId:entry.targetUid,updatedAt:now()});}
 }
 if(isDelete&&ref?.messageId){try{await discord.api('/channels/'+ref.channelId+'/messages/'+ref.messageId,'DELETE');}catch(e){if(e.status!==404)throw e;}await store.set(refPath,{removed:true,updatedAt:now()},['removed','updatedAt']);}
 if(isDelete&&entry.category==='Calendar')await sendOnce(store,discord,job,'cancellation',config.calendarPublish,{content:'Training event cancelled: '+String(entry.calendarEvent?.title||entry.targetLabel||'Department event').slice(0,200)+'. Check the department calendar for updates.',allowed_mentions:{parse:[]}});
 const logChannel=config[prefix==='announcements'?'announcementLogs':prefix+'Logs'];
 if(logChannel){await privateDestination(discord,config,logChannel,entry.category==='CID'?'cid':'admin');const payload=entry.category==='Announcements'?announcementDiscordPayload(entry,false):departmentDiscordPayload(entry,false);await sendOnce(store,discord,job,'log',logChannel,payload);}
 return {done:true,...(messageId?{messageId}:{})};
}
export async function tick(store,discord,env){
 const config=await store.get('discordConfig/main');if(!config)return;
 const due=(status,field)=>({compositeFilter:{op:'AND',filters:[equal('status',status),{fieldFilter:{field:{fieldPath:field},op:'LESS_THAN_OR_EQUAL',value:{timestampValue:new Date().toISOString()}}}]}});
 // Read only eligible jobs so future retries cannot hide newly queued work.
 let jobs=await store.list('discordJobs',1,equal('status','pending'));
 if(!jobs.length)jobs=await store.list('discordJobs',1,due('retry','nextAttemptAt'));
 if(!jobs.length)jobs=await store.list('discordJobs',1,due('processing','leaseUntil'));
 const job=jobs[0];
 if(!job)return;
 const budgetPath='botBudgets/'+new Date().toISOString().slice(0,10),budget=await store.get(budgetPath),count=budget?.jobs||0;
 if(count>=Number(env.DAILY_JOB_LIMIT||300))return;
 try{
  await store.commit([{path:'discordJobs/'+job.id,data:{status:'processing',leaseUntil:new Date(Date.now()+120000),attempts:(job.attempts||0)+1},mask:['status','leaseUntil','attempts'],precondition:{updateTime:job._updateTime}},{path:budgetPath,data:{jobs:count+1},precondition:budget?{updateTime:budget._updateTime}:{exists:false}}]);
 }catch(e){if([409,412].includes(e.status))return;throw e;}
 try{
  const result=await processJob(store,discord,job,config);
  const status=result.continue?'pending':result.deferUntil?'retry':'delivered';
  const data={...result,status,finishedAt:now(),error:'',nextAttemptAt:result.deferUntil?new Date(result.deferUntil):now()};await store.set('discordJobs/'+job.id,data,Object.keys(data));
 }catch(error){
  const attempts=(job.attempts||0)+1;const data={status:error.manual?'manual_review':attempts>=5||/authorized|Invalid|mismatch|require an owner/.test(error.message)?'failed':'retry',error:redact(error),nextAttemptAt:new Date(Date.now()+Math.max(error.retryAfter||0,Math.min(1800,30*2**attempts))*1000),finishedAt:now()};await store.set('discordJobs/'+job.id,data,Object.keys(data));
  await audit(store,job.actorUid,'Discord delivery',job.id,data.status);
 }
 await store.set('botStatus/main',{state:'serverless ready',heartbeatAt:now(),serverId:env.DISCORD_GUILD_ID,roleCount:Object.keys(config.roles||{}).length,channelCount:Object.keys(config.channels||{}).length});
}
export async function reconcileMembers(store,discord,env){
 if(env.RECONCILE_MEMBERS!=='true')return;
 const config=await store.get('discordConfig/main');if(!config?.apdRoleId)return;
 const state=await store.get('botState/memberCursor');const page=await discord.api('/guilds/'+env.DISCORD_GUILD_ID+'/members?limit=10'+(state?.after?'&after='+state.after:''));
 for(const member of page){if(!member.user.bot&&!member.roles.includes(config.apdRoleId))await discord.api('/guilds/'+env.DISCORD_GUILD_ID+'/members/'+member.user.id+'/roles/'+config.apdRoleId,'PUT');}
 await store.set('botState/memberCursor',{after:page.length===10?page.at(-1).user.id:'',updatedAt:now()});
}

export async function publishScheduled(store){
 const drafts=await store.list('announcementDrafts',1,{compositeFilter:{op:'AND',filters:[equal('publishState','scheduled'),{fieldFilter:{field:{fieldPath:'scheduledFor'},op:'LESS_THAN_OR_EQUAL',value:{stringValue:new Date().toISOString()}}}]}});
 if(!drafts.length)return;
 const draft=drafts[0],role=await store.get('userRoles/'+draft.updatedByUid);
 if(!role?.admin){await store.set('announcementDrafts/'+draft.id,{publishState:'draft',scheduleError:'Author no longer has announcement permission.'},['publishState','scheduleError']);return;}
 const id='scheduled_'+draft.id,logId='scheduled_'+draft.id,jobId='scheduled_'+draft.id;
 const record={...draft,publishState:'published',scheduledFor:'',createdAt:new Date(),updatedAt:new Date()};delete record._updateTime;delete record.id;
 await store.commit([{path:'announcements/'+id,data:record,precondition:{exists:false}},{path:'portalLogs/'+logId,data:{actorUid:draft.updatedByUid,action:'Announcement Published',category:'Announcements',targetUid:id,targetLabel:draft.title,announcement:record,createdAt:new Date()}},{path:'discordJobs/'+jobId,data:{kind:'activity',actorUid:draft.updatedByUid,category:'Announcements',targetUid:id,logId,status:'pending',attempts:0,createdAt:new Date()}},{delete:true,path:'announcementDrafts/'+draft.id,precondition:{updateTime:draft._updateTime}}]);
}
export function eventTime(event,timeZone='America/Chicago'){
 const date=event.date,time=event.start||'09:00';if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))return NaN;
 const target=Date.parse(date+'T'+time+':00Z');let guess=target;
 for(let i=0;i<2;i++){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess)).map(p=>[p.type,p.value]));const shown=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);guess+=target-shown;}return guess;
}
export async function trainingReminder(store,discord,env){
 const config=await store.get('discordConfig/main');if(!config?.calendarPublish)return;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:env.DEPARTMENT_TIMEZONE||'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const events=await store.list('calendarEvents',20,{fieldFilter:{field:{fieldPath:'date'},op:'GREATER_THAN_OR_EQUAL',value:{stringValue:today}}});
 for(const event of events){const remaining=eventTime(event,env.DEPARTMENT_TIMEZONE)-Date.now();for(const minutes of config.reminderMinutes||[60]){if(remaining>0&&remaining<=minutes*60*1000&&remaining>Math.max(0,minutes-15)*60*1000){
  const key='reminder_'+event.id+'_'+event.date+'_'+(event.start||'all')+'_'+minutes;const exists=await store.get('trainingReminders/'+key);if(exists)continue;
  await sendOnce(store,discord,{id:key},'reminder',config.calendarPublish,{content:'Training reminder: '+String(event.title).slice(0,200)+' • '+event.date+' '+(event.start||'All day')+' • '+SITE+'training.html',allowed_mentions:{parse:[]}});
  await store.set('trainingReminders/'+key,{sentAt:new Date(),eventId:event.id});return;
 }}}
}
