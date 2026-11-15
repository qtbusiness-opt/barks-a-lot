import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { EVENT_PICKUP_ENABLED } from "@/lib/features";
import {
  isPickupSelectable,
  eventDayKey,
  dayKeyOf,
  PICKUP_FALLBACK,
} from "@/lib/pickup-window";

const NO_SCHEDULE = { enabled: false, details: "", days: [] };

const fetchSchedule = () =>
  api
    .get("/pickup/days")
    .then((res) => res.data)
    .catch(() => NO_SCHEDULE);

// What pickup the server offers: upcoming events still open for pickup,
// and the scheduled pickup — { enabled, details, days: [{ day, slots:
// [{ time, available }] }] }, null while loading. The server decides
// which days and slots are bookable.
//
// Each load ignores a response that lands after cleanup, so a slow,
// stale response can't write into a page the customer has left.
export function usePickupData() {
  const [upcomingEvents, setUpcomingEvents] = useState(null);
  const [schedule, setSchedule] = useState(null);

  useEffect(() => {
    let ignore = false;
    api
      .get("/events?upcoming=true")
      .then((res) => {
        if (!ignore) setUpcomingEvents(res.data.events);
      })
      .catch(() => {
        if (!ignore) setUpcomingEvents([]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    fetchSchedule().then((data) => {
      if (!ignore) setSchedule(data);
    });
    return () => {
      ignore = true;
    };
  }, []);

  // Called again after a refused order, so a day that just became
  // same-day (store midnight) or a slot that just filled drops out.
  const reloadSchedule = useCallback(() => {
    fetchSchedule().then(setSchedule);
  }, []);

  // No same-day pickup (shared rule with the orders API).
  const events = EVENT_PICKUP_ENABLED
    ? (upcomingEvents ?? []).filter((e) => isPickupSelectable(e))
    : [];
  // True only when today's own event is the thing missing from `events`,
  // so the note doesn't show for an ordinary quiet week.
  const hasSameDayEvent =
    EVENT_PICKUP_ENABLED &&
    (upcomingEvents ?? []).some((e) => eventDayKey(e) === dayKeyOf());

  return {
    events,
    hasSameDayEvent,
    schedule,
    pickupOptionsLoaded: upcomingEvents !== null && schedule !== null,
    pickupDetails: schedule?.details || PICKUP_FALLBACK,
    reloadSchedule,
  };
}
