export function isUsernameOk(u: string): boolean {
    const chars = Array.from(u);
    if (chars.length < 2 || chars.length > 20)
        return false;
    for (const ch of chars) {
        if (/[\s!-/:-@[-`{-~]/.test(ch))
            return false;
        const cp = ch.codePointAt(0) ?? 0;
        if ((cp >= 8203 && cp <= 8205)
            || (cp >= 8592 && cp <= 8703)
            || (cp >= 9728 && cp <= 10175)
            || (cp >= 65024 && cp <= 65039)
            || (cp >= 127744 && cp <= 129791))
            return false;
    }
    return true;
}
