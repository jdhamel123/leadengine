import {S3Client,PutObjectCommand,GetObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';

let client:S3Client|null=null;
function bucket(){const v=process.env.S3_BUCKET||'';if(!v)throw new Error('S3_BUCKET is required');return v;}
function s3(){
  if(client)return client;
  const accessKeyId=process.env.S3_ACCESS_KEY_ID||'';
  const secretAccessKey=process.env.S3_SECRET_ACCESS_KEY||'';
  client=new S3Client({
    region:process.env.S3_REGION||'us-east-1',
    endpoint:process.env.S3_ENDPOINT||undefined,
    forcePathStyle:process.env.S3_FORCE_PATH_STYLE==='true',
    credentials:accessKeyId&&secretAccessKey?{accessKeyId,secretAccessKey}:undefined
  });
  return client;
}
export async function writeS3Object(path:string,content:string,contentType:string){
  await s3().send(new PutObjectCommand({
    Bucket:bucket(),Key:path,Body:Buffer.from(content,'base64'),ContentType:contentType
  }));
  return {path};
}
export async function signedS3Urls(paths:string[],expiresIn=3600){
  const out:Array<{path:string;url:string}>=[];
  for(const path of paths){
    try{
      const url=await getSignedUrl(s3(),new GetObjectCommand({Bucket:bucket(),Key:path}),{expiresIn});
      out.push({path,url});
    }catch{out.push({path,url:''});}
  }
  return out;
}
