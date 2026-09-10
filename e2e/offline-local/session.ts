// Synthetic session adapter only for the loopback browser regression harness.
let userId = 'synthetic-a';
const subscribers = new Set<() => void>();
export function setUser(id: string) {
  userId = id;
  for (const notify of subscribers) notify();
}
export const getLoggedInUser = async () => ({ uuid: userId });
export const getSessionStore = () => ({
  getState: () => ({ loaded: true, session: { authenticated: true, user: { uuid: userId } } }),
  subscribe: (notify: () => void) => {
    subscribers.add(notify);
    return () => {
      subscribers.delete(notify);
    };
  },
});
