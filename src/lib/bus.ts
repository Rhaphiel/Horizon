type Handler = (payload: any) => void;
const handlers = new Map<string, Set<Handler>>();
export function on<T = unknown>(event: string, fn: (payload: T) => void): () => void {
    let set = handlers.get(event);
    if (!set) {
        set = new Set<Handler>();
        handlers.set(event, set);
    }
    set.add(fn as Handler);
    return () => {
        handlers.get(event)?.delete(fn as Handler);
    };
}
export function emit<T = unknown>(event: string, payload?: T): void {
    handlers.get(event)?.forEach(fn => {
        try {
            fn(payload);
        }
        catch (e) {
            console.error(e);
        }
    });
}
