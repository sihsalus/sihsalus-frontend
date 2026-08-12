export interface ExtractedPriority {
  urgency: string;
  cleanInstructions: string;
}

export const extractPriorityFromInstructions = (
  instructions: string | undefined,
  defaultUrgency: string,
): ExtractedPriority => {
  if (!instructions) {
    return { urgency: defaultUrgency, cleanInstructions: '' };
  }
  const match = instructions.match(/\|\|priorityUuid:([a-fA-F0-9-]+)\|\|/);
  const cleanInstructions = instructions.replace(/\s*\|\|priorityUuid:[a-fA-F0-9-]+\|\|/g, '').trim();
  if (match) {
    return {
      urgency: match[1],
      cleanInstructions,
    };
  }
  return {
    urgency: defaultUrgency,
    cleanInstructions,
  };
};
