import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand,
  HeadBucketCommand, CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { config } from './config.js';

const { bucket, endpoint, region, accessKeyId, secretAccessKey, forcePathStyle } = config.s3;

export const s3 = new S3Client({
  endpoint, region, forcePathStyle,
  credentials: { accessKeyId, secretAccessKey },
});

const CONTENT_TYPES = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.jpg': 'image/jpeg',
  '.vtt': 'text/vtt',
  '.mp4': 'video/mp4',
};
const contentType = (f) => CONTENT_TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream';

export async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

export async function uploadFile(localPath, key) {
  await s3.send(new PutObjectCommand({
    Bucket: bucket, Key: key,
    Body: fs.createReadStream(localPath),
    ContentLength: (await fsp.stat(localPath)).size,
    ContentType: contentType(localPath),
  }));
}

export async function uploadDir(localDir, prefix) {
  for (const entry of await fsp.readdir(localDir, { withFileTypes: true })) {
    const full = path.join(localDir, entry.name);
    const key = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) await uploadDir(full, key);
    else await uploadFile(full, key);
  }
}

export async function downloadToFile(key, dest) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  await pipeline(res.Body, fs.createWriteStream(dest));
}

export async function getObject(key, range) {
  return s3.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: range }));
}

export async function deleteObject(key) {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
