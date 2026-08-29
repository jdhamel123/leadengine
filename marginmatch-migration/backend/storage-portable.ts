import {writeProof,signedProofUrls} from './storage-supabase';
import {writeS3Object,signedS3Urls} from './storage-s3';

export function portableStorageMode(){
  if(process.env.S3_BUCKET)return 's3';
  if(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY)return 'supabase';
  return 'unconfigured';
}
export async function writePortableObject(path:string,content:string,contentType:string){
  if(process.env.S3_BUCKET)return writeS3Object(path,content,contentType);
  return writeProof(path,content,contentType);
}
export async function signedPortableUrls(paths:string[],expiresIn=3600){
  if(process.env.S3_BUCKET)return signedS3Urls(paths,expiresIn);
  return signedProofUrls(paths,expiresIn);
}
