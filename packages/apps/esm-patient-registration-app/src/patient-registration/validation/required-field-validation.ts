export const requiredFieldError = 'fieldRequired';

export function validateRequiredField(value: unknown): string | undefined {
  const isEmpty =
    value == null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);

  return isEmpty ? requiredFieldError : undefined;
}
