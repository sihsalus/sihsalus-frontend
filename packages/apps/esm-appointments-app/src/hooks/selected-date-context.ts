import dayjs from 'dayjs';
import { createContext } from 'react';

import { omrsDateFormat } from '../constants';

const SelectedDateContext = createContext({
  selectedDate: dayjs().startOf('day').format(omrsDateFormat),
  setSelectedDate: (_date: string) => {},
});

export default SelectedDateContext;
