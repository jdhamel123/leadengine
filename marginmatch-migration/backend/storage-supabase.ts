/**
 * Portable object storage using Supabase Storage REST.
 * Intended for proof photos and other migration assets.
 */
function baseUrl(){
  const value=process.env.SUPABASE_URL||'';
  if(!value) throw new Error('SUPABASE_URL is required for proof storage');
  return value.replace(/\/$/,'');
}
function key(){
  const value=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
  if(!value) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for proof storage');
  return value;
}
function bucket(){
  return process.env.SUPABASE_PROOF_BUCKET||'marginmatch-proof';
}
function bytesFromBase64(content:string){
  return Uint8Array.from(Buffer.from(content,'base64'));
}
export async function writeProof(path:string,content:string,contentType:string){
  const response=await fetch(baseUrl()+'/storage/v1/object/'+encodeURIComponent(bucket())+'/'+path.split('/').map(encodeURIComponent).join('/'),{
    method:'POST',
    headers:{
      Authorization:'Bearer '+key(),
      apikey:key(),
      'Content-Type':contentType,
      'x-upsert':'true'
    },
    body:bytesFromBase64(content)
  });
  if(!response.ok) throw new Error('Could not save proof photo: '+response.status+' '+await response.text());
  return {path};
}

export async function signedProofUrls(paths:string[],expiresIn=3600){
  const out:Array<{path:string;url:string}>=[];
  for(const path of paths){
    const response=await fetch(baseUrl()+'/storage/v1/object/sign/'+encodeURIComponent(bucket())+'/'+path.split('/').map(encodeURIComponent).join('/'),{
      method:'POST',
      headers:{Authorization:'Bearer '+key(),apikey:key(),'Content-Type':'application/json'},
      body:JSON.stringify({expiresIn})
    });
    if(!response.ok){out.push({path,url:''});continue;}
    const data=await response.json() as Record<string,unknown>;
    const signed=String(data.signedURL||data.signedUrl||'');
    out.push({path,url:signed?signed.startsWith('http')?signed:baseUrl()+'/storage/v1'+signed:''});
  }
  return out;
}
