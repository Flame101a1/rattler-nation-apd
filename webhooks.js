// Paste each Discord webhook URL between the quotes. Empty = disabled.
// Publish destinations are for LEO-facing posts; log destinations are for staff activity.
// This static website serves this file publicly; webhook URLs placed here are visible to visitors.
export const webhooks = {
  announcementsPublish: "https://discord.com/api/webhooks/1561274689186304071/oQeB1jKmdH6ZylXARJ41m69UWhwXnSivuErOq6QolJcfBPBc9y6CjIjhMQBoS2CmsEY1", // Announcements Publish: new announcements only (LEO Discord)
  announcementLogs: "https://discord.com/api/webhooks/1561274599088455731/j0sZ_8th6FWAa3saS3lzvNfBbvrbGxqRdG1rr3qeYYTN5BnNCcnctevtm4GAsq-wDOGs",      // Announcement Logs: add/publish, edit, and delete activity
  calendarPublish: "https://discord.com/api/webhooks/1561277914786431077/iQCktdyBOEVUMUANKkstzn19bMN0ez2KcAmttGfS-zqSdQXLXWBVDAHvO6nhe8acSAB9",       // Calendar Publish: newly created events only (LEO Discord)
  calendarLogs: "https://discord.com/api/webhooks/1561277958214258728/hl2_a_lJoKAKHYlnuYF0I2wbRBQeT813owkR2mx8kVt_kBaZnrDoe2zWF9ZPno2_pK7F",          // Calendar Logs: add, edit, and delete activity
  cidPublish: "https://discord.com/api/webhooks/1561277718312525906/IC6MQ08TY7A1NQN8XNdPuWhesjZV7-DoycvH71LnGNLlYCfhOndHfuTTsaVaaW6RVpeR",            // CID Publish: new-case notices, action and case ID only
  cidLogs: "https://discord.com/api/webhooks/1561277805533073462/sJ4q64c2Qx0MAy7wumdNKeRKynOYs0hH6sn0JGddqem3FmJ-TqB9okl93PjX5iVT_r86"                // CID Logs: case activity, action and case ID only
};

export function discordDestinations(entry, config = webhooks){
  const destinations = [];
  if(entry.category === "Announcements"){
    if(config.announcementLogs) destinations.push({url:config.announcementLogs, publish:false});
    if(entry.action === "Announcement Published" && config.announcementsPublish)
      destinations.push({url:config.announcementsPublish, publish:true});
  }
  if(entry.category === "Calendar"){
    if(config.calendarLogs) destinations.push({url:config.calendarLogs, publish:false});
    if(entry.action === "Calendar Event Created" && config.calendarPublish)
      destinations.push({url:config.calendarPublish, publish:true});
  }
  if(entry.category === "CID"){
    if(config.cidLogs) destinations.push({url:config.cidLogs, publish:false});
    if(entry.action === "CID Case Created" && config.cidPublish)
      destinations.push({url:config.cidPublish, publish:true});
  }
  return destinations;
}
