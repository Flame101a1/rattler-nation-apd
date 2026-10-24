import {auth,db} from "./firebase-config.js";
import {doc,onSnapshot,collection,query,orderBy,limit} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {workerBaseUrl} from "./discord-runtime-config.js";
import {watchStaffAuth,reauthenticateStaff} from "./staff-auth-service.js";
import {requestDiscordAction,watchBotStatus,watchMyDeliveries} from "./discord-service.js";
import {confirmPortalAction} from "./portal-confirm.js";
let stops=[],auditRows=[];
function renderSecurityAudit(){const term=document.getElementById("securityAuditSearch").value.toLowerCase(),list=document.getElementById("securityAuditList");list.replaceChildren();for(const row of auditRows){const text=[row.createdAt?.toDate?.().toLocaleString(),row.actor,row.action,row.target,row.outcome].filter(Boolean).join(" • ");if(text.toLowerCase().includes(term)){const p=document.createElement("p");p.textContent=text;list.append(p);}}}
document.getElementById("securityAuditSearch").oninput=renderSecurityAudit;
const panel=document.getElementById("discordAdminPanel"),message=document.getElementById("discordAdminMessage");
watchStaffAuth(access=>{
  stops.forEach(stop=>stop());stops=[];panel.hidden=!access.role?.admin;
  auditRows=[];renderSecurityAudit();if(!access.role?.admin)return;
  stops.push(onSnapshot(query(collection(db,"securityAudit"),orderBy("createdAt","desc"),limit(100)),snapshot=>{auditRows=snapshot.docs.map(d=>d.data());renderSecurityAudit();},()=>{document.getElementById("securityAuditList").textContent="Audit history unavailable until permissions and backend are configured.";}));
  stops.push(watchBotStatus(status=>{
    const age=status?.heartbeatAt?.toMillis?Date.now()-status.heartbeatAt.toMillis():Infinity;
    document.getElementById("discordServerSummary").textContent=status?"Server: "+status.serverId+" • Channels: "+status.channelCount+" • Roles: "+status.roleCount:"Server not configured.";
    document.getElementById("discordBotHealth").textContent=age<7*60*1000?"Bot: "+status.state:"No recent serverless heartbeat. Queued jobs may be waiting.";
  },()=>{document.getElementById("discordBotHealth").textContent="Bot status unavailable. Publish the new Firestore rules.";}));
  stops.push(onSnapshot(doc(db,'discordConfig','main'),snapshot=>{if(!snapshot.exists())return;const c=snapshot.data();for(const [id,key]of Object.entries({discordApdRole:'apdRoleId',discordPublishChannel:'announcementsPublish',discordLogsChannel:'announcementLogs',discordCalendarPublish:'calendarPublish',discordCalendarLogs:'calendarLogs',discordCidPublish:'cidPublish',discordCidLogs:'cidLogs'}))document.getElementById(id).value=c[key]||'';document.getElementById('discordReminderMinutes').value=(c.reminderMinutes||[60]).join(', ');document.getElementById('discordMentionRoles').value=(c.allowedMentionRoleIds||[]).join(', ');},()=>{}));
  stops.push(watchMyDeliveries(jobs=>{
    const list=document.getElementById("discordDeliveryList");list.replaceChildren();
    jobs.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).forEach(job=>{
      const p=document.createElement("p");p.textContent=(job.kind||"activity")+": "+job.status+(job.error?" — "+job.error:"");list.append(p);
    });
  },()=>{message.textContent="Delivery status requires the new Firestore rules.";}));
});
async function queue(kind,payload){try{await requestDiscordAction(kind,payload);message.textContent="Request queued. The bot will update delivery status.";}catch{message.textContent="Request failed. Check your sign-in and Firestore rules.";}}
document.getElementById("discordSetupBtn").onclick=async()=>{if(await confirmPortalAction({title:"Configure APD Discord?",message:"Proposed layout: APD membership; 13 rank roles; 6 special roles; Department Information, Department Operations, Officer Services, private Supervisor Operations, private Criminal Investigations, and private Command Staff categories. See docs/DISCORD-SERVER-LAYOUT.md for every channel. Existing matching channels are reused; private categories receive restricted permissions. Approve this layout for the configured APD server?",confirmLabel:"Configure Server"}))await queue("setup",{approved:true});};
document.getElementById("discordSyncBtn").onclick=()=>queue("syncRoles",{});
document.getElementById("discordSaveConfigBtn").onclick=()=>queue("configure",{apdRoleId:document.getElementById("discordApdRole").value.trim(),announcementsPublish:document.getElementById("discordPublishChannel").value.trim(),announcementLogs:document.getElementById("discordLogsChannel").value.trim(),calendarPublish:document.getElementById("discordCalendarPublish").value.trim(),calendarLogs:document.getElementById("discordCalendarLogs").value.trim(),cidPublish:document.getElementById("discordCidPublish").value.trim(),cidLogs:document.getElementById("discordCidLogs").value.trim(),reminderMinutes:document.getElementById("discordReminderMinutes").value.split(",").map(s=>s.trim()).filter(Boolean).map(Number),allowedMentionRoleIds:document.getElementById("discordMentionRoles").value.split(",").map(s=>s.trim()).filter(Boolean)});

async function workerRequest(path){
 if(!workerBaseUrl)throw Error("The serverless Worker has not been deployed/configured yet.");
 const response=await fetch(workerBaseUrl.replace(/\/$/,"")+path,{method:"POST",headers:{Authorization:"Bearer "+await auth.currentUser.getIdToken(),"Content-Type":"application/json"},body:"{}"});
 const result=await response.json();if(!response.ok)throw Error(result.error||"Worker request failed.");return result;
}
document.getElementById("discordRegisterCommandsBtn").onclick=async()=>{try{if(await confirmPortalAction({title:"Register Discord Commands?",message:"This installs the APD slash-command definitions in the configured server.",confirmLabel:"Register Commands"})){await workerRequest("/api/register");message.textContent="Slash commands registered.";}}catch(e){message.textContent=e.message;}};
document.getElementById("discordWakeBtn").onclick=async()=>{try{await workerRequest("/api/wake");message.textContent="One delivery cycle requested.";}catch(e){message.textContent=e.message;}};
document.getElementById("discordRetryBtn").onclick=()=>queue("retry",{id:document.getElementById("discordRetryId").value.trim()});

document.getElementById("discordCatalogBtn").onclick=async()=>{try{const data=await workerRequest("/api/catalog");for(const [key,id]of [["channels","discordChannelOptions"],["roles","discordRoleOptions"]]){const list=document.getElementById(id);list.replaceChildren();for(const item of data[key]){const option=document.createElement("option");option.value=item.id;option.label=item.name;list.append(option);}}message.textContent="Server channels and roles loaded.";}catch(error){message.textContent=error.message;}};

document.getElementById("discordReauthForm").onsubmit=async e=>{e.preventDefault();const field=document.getElementById("discordReauthPassword");try{await reauthenticateStaff(field.value);message.textContent="Session verified for sensitive operations.";}catch{message.textContent="Session verification failed. Check your password.";}finally{field.value="";}};
