import { db } from '@/lib/supabase';
import { myId } from '@/stores/session';
const BUCKET = 'chat-media';
export type MediaKind = 'image' | 'audio';
export interface UploadedMedia {
    path: string;
    name: string;
    mime: string;
    size: number;
}
const URL_TTL = 3600;
const signed = new Map<string, {
    url: string;
    exp: number;
}>();
export async function uploadChatMedia(cid: string, file: Blob, kind: MediaKind): Promise<{
    data: UploadedMedia | null;
    error: string | null;
}> {
    const mime = (file.type || (kind === 'image' ? 'image/jpeg' : 'audio/webm')).split(';')[0].trim().toLowerCase();
    const ext = mime.includes('png') ? 'png'
        : mime.includes('webp') ? 'webp'
            : mime.includes('mpeg') ? 'mp3'
                : mime.includes('mp4') ? 'm4a'
                    : mime.includes('ogg') ? 'ogg'
                        : mime.includes('webm') ? 'webm'
                            : mime.includes('jpeg') || mime.includes('jpg') ? 'jpg'
                                : 'bin';
    const path = `${cid}/${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage.from(BUCKET).upload(path, file, {
        contentType: mime,
        upsert: false,
    });
    if (error)
        return { data: null, error: error.message };
    return {
        data: {
            path,
            name: (file as File).name || `${kind}.${ext}`,
            mime,
            size: file.size,
        },
        error: null,
    };
}
export async function downloadMedia(path: string): Promise<{
    blob: Blob | null;
    error: string | null;
}> {
    const { data, error } = await db.storage.from(BUCKET).download(path);
    if (error || !data)
        return { blob: null, error: error?.message || '下载失败' };
    return { blob: data, error: null };
}
export function forgetMediaUrl(path: string): void {
    signed.delete(path);
}
export async function mediaUrl(path?: string | null): Promise<string | null> {
    if (!path)
        return null;
    const hit = signed.get(path);
    if (hit && hit.exp > Date.now())
        return hit.url;
    const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, URL_TTL);
    if (error || !data?.signedUrl)
        return null;
    signed.set(path, { url: data.signedUrl, exp: Date.now() + (URL_TTL - 60) * 1000 });
    return data.signedUrl;
}
export async function sendMediaMessage(cid: string, media: UploadedMedia, kind: MediaKind, duration?: number) {
    const uid = myId();
    return db.from('messages').insert({
        conversation_id: cid,
        sender_id: uid,
        body: kind === 'image' ? '[图片]' : '[语音]',
        media_type: kind,
        media_path: media.path,
        media_name: media.name,
        media_mime: media.mime,
        media_size: media.size,
        media_duration: duration ?? null,
    }).select('id,conversation_id,sender_id,body,created_at,media_type,media_path,media_mime,media_size,media_duration,is_expired').single();
}
