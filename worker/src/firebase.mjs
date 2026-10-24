let cachedToken;
const encoder=new TextEncoder();
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const b64text=s=>b64(encoder.encode(s));
export async function accessToken(env){
 if(cachedToken&&cachedToken.expires>Date.now()+60000)return cachedToken.value;
 if(!env.FIREBASE_PRIVATE_KEY||!env.FIREBASE_CLIENT_EMAIL)throw Error('Firebase server credentials are not configured.');
 const pem=env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n').replace(/-----[^-]+-----|\s/g,'');
 const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const now=Math.floor(Date.now()/1000);const body=b64text(JSON.stringify({alg:'RS256',typ:'JWT'}))+'.'+b64text(JSON.stringify({iss:env.FIREBASE_CLIENT_EMAIL,scope:'https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
 const sig=b64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,encoder.encode(body))));
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:body+'.'+sig})});
 if(!r.ok)throw Error('Firebase service credential was rejected.');const token=await r.json();cachedToken={value:token.access_token,expires:Date.now()+token.expires_in*1000};return token.access_token;
}
export function encodeValue(v){
 if(v===null)return {nullValue:null};if(v instanceof Date)return {timestampValue:v.toISOString()};if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};if(typeof v==='string')return {stringValue:v};if(Array.isArray(v))return {arrayValue:{values:v.map(encodeValue)}};
 return {mapValue:{fields:Object.fromEntries(Object.entries(v||{}).filter(([,x])=>x!==undefined).map(([k,x])=>[k,encodeValue(x)]))}};
}
export function decodeValue(v){if('stringValue'in v)return v.stringValue;if('booleanValue'in v)return v.booleanValue;if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;if('timestampValue'in v)return v.timestampValue;if('nullValue'in v)return null;if(v.arrayValue)return(v.arrayValue.values||[]).map(decodeValue);if(v.mapValue)return decodeFields(v.mapValue.fields);return null;}
const decodeFields=f=>Object.fromEntries(Object.entries(f||{}).map(([k,v])=>[k,decodeValue(v)]));
export class Store{
 constructor(env){this.env=env;this.root='projects/'+env.FIREBASE_PROJECT_ID+'/databases/(default)/documents';this.base='https://firestore.googleapis.com/v1/'+this.root;}
 async request(suffix,options={}){const r=await fetch(this.base+suffix,{...options,headers:{Authorization:'Bearer '+await accessToken(this.env),'Content-Type':'application/json',...options.headers}});if(r.status===404)return null;if(!r.ok){const e=Error('Firestore request failed ('+r.status+').');e.status=r.status;throw e;}return r.status===204?{}:r.json();}
 async get(path){const d=await this.request('/'+path);return d?{id:d.name.split('/').at(-1),...decodeFields(d.fields),_updateTime:d.updateTime}:null;}
 fields(data){return Object.fromEntries(Object.entries(data).filter(([k,v])=>v!==undefined&&k!=='id'&&k!=='_updateTime').map(([k,v])=>[k,encodeValue(v)]));}
 async set(path,data,mask){const q=mask?'?'+mask.map(k=>'updateMask.fieldPaths='+encodeURIComponent(k)).join('&'):'';return this.request('/'+path+q,{method:'PATCH',body:JSON.stringify({fields:this.fields(data)})});}
 async commit(writes){return this.request(':commit',{method:'POST',body:JSON.stringify({writes:writes.map(w=>w.delete?{delete:this.root+'/'+w.path,currentDocument:w.precondition}:{update:{name:this.root+'/'+w.path,fields:this.fields(w.data)},...(w.mask?{updateMask:{fieldPaths:w.mask}}:{}),...(w.precondition?{currentDocument:w.precondition}:{})})})});}
 async list(collection,limit=25,filter,afterId){const q={from:[{collectionId:collection}],limit};if(afterId){q.orderBy=[{field:{fieldPath:"__name__"},direction:"ASCENDING"}];q.startAt={values:[{referenceValue:this.root+"/"+collection+"/"+afterId}],before:false};}if(filter)q.where=filter;const r=await this.request(':runQuery',{method:'POST',body:JSON.stringify({structuredQuery:q})});return(r||[]).filter(x=>x.document).map(x=>({id:x.document.name.split('/').at(-1),...decodeFields(x.document.fields),_updateTime:x.document.updateTime}));}
}
export const equal=(field,value)=>({fieldFilter:{field:{fieldPath:field},op:'EQUAL',value:encodeValue(value)}});
export async function websiteUser(request,env,store){
 const token=request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];if(!token)throw Error('Authentication required.');
 const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(env.FIREBASE_WEB_API_KEY),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token})});
 if(!r.ok)throw Error('Authentication rejected.');const data=await r.json();const user=data.users?.[0];if(!user||user.disabled)throw Error('Authentication rejected.');const raw=token.split('.')[1];let claims;try{claims=JSON.parse(atob(raw.replace(/-/g,'+').replace(/_/g,'/')));}catch{throw Error('Authentication rejected.');}return {uid:user.localId,authTime:Number(claims.auth_time||0),role:await store.get('userRoles/'+user.localId)};
}
