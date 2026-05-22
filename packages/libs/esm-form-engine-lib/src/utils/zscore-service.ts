import dayjs from 'dayjs';
import filter from 'lodash-es/filter';
import bfaMale5Above from '../zscore/bfa_boys_5_above.json';
import bfaFemale5Above from '../zscore/bfa_girls_5_above.json';
import hfaMale5Above from '../zscore/hfa_boys_5_above.json';
import hfaMaleBelow5 from '../zscore/hfa_boys_below5.json';
import hfaFemale5Above from '../zscore/hfa_girls_5_above.json';
import hfaFemaleBelow5 from '../zscore/hfa_girls_below5.json';
import wflMaleBelow5 from '../zscore/wfl_boys_below5.json';
import wflFemaleBelow5 from '../zscore/wfl_girls_below5.json';

type ZScoreRefRow = Record<string, string | number>;

interface ZScoreRefModel {
  weightForHeightRef: ZScoreRefRow[] | null;
  heightForAgeRef: ZScoreRefRow[] | null;
  bmiForAgeRef: ZScoreRefRow[] | null;
}

export function getZRefByGenderAndAge(gender: string, birthDate: Date, refdate: Date): ZScoreRefModel {
  const scoreRefModel: ZScoreRefModel = {
    weightForHeightRef: null,
    heightForAgeRef: null,
    bmiForAgeRef: null,
  };
  const age = getAge(birthDate, refdate, 'years');
  const ageInMonths = getAge(birthDate, refdate, 'months');
  const ageInDays = getAge(birthDate, refdate, 'days');

  if (gender === 'F') {
    if (age < 5) {
      scoreRefModel.weightForHeightRef = wflFemaleBelow5;
      scoreRefModel.heightForAgeRef = getScoreReference(hfaFemaleBelow5, 'Day', ageInDays);
    }
    if (age >= 5 && age < 18) {
      scoreRefModel.bmiForAgeRef = getScoreReference(bfaFemale5Above, 'Month', ageInMonths);
      scoreRefModel.heightForAgeRef = getScoreReference(hfaFemale5Above, 'Month', ageInMonths);
    }
  }
  if (gender === 'M') {
    if (age < 5) {
      scoreRefModel.weightForHeightRef = wflMaleBelow5;
      scoreRefModel.heightForAgeRef = getScoreReference(hfaMaleBelow5, 'Day', ageInDays);
    }

    if (age >= 5 && age < 18) {
      scoreRefModel.bmiForAgeRef = getScoreReference(bfaMale5Above, 'Month', ageInMonths);
      scoreRefModel.heightForAgeRef = getScoreReference(hfaMale5Above, 'Month', ageInMonths);
    }
  }
  return scoreRefModel;
}

function getScoreReference(refData: ZScoreRefRow[], searchKey: string, searchValue: number): ZScoreRefRow[] {
  return filter(refData, (refObject) => {
    return refObject[searchKey] === searchValue;
  });
}

function getAge(birthdate: Date, refDate: Date, ageIn: dayjs.OpUnitType): number | null {
  if (birthdate && refDate && ageIn) {
    const todayMoment = dayjs(refDate);
    const birthDateMoment = dayjs(birthdate);
    return todayMoment.diff(birthDateMoment, ageIn);
  }
  return null;
}
