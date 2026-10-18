import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db } from "./firebase-config.js";
import { discordDestinations } from "./webhooks.js";
import { announcementDiscordPayload } from "./announcement-discord.js";
import { departmentDiscordPayload } from "./department-discord.js";

const portalLogsCollection = collection(db, "portalLogs");


export function watchPortalLogs(onLogs, onError){
  const recentLogsQuery = query(
    portalLogsCollection,
    orderBy("createdAt", "desc"),
    limit(100)
  );

  return onSnapshot(
    recentLogsQuery,
    snapshot => {
      const logs = snapshot.docs.map(documentSnapshot => ({
        id:documentSnapshot.id,
        ...documentSnapshot.data()
      }));

      onLogs(logs);
    },
    onError
  );
}

export async function createPortalLog(logEntry){
  const normalizedLog = {
    action:logEntry.action || "Portal Action",
    category:logEntry.category || "System",
    message:logEntry.message || "",
    actorUid:logEntry.actorUid || "",
    actorEmail:logEntry.actorEmail || "",
    targetUid:logEntry.targetUid || "",
    targetLabel:logEntry.targetLabel || ""
  };
  const createdLog = await addDoc(portalLogsCollection, {
    ...normalizedLog,
    createdAt:serverTimestamp()
  });

  sendDiscordLog({
    ...logEntry,
    ...normalizedLog
  });

  return createdLog;
}

export async function logPortalAction(staffAccess, logEntry){
  if(!staffAccess?.user){
    return;
  }

  try{
    await createPortalLog({
      ...logEntry,
      actorUid:staffAccess.user.uid || "",
      actorEmail:staffAccess.user.email || "",
      actorDisplayName:staffAccess.role?.displayName || staffAccess.user.displayName || "APD Staff"
    });
  }catch(error){
    console.error("Portal log write failed:", error);
  }
}

async function sendDiscordLog(logEntry){
  await Promise.all(discordDestinations(logEntry).map(async destination => {
    try{
      const response = await fetch(destination.url, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(logEntry.category === "Announcements" ? announcementDiscordPayload(logEntry, destination.publish) : ["CID", "Calendar"].includes(logEntry.category) ? departmentDiscordPayload(logEntry, destination.publish) : destination.publish ? discordPublishPayload(logEntry) : discordPayload(logEntry))
      });
      if(!response.ok) console.error("Discord delivery failed with status:", response.status);
    }catch{
      console.error("Discord delivery failed. Check the webhook configuration and connection.");
    }
  }));
}

function discordPublishPayload(entry){
  return {
    username:"Rattler Nation APD",
    allowed_mentions:{parse:[]},
    embeds:[{
      title:truncate(entry.targetLabel || "Department Update", 256),
      description:truncate(entry.publishDetails || entry.message || "", 3800),
      color:embedColor(entry.category),
      timestamp:new Date().toISOString(),
      footer:{text:entry.category === "Calendar" ? "APD Department Calendar" : "APD Announcements"}
    }]
  };
}

function discordPayload(logEntry){
  const category = clean(logEntry.category || "Other");
  const action = clean(logEntry.action || "Portal Action");
  const message = clean(logEntry.message || "A portal action was recorded.");
  const actor = clean(logEntry.actorEmail || logEntry.actorUid || "Unknown user");
  const target = clean(logEntry.targetLabel || logEntry.targetUid || "Portal");
  const postAuthor = clean(logEntry.postAuthor);
  const postCategory = clean(logEntry.postCategory);
  const postDetails = clean(logEntry.postDetails);
  const postNarrative = clean(logEntry.postNarrative);
  const resourceUrl = validHttpUrl(logEntry.resourceUrl);
  const removedBy = /removed|deleted/i.test(action) ? actor : "";
  const isPostLog = Boolean(postAuthor || postCategory || postDetails || postNarrative || resourceUrl);
  const fields = isPostLog
    ? postLogFields({
      postedBy:postAuthor || actor,
      removedBy,
      postName:target,
      postCategory:postCategory || category,
      postDetails,
      postNarrative,
      resourceUrl
    })
    : standardLogFields({ actor, target });

  if(["Access", "Admin", "System", "Other"].includes(category)){
    fields.unshift({
      name:"Area",
      value:truncate(category, 1024),
      inline:true
    });
  }

  return {
    username:"APD Portal Logs",
    allowed_mentions:{
      parse:[]
    },
    embeds:[
      {
        title:truncate(action, 256),
        description:truncate(message, 3800),
        color:embedColor(category),
        fields,
        timestamp:new Date().toISOString(),
        footer:{
          text:"APD Portal Activity"
        }
      }
    ]
  };
}

function standardLogFields({ actor, target }){
  return [
    {
      name:"Changed By",
      value:truncate(actor, 1024),
      inline:true
    },
    {
      name:"Affected Item",
      value:truncate(target, 1024),
      inline:true
    }
  ];
}

function postLogFields({ postedBy, removedBy, postName, postCategory, postDetails, postNarrative, resourceUrl }){
  const fields = [
    {
      name:"Posted By",
      value:truncate(postedBy || "Unknown", 1024),
      inline:true
    },
    ...(removedBy ? [{
      name:"Removed By",
      value:truncate(removedBy, 1024),
      inline:true
    }] : []),
    {
      name:"Post Name",
      value:truncate(postName || "Untitled Post", 1024),
      inline:true
    },
    {
      name:"Category",
      value:truncate(postCategory || "General", 1024),
      inline:true
    }
  ];

  if(postDetails){
    fields.push({
      name:"Post Details",
      value:truncate(postDetails, 1024),
      inline:false
    });
  }

  if(postNarrative){
    fields.push({
      name:"Post Narrative",
      value:truncate(postNarrative, 1024),
      inline:false
    });
  }

  fields.push({
    name:"Linked Document",
    value:resourceUrl ? `[Open Linked Document](${resourceUrl})` : "None linked",
    inline:false
  });

  return fields;
}

function embedColor(category){
  const normalizedCategory = String(category || "").toLowerCase();

  if(normalizedCategory === "announcements"){
    return 0xf2c85f;
  }

  if(normalizedCategory === "training" || normalizedCategory === "calendar"){
    return 0x3592ff;
  }

  if(normalizedCategory === "resources"){
    return 0x2fbf71;
  }

  if(normalizedCategory === "cid"){
    return 0x8b5cf6;
  }

  if(["access", "admin", "system"].includes(normalizedCategory)){
    return 0xd94f4f;
  }

  if(normalizedCategory === "complaints"){
    return 0x8b5cf6;
  }

  return 0x94a3b8;
}

function clean(value){
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function validHttpUrl(value){
  const url = String(value || "").trim();

  if(!url){
    return "";
  }

  try{
    const parsedUrl = new URL(url);
    return ["http:", "https:"].includes(parsedUrl.protocol) ? parsedUrl.href : "";
  }catch(error){
    return "";
  }
}

function truncate(value, maxLength){
  const text = String(value || "");

  if(text.length <= maxLength){
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}
