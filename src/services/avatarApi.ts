import { db } from '@/lib/supabase';
import { session } from '@/stores/session';

// 头像上传：裁剪器已经输出 512×512 的 JPEG，这里只负责传到 Storage 并把公开地址写回数据库。
// 目录约定：{userId}/avatar-*.jpg（用户头像）、{userId}/group-{cid}-*.jpg（群头像）
// 存储策略限制“只能写自己 user id 目录”，见 supabase/migrations/202611230002_avatars.sql

const BUCKET = 'avatars';

// 只允许静态图片：拒绝视频和 GIF。
// 手机相册/文件选择器经常给出奇怪的类型（空字符串、image/jpg、image/heic 等），
// 所以这里改成「黑名单式」判断，避免误杀正常照片。
const STATIC_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;

export function isStaticImage(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('video/')) return false;
  if (type === 'image/gif') return false;
  if (type.startsWith('image/')) return true;        // jpeg/png/webp/heic/…
  return STATIC_EXT.test(file.name || '');          // 类型为空时按扩展名判断
}

export async function compressImage(file: File, max = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法处理图片');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('图片压缩失败');
  return blob;
}

async function put(path: string, blob: Blob): Promise<string | null> {
  const { error } = await db.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) {
    console.warn('头像上传失败：', error.message);
    return null;
  }
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function uploadUserAvatar(blob: Blob): Promise<string | null> {
  const uid = session.user?.id;
  if (!uid) return null;
  const url = await put(`${uid}/avatar-${Date.now()}.jpg`, blob);
  if (!url) return null;
  const { error } = await db.from('profiles').update({ avatar_url: url }).eq('id', uid);
  if (error) {
    console.warn('保存头像失败：', error.message);
    return null;
  }
  return url;
}

export async function uploadGroupAvatar(cid: string, blob: Blob): Promise<string | null> {
  const uid = session.user?.id;
  if (!uid) return null;
  const url = await put(`${uid}/group-${cid}-${Date.now()}.jpg`, blob);
  if (!url) return null;
  const { error } = await db.from('conversations').update({ avatar_url: url }).eq('id', cid);
  if (error) {
    console.warn('保存群头像失败：', error.message);
    return null;
  }
  return url;
}
