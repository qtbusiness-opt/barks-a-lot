import { formatPickupDay } from "@/lib/format-date";
import { formatSlot } from "@/lib/pickup-window";
import { formatEventDate, inputClass } from "./checkout-ui";

// The day and half-hour slot pickers. Full days and full slots stay in
// the lists, disabled, so the customer can see they exist.
function PickupDayAndTime({
  schedule,
  chosenDay,
  setPickupDay,
  chosenTime,
  setPickupTime,
  pickupDetails,
}) {
  const daySlots = schedule.days.find((d) => d.day === chosenDay)?.slots ?? [];
  return (
    <div className="mt-3 space-y-2">
      <label htmlFor="pickup-day" className="sr-only">
        Pickup day
      </label>
      <select
        id="pickup-day"
        value={chosenDay}
        onChange={(e) => setPickupDay(e.target.value)}
        required
        className={inputClass}
      >
        <option value="" disabled>
          Choose a day...
        </option>
        {schedule.days.map(({ day, slots }) => {
          const full = !slots.some((slot) => slot.available);
          return (
            <option key={day} value={day} disabled={full}>
              {formatPickupDay(day)}
              {full ? " — fully booked" : ""}
            </option>
          );
        })}
      </select>
      <label htmlFor="pickup-time" className="sr-only">
        Pickup time
      </label>
      <select
        id="pickup-time"
        value={chosenTime}
        onChange={(e) => setPickupTime(e.target.value)}
        required
        disabled={!chosenDay}
        className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-600`}
      >
        <option value="" disabled>
          {chosenDay ? "Choose a time..." : "Choose a day first"}
        </option>
        {daySlots.map(({ time, available }) => (
          <option key={time} value={time} disabled={!available}>
            {formatSlot(time)}
            {available ? "" : " — full"}
          </option>
        ))}
      </select>
      <p className="text-sm text-gray-700 bg-[#F5F0E8] p-3 rounded-lg">
        {pickupDetails}
      </p>
      <p className="text-xs text-gray-600">
        Pickup is Monday–Saturday in 30-minute time slots, booked at least a day
        ahead.
      </p>
    </div>
  );
}

// The pickup choice on the info step: a pickup day and half-hour slot.
// The event options (next event, a chosen event) only appear while
// EVENT_PICKUP_ENABLED is on; with one kind of pickup there's nothing to
// choose between, so the radios go away too.
export default function PickupOptions({
  hasEvents,
  offersScheduled,
  activePickupMode,
  setPickupMode,
  pickupChoiceLost,
  nextEvent,
  events,
  pickupChoice,
  setPickupChoice,
  schedule,
  chosenDay,
  setPickupDay,
  chosenTime,
  setPickupTime,
  pickupDetails,
}) {
  return (
    <fieldset>
      <legend className="block text-xl font-semibold text-[#2A4A52] mb-2">
        {hasEvents ? "Pickup Option" : "Pickup Day & Time"}
      </legend>
      {pickupChoiceLost && (
        <p
          role="alert"
          className="text-sm text-amber-800 bg-amber-50 p-3 rounded-lg mb-3"
        >
          That pickup option isn&rsquo;t available anymore — please choose
          another.
        </p>
      )}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4">
        {hasEvents && (
          <>
            <label className="flex items-center gap-3 border border-gray-300 rounded-lg px-4 py-3 min-h-12 cursor-pointer has-checked:border-[#4A7C8A] has-checked:bg-[#F5F0E8]">
              <input
                type="radio"
                name="pickup-mode"
                value="next"
                checked={activePickupMode === "next"}
                onChange={() => setPickupMode("next")}
              />
              <span className="text-sm font-medium">Next Event</span>
            </label>
            <label className="flex items-center gap-3 border border-gray-300 rounded-lg px-4 py-3 min-h-12 cursor-pointer has-checked:border-[#4A7C8A] has-checked:bg-[#F5F0E8]">
              <input
                type="radio"
                name="pickup-mode"
                value="choose"
                checked={activePickupMode === "choose"}
                onChange={() => setPickupMode("choose")}
              />
              <span className="text-sm font-medium">Choose Event</span>
            </label>
          </>
        )}
        {hasEvents && offersScheduled && (
          <label className="flex items-center gap-3 border border-gray-300 rounded-lg px-4 py-3 min-h-12 cursor-pointer has-checked:border-[#4A7C8A] has-checked:bg-[#F5F0E8]">
            <input
              type="radio"
              name="pickup-mode"
              value="scheduled"
              checked={activePickupMode === "scheduled"}
              onChange={() => setPickupMode("scheduled")}
            />
            <span className="text-sm font-medium">Pickup Day &amp; Time</span>
          </label>
        )}
      </div>

      {activePickupMode === "next" ? (
        nextEvent && (
          <p className="text-sm text-gray-700 bg-[#F5F0E8] p-3 rounded-lg mt-3">
            <strong>{nextEvent.title}</strong> — {formatEventDate(nextEvent)}
          </p>
        )
      ) : activePickupMode === "choose" ? (
        <div className="mt-3">
          <label htmlFor="pickup-event" className="sr-only">
            Pickup event
          </label>
          <select
            id="pickup-event"
            value={pickupChoice}
            onChange={(e) => setPickupChoice(e.target.value)}
            required
            className={inputClass}
          >
            <option value="" disabled>
              Choose an event...
            </option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} — {formatEventDate(event)}
              </option>
            ))}
          </select>
        </div>
      ) : activePickupMode === "scheduled" ? (
        <PickupDayAndTime
          schedule={schedule}
          chosenDay={chosenDay}
          setPickupDay={setPickupDay}
          chosenTime={chosenTime}
          setPickupTime={setPickupTime}
          pickupDetails={pickupDetails}
        />
      ) : null}
    </fieldset>
  );
}
