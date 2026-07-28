import { useQueues } from './use-queues';

export function useQueue(queueUuid?: string) {
  const { queues, ...rest } = useQueues();

  return {
    queue: queues.find((q) => q.uuid === queueUuid),
    ...rest,
  };
}
