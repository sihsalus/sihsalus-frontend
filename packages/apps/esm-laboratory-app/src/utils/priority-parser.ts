export interface ExtractedPriority {
  urgency: string;
  cleanInstructions: string;
}

export const extractPriorityFromInstructions = (
  instructions: string | undefined,
  defaultUrgency: string
): ExtractedPriority => {
  if (!instructions) {
    return { urgency: defaultUrgency, cleanInstructions: '' };
  }
  const match = instructions.match(/(.*?)\s*\|\|priorityUuid:([a-fA-F0-9-]+)\|\|\s*$/);
  if (match) {
    return {
      urgency: match[2],
      cleanInstructions: match[1].trim(),
    };
  }
  return {
    urgency: defaultUrgency,
    cleanInstructions: instructions,
  };
};
