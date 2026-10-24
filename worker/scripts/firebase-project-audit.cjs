const fs=require('node:fs');const path=require('node:path');
const auth=require('../../security/node_modules/firebase-tools/lib/auth.js');
const project='rattler-nation-apd';
async function api(url,options={}){const account=auth.getGlobalDefaultAccount();if(!account)throw Error('Firebase login required');const token=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);const response=await fetch(url,{...options,headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json',...options.headers}});const data=await response.json();if(!response.ok)throw Error('Project audit API failed '+response.status+' at '+new URL(url).pathname);return data;}
module.exports={api,project};
if(require.main===module)(async()=>{
const result={project};
try{const billing=await api('https://cloudbilling.googleapis.com/v1/projects/'+project+'/billingInfo');result.billingEnabled=billing.billingEnabled;}catch(e){result.billingVerification=e.message;}
try{const config=await api('https://identitytoolkit.googleapis.com/admin/v2/projects/'+project+'/config');result.authentication={authorizedDomains:config.authorizedDomains,emailPasswordEnabled:config.signIn?.email?.enabled,anonymousEnabled:config.signIn?.anonymous?.enabled,mfaState:config.mfa?.state};}catch(e){result.authenticationVerification=e.message;}
const root='https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)/documents';
try{result.collections=(await api(root+':listCollectionIds',{method:'POST',body:JSON.stringify({pageSize:100})})).collectionIds||[];}catch(e){result.databaseVerification=e.message;}
try{const release=await api('https://firebaserules.googleapis.com/v1/projects/'+project+'/releases/cloud.firestore');const rules=await api('https://firebaserules.googleapis.com/v1/'+release.rulesetName);const folder=path.resolve(__dirname,'../.secrets');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'firestore-rules-before.json'),JSON.stringify({release,rules},null,2));result.previousRulesBackedUp=true;}catch(e){result.rulesVerification=e.message;}
console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
