// Announcement embeds styled after the supplied Discord reference.
export function announcementDiscordPayload(entry, publish){
  const clip = (value, limit) => String(value || "").slice(0, limit);
  const announcement = entry.announcement || {};
  const deleted = /deleted|removed/i.test(entry.action || "");
  const edited = /updated|edited/i.test(entry.action || "");
  const verb = deleted ? "deleted" : edited ? "updated" : "published";
  const actor = entry.actorDisplayName || "APD Staff";
  const title = announcement.title || entry.targetLabel || "Department Announcement";
  const fields = [
    {name:"Agency", value:"Austin Police Department", inline:true},
    {name:"Community", value:"Rattler Nation", inline:true},
    {name:"Category", value:clip(announcement.category || "General", 1024), inline:true},
    {name:"Priority", value:clip(announcement.priority || "Normal", 1024), inline:true},
    {name:"Posted By", value:clip(announcement.author || actor, 1024), inline:true}
  ];
  {
    const narrative = clip(announcement.message || "No announcement content provided.", 3800);
    const narrativeFields = [];
    for(let offset = 0; offset < narrative.length; offset += 1024){
      narrativeFields.push({name:offset === 0 ? "Narrative" : "Narrative (continued)", value:narrative.slice(offset, offset + 1024), inline:false});
    }
    fields.unshift({name:"Title", value:clip(title, 1024), inline:false}, ...narrativeFields);
    if(!publish) fields.push({name:"User Name", value:clip(actor, 1024), inline:false});
  }
  const embed = {
    author:{name:"Rattler Nation | Austin Police Department"},
    title:clip(publish ? "A new announcement has been published:" : "An announcement has been " + verb + ":", 256),
    color:0x4b8fd8,
    fields,
    timestamp:new Date().toISOString(),
    footer:{text:clip(publish ? (announcement.author || actor) + " | APD Announcements" : actor + " | " + (entry.action || "Announcement Activity"), 500)}
  };
  if(publish){
    // Officer-facing announcements read as department notices, not audit entries.
    const priority = announcement.priority || "Normal";
    embed.author = {name:"Austin Police Department | Department Announcement"};
    embed.title = clip(title, 256);
    embed.description = clip(announcement.message || "No announcement content provided.", 3800);
    embed.fields = [
      {name:"Category", value:clip(announcement.category || "General", 200), inline:true},
      {name:"Priority", value:clip(priority, 200), inline:true},
      {name:"Issued By", value:clip(announcement.author || actor, 200), inline:true}
    ];
    embed.color = 0x4b8fd8;
    embed.footer = {text:"Rattler Nation • Austin Police Department"};
  }
  // Resolve the existing department patch on the deployed website.
  if(typeof window !== "undefined" && window.location.protocol === "https:"){
    const icon = new URL("images/austin-police-patch.png", window.location.href).href;
    embed.author.icon_url = icon;
    embed.thumbnail = {url:icon};
  }
  return {username:publish ? "APD Announcements" : "APD Announcement Logs", allowed_mentions:{parse:[]}, embeds:[embed]};
}
