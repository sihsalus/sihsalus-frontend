import dayjs from 'dayjs';
import { createContext } from 'react';

const omrsDateFormat = 'YYYY-MM-DDTHH:mm:ss.SSSZZ';

const SelectedDateContext = createContext({
  selectedDate: dayjs().startOf('day').format(omrsDateFormat),

  setSelectedDate: (_date: string) => {},
});

export default SelectedDateContext;
