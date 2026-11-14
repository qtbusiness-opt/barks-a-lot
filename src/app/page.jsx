import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import StoreImage from "@/components/StoreImage";
import {
  ArrowRightIcon,
  BagIcon,
  CalendarIcon,
  LeafIcon,
  PawIcon,
} from "@/components/Icons";
import {
  cardProps,
  getCategories,
  getLatestAnnouncement,
  getListedProducts,
  getNextEvent,
} from "@/lib/storefront";
import { getPickupSettings, getSettings } from "@/lib/site-settings";
import { formatTime } from "@/lib/pickup-window";
import { formatCalendarDay } from "@/lib/format-date";
import { toDayKey } from "@/lib/calendar-days";
import { ABOUT_IMAGE_KEYS } from "@/lib/about-images";
import { SHIPPING_ENABLED } from "@/lib/features";

// Featured products, the announcement, the next market and the pickup hours
// are all admin-managed, so render at request time rather than at build.
export const dynamic = "force-dynamic";

const FEATURED_LIMIT = 4;

// A failed query leaves its tile empty instead of taking the whole home
// page down; the detail goes to the server log, never to the visitor.
async function safely(label, promise, fallback) {
  try {
    return await promise;
  } catch (err) {
    console.error(`Home page: ${label} failed`, err);
    return fallback;
  }
}

// The photo's caption as the admin sees it ("Meeko & Evee"), used as alt text.
const imageLabel = (key) =>
  ABOUT_IMAGE_KEYS.find((k) => k.key === key)?.hint ?? "";

// Shared look of the bento tiles: soft shadow is the single container
// signal, no border. Linked tiles lift 2px on hover (hover-capable devices
// only — Tailwind's hover: variant already gates on that).
const tile = "rounded-xl shadow-(--shadow-card) p-5 sm:p-6 min-w-0";
const tileLink = `${tile} block transition-transform duration-(--dur-short) ease-(--ease-out) hover:-translate-y-0.5`;
const tileTitle = "font-heading text-xl sm:text-2xl leading-tight text-balance";
const textLink =
  "inline-flex items-center gap-2 min-h-11 font-semibold underline underline-offset-4 decoration-2";

export default async function HomePage() {
  const [products, categories, announcement, nextEvent, pickup, images] =
    await Promise.all([
      safely(
        "featured products",
        getListedProducts({ featured: true }),
        []
      ),
      safely("categories", getCategories(), []),
      safely("announcement", getLatestAnnouncement(), null),
      safely("next event", getNextEvent(), null),
      safely("pickup settings", getPickupSettings(), null),
      safely(
        "about images",
        getSettings(["about_image_dogs", "about_image_family"]),
        {}
      ),
    ]);

  const featured = products.slice(0, FEATURED_LIMIT);
  const heroPhoto = images.about_image_dogs;
  const familyPhoto = images.about_image_family;

  return (
    <div>
      {/* Latest store announcement */}
      {announcement && (
        <div className="bg-brand-accent-strong text-brand-on">
          <p className="max-w-7xl mx-auto safe-x py-2.5 text-sm text-center">
            <span className="font-bold">{announcement.title}:</span>{" "}
            {announcement.body}
          </p>
        </div>
      )}

      {/* Hero — copy left, a real picture right, stacks below 60rem */}
      <section>
        <div className="max-w-7xl mx-auto safe-x pt-10 pb-14 sm:pt-16 sm:pb-24 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16 lg:items-center lg:min-h-[min(75dvh,45rem)]">
          <div className="min-w-0">
            <h1 className="font-heading text-[length:var(--text-display)] leading-[1.05] text-brand-ink">
              Home-baked treats for good dogs.
            </h1>
            <p className="mt-6 max-w-[48ch] text-lg text-brand-ink-2">
              Organic dog treats baked at home, plus handmade bandanas. Order
              online and pick up locally.
            </p>
            <Link
              href="/products"
              className="mt-8 inline-flex items-center justify-center min-h-12 whitespace-nowrap rounded-full bg-brand-accent-strong px-7 text-lg font-semibold text-brand-on transition-colors duration-(--dur-micro) ease-(--ease-out) hover:bg-brand-accent-deep"
            >
              Shop all products
            </Link>
          </div>

          {heroPhoto ? (
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-brand-paper-2">
              <StoreImage
                src={heroPhoto}
                alt={imageLabel("about_image_dogs")}
                fill
                preload
                sizes="(max-width: 1024px) 100vw, 42vw"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="grid place-items-center aspect-square w-full max-w-md mx-auto lg:max-w-none rounded-xl bg-brand-paper-3">
              <StoreImage
                src="/images/barks-a-lot-logo.png"
                alt="Barks-A-Lot Treats & More"
                width={320}
                height={320}
                preload
                className="h-3/5 w-3/5 rounded-full object-cover"
              />
            </div>
          )}
        </div>
      </section>

      {/* Bento — what to know at a glance. Six tiles of real content. */}
      <section aria-labelledby="glance-heading" className="max-w-7xl mx-auto safe-x pb-14 sm:pb-24">
        <h2 id="glance-heading" className="sr-only">
          At a glance
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[minmax(11rem,auto)]">
          {/* Categories — 2×2 */}
          <div className={`${tile} bg-brand-paper-3 md:col-span-2 lg:row-span-2`}>
            <h3 className={`${tileTitle} text-brand-ink`}>Shop by category</h3>
            {categories.length > 0 ? (
              <ul className="mt-4">
                {categories.map((cat) => (
                  <li key={cat.slug} className="border-t border-brand-rule first:border-t-0">
                    <Link
                      href={`/products?category=${cat.slug}`}
                      className="group flex min-h-14 items-center justify-between gap-4 py-2 font-heading font-semibold text-xl sm:text-2xl text-brand-ink"
                    >
                      <span className="min-w-0 group-hover:underline underline-offset-4 decoration-2">
                        {cat.name}
                      </span>
                      <ArrowRightIcon className="h-5 w-5 shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-brand-ink-2">
                Categories are on their way.
              </p>
            )}
            <Link href="/products" className={`${textLink} mt-4 text-brand-ink`}>
              See everything
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          {/* Next market — 2×1, deep teal */}
          <div className={`${tile} on-dark bg-brand-deep text-brand-paper md:col-span-2`}>
            <div className="flex items-start gap-3">
              <CalendarIcon className="h-7 w-7 shrink-0 text-brand-paper-3" />
              <div className="min-w-0">
                <h3 className={tileTitle}>Next market</h3>
                {nextEvent ? (
                  <>
                    <p className="mt-2 font-heading font-semibold text-lg">
                      {formatCalendarDay(nextEvent.date, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    <p className="mt-1 text-brand-paper-3">
                      {nextEvent.title}
                      {nextEvent.startTime
                        ? ` · ${formatTime(nextEvent.startTime)}`
                        : ""}
                      {nextEvent.location ? ` · ${nextEvent.location}` : ""}
                    </p>
                    <Link
                      href={`/events/${toDayKey(nextEvent.date)}`}
                      className={`${textLink} mt-2`}
                    >
                      Event details
                      <ArrowRightIcon className="h-4 w-4" />
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-brand-paper-3">
                      No markets on the calendar yet — check back soon.
                    </p>
                    <Link href="/events" className={`${textLink} mt-2`}>
                      See events
                      <ArrowRightIcon className="h-4 w-4" />
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Pickup — 1×1 */}
          <div className={`${tile} bg-brand-paper-2`}>
            <BagIcon className="h-7 w-7 text-brand-ink-2" />
            <h3 className={`${tileTitle} mt-3 text-brand-ink`}>
              {SHIPPING_ENABLED ? "Pickup or shipping" : "Pickup, not shipping"}
            </h3>
            {pickup?.enabled ? (
              <p className="mt-2 text-brand-ink-2">
                Order online, then choose a Monday–Saturday slot at least a day
                ahead. Pickup hours are {formatTime(pickup.hours.start)}–
                {formatTime(pickup.hours.end)}.
              </p>
            ) : pickup ? (
              <p className="mt-2 text-brand-ink-2">
                Online ordering is paused right now. Check Events to see where
                to find us.
              </p>
            ) : (
              <p className="mt-2 text-brand-ink-2">
                Order online and choose a pickup day and time at checkout.
              </p>
            )}
          </div>

          {/* Handmade — 1×1 */}
          <div className={`${tile} bg-brand-paper-2`}>
            <LeafIcon className="h-7 w-7 text-brand-ink-2" />
            <h3 className={`${tileTitle} mt-3 text-brand-ink`}>
              Organic and{" "}
              <span className="whitespace-nowrap">home-baked</span>
            </h3>
            <p className="mt-2 text-brand-ink-2">
              Pet-friendly ingredients, no preservatives, no fillers.
            </p>
          </div>

          {/* Family — 2×1 */}
          <Link href="/about" className={`${tileLink} bg-brand-paper-3 text-brand-ink md:col-span-2`}>
            <div className="flex items-center gap-4">
              {familyPhoto ? (
                <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg">
                  <StoreImage
                    src={familyPhoto}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </span>
              ) : (
                <PawIcon className="h-9 w-9 shrink-0 text-brand-ink-2" />
              )}
              <div className="min-w-0">
                <h3 className={tileTitle}>Meet the family</h3>
                <p className="mt-1 text-brand-ink-2">
                  Quinn, Nabil, Meeko and Evee.
                </p>
              </div>
            </div>
          </Link>

          {/* Custom bandanas — 2×1 */}
          <Link href="/contact" className={`${tileLink} bg-brand-paper-2 text-brand-ink md:col-span-2`}>
            <h3 className={tileTitle}>Want a custom bandana?</h3>
            <p className="mt-1 text-brand-ink-2">
              Send us a message and ask.
            </p>
          </Link>
        </div>
      </section>

      {/* Featured products */}
      {featured.length > 0 && (
        <section className="bg-brand-paper-2 pt-12 pb-14 sm:pt-16 sm:pb-24">
          <div className="max-w-7xl mx-auto safe-x">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 mb-8">
              <h2 className="font-heading text-3xl sm:text-4xl text-brand-ink">
                Featured products
              </h2>
              <Link href="/products" className={`${textLink} text-brand-ink`}>
                View all products
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              {featured.map((product) => (
                <ProductCard key={product.id} {...cardProps(product)} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
