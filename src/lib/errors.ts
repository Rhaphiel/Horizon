export function friendlyAuthError(message?: string): string {
    const m = (message || '').toLowerCase();
    if (m.includes('database error'))
        return '用户名已被占用或格式不对';
    if (m.includes('already registered'))
        return '该邮箱已注册，请直接登录';
    if (m.includes('invalid login'))
        return '账号（或邮箱）或密码不正确';
    if (m.includes('password'))
        return '密码不符合要求（至少 6 位）';
    if (m.includes('rate limit'))
        return '操作太频繁，请稍后再试';
    if (m.includes('failed to fetch') || m.includes('network'))
        return '网络连接失败，请检查网络';
    if (m.includes('email'))
        return '邮箱格式不正确';
    return '出错了：' + (message || '未知错误');
}
const RPC_MESSAGES: Array<[
    string,
    string
]> = [
    ['not_owner', '只有群主可以执行这个操作'],
    ['friendship_ended', '你们已不是好友，不能再发消息'],
    ['not friends', '只能添加你的好友'],
    ['not_friends', '只能添加你的好友'],
    ['already_member', '对方已经在群里了'],
    ['group_full', '群成员已达上限（50 人）'],
    ['not_group', '这不是群聊'],
    ['not_member', '对方或你已不在这个聊天里'],
    ['cannot_remove_self', '不能移出自己，请使用“退出群聊”'],
    ['bad group name', '群名称需要 1–30 个字'],
    ['bad member count', '请至少选择一位好友'],
    ['not logged in', '请先登录'],
    ['failed to fetch', '网络连接失败，请检查网络'],
];
export function friendlyRpcError(message?: string): string {
    const m = (message || '').toLowerCase();
    for (const [key, text] of RPC_MESSAGES)
        if (m.includes(key))
            return text;
    return '操作失败：' + (message || '未知错误');
}
export function friendlySendError(message?: string): string {
    const m = (message || '').toLowerCase();
    if (m.includes('friendship_ended'))
        return '你们已不是好友，不能再发消息';
    if (m.includes('bad_media_path'))
        return '发送失败：文件路径不对，请重新选择';
    if (m.includes('failed to fetch'))
        return '网络连接失败，请检查网络';
    return '发送失败：' + (message || '未知错误');
}
