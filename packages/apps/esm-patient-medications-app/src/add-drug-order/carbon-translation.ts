const carbonTranslations: Record<string, string> = {
  'clear.all': 'Clear all selected items',
  'clear.selection': 'Clear selected item',
  'close.menu': 'Close menu',
  'decrement.number': 'Decrement number',
  'increment.number': 'Increment number',
  'open.menu': 'Open menu',
};

export function translateCarbonWithId(messageId: string): string {
  return carbonTranslations[messageId] ?? messageId;
}
