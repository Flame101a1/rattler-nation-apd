/** Optional FORM-BOUND Apps Script. Install an on-form-submit trigger for apdFormSubmitted.
 * Script properties: WORKER_URL, FORM_KIND (complaint/suggestion/support), FORMS_HMAC_KEY.
 * Never put the HMAC key in public website code. Sends no form answers or names.
 */
function apdFormSubmitted(event) {
  if (!event || !event.response) throw new Error('Use a form-bound on-submit trigger.');
  var properties = PropertiesService.getScriptProperties();
  var type = properties.getProperty('FORM_KIND');
  if (['complaint','suggestion','support'].indexOf(type) < 0) throw new Error('Invalid FORM_KIND.');
  var body = JSON.stringify({type:type,id:event.response.getId()});
  var timestamp = String(Math.floor(Date.now()/1000));
  var signature = Utilities.computeHmacSha256Signature(timestamp+'.'+body,properties.getProperty('FORMS_HMAC_KEY'));
  var hex = signature.map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');
  var response = UrlFetchApp.fetch(properties.getProperty('WORKER_URL').replace(/\/$/,'')+'/forms',{method:'post',contentType:'application/json',payload:body,headers:{'X-APD-Timestamp':timestamp,'X-APD-Signature':hex},muteHttpExceptions:true});
  if (response.getResponseCode() !== 200) throw new Error('APD notification delivery failed: '+response.getResponseCode());
}
