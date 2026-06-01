import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const IST = 'Asia/Kolkata';

export function useLiveClock(): string {
  const [time, setTime] = useState(() =>
    format(toZonedTime(new Date(), IST), 'EEE, dd MMM · HH:mm:ss')
  );

  useEffect(() => {
    const id = setInterval(() => {
      setTime(format(toZonedTime(new Date(), IST), 'EEE, dd MMM · HH:mm:ss'));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}
