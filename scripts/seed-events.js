// Idempotent: only seeds when the events table is empty. Dates are
// relative to seed time so dev calendars always show something upcoming.
async function seedEvents(prisma) {
  const count = await prisma.event.count();
  if (count > 0) return 0;

  const day = 24 * 60 * 60 * 1000;
  const atMidnightUTC = (ts) => {
    const d = new Date(ts);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  };

  const events = [
    {
      title: "Farmers Market",
      description:
        "Find our booth at the downtown farmers market! Fresh-baked treats, bandanas, and free samples for your pup.",
      location: "Downtown Farmers Market, Meridian, ID",
      date: atMidnightUTC(Date.now() + 3 * day),
      color: "teal",
    },
    {
      title: "Pet Expo",
      description:
        "We're at the regional pet expo all day — stop by booth 42 for expo-only bundle deals and plushie adoptions.",
      location: "Expo Idaho, Garden City, ID",
      date: atMidnightUTC(Date.now() + 12 * day),
      color: "orange",
    },
  ];

  for (const event of events) {
    await prisma.event.create({ data: event });
  }
  return events.length;
}

module.exports = seedEvents;
