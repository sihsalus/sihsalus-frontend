interface CREDControlAgeGroupStatus {
  ageGroupLabel: string;
  status: string;
}

export function canRegisterCREDControlFromAgeGroup(
  groupLabel: string,
  currentAgeGroupLabel: string | undefined,
  controls: CREDControlAgeGroupStatus[],
): boolean {
  if (!currentAgeGroupLabel || groupLabel !== currentAgeGroupLabel) {
    return false;
  }

  return controls.some(
    (control) =>
      control.ageGroupLabel === groupLabel && control.status !== 'completed' && control.status !== 'scheduled',
  );
}
