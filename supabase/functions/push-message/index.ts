import { createClient } from "npm:@supabase/supabase-js@2";
import { JWT } from "npm:google-auth-library@^10";
type MessageRecord = {
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string | null;
    media_type?: string | null;
    created_at: string;
};
type WebhookPayload = {
    type: string;
    table: string;
    schema: string;
    record: MessageRecord;
};
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type, x-push-webhook-secret",
};
Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
    }
    const webhookSecret = Deno.env.get("PUSH_WEBHOOK_SECRET");
    if (!webhookSecret || req.headers.get("x-push-webhook-secret") !== webhookSecret) {
        return Response.json({ error: "Unauthorized webhook" }, { status: 401, headers: corsHeaders });
    }
    try {
        const payload = await req.json() as WebhookPayload;
        if (payload.type !== "INSERT" || payload.table !== "messages" || payload.schema !== "public") {
            return Response.json({ skipped: true, reason: "Not a public.messages INSERT" }, { headers: corsHeaders });
        }
        const message = payload.record;
        if (!message?.conversation_id || !message?.sender_id) {
            return Response.json({ error: "Invalid message record" }, { status: 400, headers: corsHeaders });
        }
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const serviceAccountRaw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
        if (!supabaseUrl || !serviceRoleKey || !serviceAccountRaw) {
            throw new Error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or FCM_SERVICE_ACCOUNT_JSON secret");
        }
        const serviceAccount = JSON.parse(serviceAccountRaw);
        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: members, error: membersError } = await admin
            .from("conversation_members")
            .select("user_id")
            .eq("conversation_id", message.conversation_id);
        if (membersError)
            throw membersError;
        const { data: mutes, error: mutesError } = await admin
            .from("conversation_mutes")
            .select("user_id")
            .eq("conversation_id", message.conversation_id);
        if (mutesError)
            console.warn("read conversation_mutes failed:", mutesError.message);
        const mutedIds = new Set((mutes || []).map((row: {
            user_id: string;
        }) => row.user_id));
        const recipientIds = [...new Set((members || [])
                .map((row: {
                user_id: string;
            }) => row.user_id)
                .filter((id: string) => id && id !== message.sender_id && !mutedIds.has(id)))];
        if (!recipientIds.length) {
            return Response.json({ sent: 0, reason: "No recipients (or all muted)" }, { headers: corsHeaders });
        }
        const [{ data: devices, error: devicesError }, { data: sender }, { data: conversation }] = await Promise.all([
            admin.from("push_tokens").select("id,user_id,token").eq("provider", "fcm").in("user_id", recipientIds),
            admin.from("profiles").select("username").eq("id", message.sender_id).maybeSingle(),
            admin.from("conversations").select("type,name").eq("id", message.conversation_id).maybeSingle(),
        ]);
        if (devicesError)
            throw devicesError;
        if (!devices?.length) {
            return Response.json({ sent: 0, reason: "No FCM devices registered" }, { headers: corsHeaders });
        }
        const senderName = sender?.username || "新消息";
        const title = conversation?.type === "group" && conversation?.name
            ? `${conversation.name} · ${senderName}`
            : senderName;
        const mediaType = (message.media_type || "text").toLowerCase();
        const mediaText = mediaType === "image" ? "[图片] 24 小时内有效"
            : mediaType === "audio" ? "[语音] 24 小时内有效"
                : mediaType === "video" ? "[视频] 24 小时内有效"
                    : mediaType === "file" ? "[文件] 24 小时内有效"
                        : "";
        const body = (mediaText || (message.body || "（新消息）")).replace(/\s+/g, " ").slice(0, 160);
        const jwtClient = new JWT({
            email: serviceAccount.client_email,
            key: serviceAccount.private_key,
            scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
        });
        const access = await jwtClient.getAccessToken();
        const accessToken = typeof access === "string" ? access : access.token;
        if (!accessToken)
            throw new Error("Could not obtain Google OAuth access token");
        const endpoint = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;
        const results = await Promise.all((devices || []).map(async (device: {
            id: string;
            token: string;
        }) => {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: {
                        token: device.token,
                        notification: { title, body },
                        data: {
                            cid: message.conversation_id,
                            conversation_id: message.conversation_id,
                            message_id: message.id,
                            sender_id: message.sender_id,
                        },
                        android: {
                            priority: "HIGH",
                            notification: {
                                channel_id: "msg",
                                tag: `horizon-${message.conversation_id}`,
                                visibility: "PUBLIC",
                                notification_count: 1,
                            },
                        },
                    },
                }),
            });
            const responseBody = await response.json().catch(() => ({}));
            if (!response.ok) {
                const errorCode = responseBody?.error?.details?.find((detail: {
                    errorCode?: string;
                }) => detail.errorCode)?.errorCode;
                if (errorCode === "UNREGISTERED") {
                    await admin.from("push_tokens").delete().eq("id", device.id);
                }
                return { ok: false, status: response.status, error: responseBody };
            }
            return { ok: true };
        }));
        const sent = results.filter((result) => result.ok).length;
        return Response.json({ sent, attempted: results.length, results }, { headers: corsHeaders });
    }
    catch (error) {
        console.error("push-message failed:", error);
        return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: corsHeaders });
    }
});
