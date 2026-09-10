export interface OfflineHarness {
  setUser(id: string): void;
  profile(): Promise<{ phase: string } | undefined>;
  queue(): Promise<Array<{ type: string }>>;
  sync(): Promise<void>;
  add(): Promise<void>;
  clearQueue(): Promise<void>;
  message(type: string): Promise<unknown>;
}
