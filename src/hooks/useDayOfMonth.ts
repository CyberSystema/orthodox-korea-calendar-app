import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Today's day-of-month, kept current across midnight.
 *
 * The tab bar's Today icon IS the date ('28.circle' on iOS, today28.png on
 * Android), so a value captured once at render would show yesterday's number to
 * anyone who leaves the app open overnight. This refreshes on two triggers:
 * a timer armed for the next local midnight, and the app returning to the
 * foreground (a backgrounded app's timers are unreliable).
 */
export function useDayOfMonth(): number {
  const [day, setDay] = useState(() => new Date().getDate());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const sync = () => {
      setDay(new Date().getDate());
      if (timer) clearTimeout(timer);
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      // +1s of slack so the timer never fires a hair before the date rolls.
      timer = setTimeout(sync, nextMidnight.getTime() - now.getTime() + 1000);
    };

    sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });

    return () => {
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return day;
}
