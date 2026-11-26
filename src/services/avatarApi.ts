import { db } from '@/lib/supabase';
import { session } from '@/stores/session';
const BUCKET = 'avatars';
const STATIC_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;
export function isStaticImage(file: File): boolean {
    const type = (file.type || '').toLowerCase();
    if (type.startsWith('video/'))
        return false;
    if (type === 'image/gif')
        return false;
    if (type.startsWith('image/'))
        return true;
    return STATIC_EXT.test(file.name || '');
}
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i;
export function isImageFile(file: File): boolean {
    const type = (file.type || '').toLowerCase();
    if (type)
        return type.startsWith('image/');
    return IMAGE_EXT.test(file.name || '');
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
    if (!ctx)
        throw new Error('无法处理图片');
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob)
        throw new Error('图片压缩失败');
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
const KEEP_OLD_MS = 7 * 24 * 60 * 60 * 1000;
async function removeOldAvatars(uid: string, prefix: string, keep: string): Promise<void> {
    const { data, error } = await db.storage.from(BUCKET).list(uid, { limit: 100, search: prefix });
    if (error || !data)
        return;
    const cutoff = Date.now() - KEEP_OLD_MS;
    const old = data
        .filter(f => f.name.startsWith(prefix) && f.name !== keep)
        .filter(f => {
        const ts = Number(/-(\d+)\.jpg$/.exec(f.name)?.[1] ?? 0);
        return ts > 0 && ts < cutoff;
    })
        .map(f => `${uid}/${f.name}`);
    if (old.length)
        await db.storage.from(BUCKET).remove(old);
}
export async function uploadUserAvatar(blob: Blob): Promise<string | null> {
    const uid = session.user?.id;
    if (!uid)
        return null;
    const name = `avatar-${Date.now()}.jpg`;
    const url = await put(`${uid}/${name}`, blob);
    if (!url)
        return null;
    const { error } = await db.from('profiles').update({ avatar_url: url }).eq('id', uid);
    if (error) {
        console.warn('保存头像失败：', error.message);
        void db.storage.from(BUCKET).remove([`${uid}/${name}`]);
        return null;
    }
    void removeOldAvatars(uid, 'avatar-', name);
    return url;
}
export async function uploadGroupAvatar(cid: string, blob: Blob): Promise<string | null> {
    const uid = session.user?.id;
    if (!uid)
        return null;
    const name = `group-${cid}-${Date.now()}.jpg`;
    const path = `${uid}/${name}`;
    const url = await put(path, blob);
    if (!url)
        return null;
    const { data, error } = await db.from('conversations').update({ avatar_url: url }).eq('id', cid).select('id');
    if (error || !data?.length) {
        if (error)
            console.warn('保存群头像失败：', error.message);
        void db.storage.from(BUCKET).remove([path]);
        if (!error)
            throw new Error('只有群主可以更换群头像');
        return null;
    }
    void removeOldAvatars(uid, `group-${cid}-`, name);
    return url;
}
