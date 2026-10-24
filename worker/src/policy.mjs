export const SITE='https://flame101a1.github.io/rattler-nation-apd/';
export const ranks=['Cadet','Officer','Senior Officer','Corporal','Senior Corporal','Sergeant','Staff Sergeant','Lieutenant','Captain','Assistant Deputy Chief','Deputy Chief','Assistant Chief','Chief of Police'];
export const specials=['Field Training Officer','Criminal Investigations','Internal Affairs','Command Staff','Department Administration','APD Bot'];
export const layout=[
 {name:'DEPARTMENT INFORMATION',access:'apd',channels:['welcome','department-announcements','department-updates','department-resources','policies-and-procedures']},
 {name:'DEPARTMENT OPERATIONS',access:'apd',channels:['general-discussion','training-announcements','training-registration','department-calendar','roster-updates']},
 {name:'OFFICER SERVICES',access:'apd',channels:['warrant-submission','officer-requests','suggestions','portal-support']},
 {name:'SUPERVISOR OPERATIONS',access:'supervisor',channels:['supervisor-announcements','warrant-review','ois-evidence-review','personnel-management']},
 {name:'CRIMINAL INVESTIGATIONS',access:'cid',channels:['cid-announcements','cid-case-updates','cid-discussion']},
 {name:'COMMAND STAFF',access:'admin',channels:['command-discussion','internal-affairs','department-administration','bot-management','website-activity-logs','discord-audit-logs']}
];
export function officer(r){return !!(r?.admin||r?.officer||r?.calendarEditor||r?.cidEditor);}
export function authorized(r,job){
 if(!r)return false;
 if(['setup','configure','syncRoles','rank','retry'].includes(job.kind))return r.admin===true;
 if(job.kind==='activity'){
  if(job.category==='CID')return !!(r.admin||r.cidEditor);
  if(['Announcements','Admin','Access','System'].includes(job.category))return r.admin===true;
  return !!(r.admin||r.calendarEditor);
 }
 if(job.kind==='submission')return officer(r);
 if(job.kind==='review')return !!(r.admin||r.reviewer);
 if(job.kind==='attendance')return officer(r);
 return false;
}
export function safeUrl(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw Error();return u.href;}catch{throw Error('A valid HTTPS document or footage link is required.');}}
export function snowflake(value){return typeof value==='string'&&/^\d{16,22}$/.test(value);}
export function text(value,max=1000){if(typeof value!=='string')throw Error('Expected text');if(value.length>max)throw Error('Text is too long');return value;}
export function roleMentions(config,request={},editing=false){
 if(editing)return [];
 const wanted=request.pingApd===false?[]:[config.apdRoleId];
 for(const id of request.roleIds||[])if((config.allowedMentionRoleIds||[]).includes(id))wanted.push(id);
 return [...new Set(wanted.filter(snowflake))];
}
export function announcementPayload(record,config,editing=false){
 const mentions=roleMentions(config,record,editing);
 const content=(mentions.length?mentions.map(id=>'<@&'+id+'>').join(' ')+'\n\n':'')+record.message;
 if(record.format==='embed')return {content:mentions.map(id=>'<@&'+id+'>').join(' '),allowed_mentions:{parse:[],roles:mentions},embeds:[{title:String(record.title||'Department Announcement').slice(0,256),description:String(record.message||'').slice(0,3800),color:0x4b8fd8,footer:{text:'Rattler Nation • Austin Police Department'}}]};
 if(content.length>2000)throw Error('Plain Discord announcements must fit 2,000 characters including role mentions. Choose embed format for longer messages.');
 return {content,allowed_mentions:{parse:[],roles:mentions},embeds:[]};
}
export function setupPlan(){return [...['APD',...ranks,...specials].map(name=>({kind:'role',name})),...layout.flatMap(category=>[{kind:'category',...category},...category.channels.map(name=>({kind:'channel',name,parent:category.name,access:category.access}))])];}
export function redact(error){return String(error?.message||error||'Operation failed').replace(/https:\/\/discord(?:app)?\.com\/api\/webhooks\/\S+/g,'[redacted webhook]').replace(/Bearer\s+\S+|Bot\s+\S+/g,'[redacted token]').slice(0,250);}
