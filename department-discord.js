// Shared officer-facing notices and staff activity embeds.
export function departmentDiscordPayload(entry, publish){
  const clip=(value,limit=200)=>String(value || "").slice(0,limit);
  const cid=entry.category === "CID";
  const event=entry.calendarEvent || {};
  const actor=entry.actorDisplayName || "APD Staff";
  const area=cid ? "CID" : "Calendar";
  const embed={
    author:{name:"Austin Police Department | " + (cid ? "Criminal Investigations Division" : "Department Calendar")},
    title:clip(cid ? (publish ? "New CID Case Available" : entry.action || "CID Activity") : publish ? event.title || entry.targetLabel || "Department Event" : entry.action || "Calendar Activity",256),
    color:0x4b8fd8,
    timestamp:new Date().toISOString(),
    footer:{text:"Rattler Nation • Austin Police Department"},
    fields:[]
  };
  if(cid){
    // Staff creation/deletion logs include the authorized actor/suspect names only.
    // Officer-facing notices and all case narratives/evidence remain excluded.
    embed.description=publish
      ? "A new case has been added to the CID portal. Authorized personnel may sign in to review the case file."
      : "Case activity has been recorded in the CID portal. Authorized personnel may sign in to review it.";
    if(!publish){
      if(entry.action === "CID Case Created"){
        const suspects=clip(entry.suspectNames || "an unspecified suspect",1000);
        embed.description=clip(actor,200) + " opened a case on " + suspects + ".";
      }
      if(entry.action === "CID Case Deleted"){
        const suspects=clip(entry.suspectNames || "an unspecified suspect",1000);
        embed.description=clip(actor,200) + " deleted a record on " + suspects + ".";
      }
      embed.fields=[{name:"Action",value:clip(entry.action || "CID Activity"),inline:false}];
    }
  }else{
    // Schedule details are rendered in fields, never repeated in the description.
    if(publish && event.description) embed.description=clip(event.description,3000);
    else{
      embed.fields.push({name:"Title",value:clip(event.title || entry.targetLabel || "Department Event",256),inline:false});
    }
    const field=(name,value)=>embed.fields.push({name,value:clip(value || "Not specified"),inline:true});
    field("Event Type",event.type);
    field("Date",event.date);
    field("Time",event.allDay ? "All day" : event.start ? event.start + (event.end ? " – " + event.end : "") : "To be confirmed");
    field("Location",event.location);
    field("Organized By",event.organizer);
    if(event.recurring) field("Repeats",event.recurrence + (event.recurrenceEnd ? " until " + event.recurrenceEnd : ""));
    if(!publish) embed.fields.push({name:"User Name",value:clip(actor),inline:false});
  }
  if(typeof window !== "undefined" && window.location.protocol === "https:"){
    const icon=new URL("images/austin-police-patch.png",window.location.href).href;
    embed.author.icon_url=icon;
    embed.thumbnail={url:icon};
  }
  return {username:"APD " + area + (publish ? "" : " Logs"),allowed_mentions:{parse:[]},embeds:[embed]};
}
