import { getSettings, ABOUT_IMAGE_KEYS } from "@/lib/site-settings";

export const metadata = {
  title: "About Us — Barks-A-Lot Treats & More",
  description:
    "Meet Quinn, Nabil, Meeko, and Evee — the family behind Barks-A-Lot Treats & More.",
};

// Photos are admin-editable (Admin → About Page), so render at request
// time rather than statically.
export const dynamic = "force-dynamic";

// Shows the admin-uploaded photo, or a labeled placeholder until one is set.
function SectionImage({ src, label }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={label}
        className="w-full aspect-[4/3] rounded-2xl object-cover bg-[#F5F0E8]"
      />
    );
  }
  return (
    <div
      className="w-full aspect-[4/3] rounded-2xl bg-[#F5F0E8] border-2 border-dashed border-[#4A7C8A]/30 flex flex-col items-center justify-center text-center p-6"
      role="img"
      aria-label={`${label} (image coming soon)`}
    >
      <span aria-hidden="true" className="text-4xl mb-2">
        🐾
      </span>
      <span className="text-sm font-medium text-[#4A7C8A]">{label}</span>
      <span className="text-xs text-gray-400 mt-1">Image coming soon</span>
    </div>
  );
}

// One story section. `flip` puts the image on the left (text on the
// right); default is image-right. Stacks image-first on mobile.
function Section({ title, imageLabel, imageSrc, flip = false, children }) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
      <div className={flip ? "md:order-2" : "md:order-1"}>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#2A4A52] mb-4">
          {title}
        </h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          {children}
        </div>
      </div>
      <div className={flip ? "md:order-1" : "md:order-2"}>
        <SectionImage src={imageSrc} label={imageLabel} />
      </div>
    </section>
  );
}

export default async function AboutPage() {
  const images = await getSettings(ABOUT_IMAGE_KEYS.map((k) => k.key));
  return (
    <div className="max-w-5xl mx-auto safe-x py-8 sm:py-12">
      <header className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-[#2A4A52]">
          About Us
        </h1>
      </header>

      <div className="space-y-16">
        {/* Section 1 — image right */}
        <Section
          title="Meet the Family"
          imageLabel="Quinn & Nabil"
          imageSrc={images.about_image_family}
        >
          <p>
            We&rsquo;re Quinn and Nabil, the humans behind Barks-A-Lot Treats
            &amp; More. In the summer of 2024, we decided to move to the
            Treasure Valley, chasing a little more room to breathe and a lot
            more room for our dogs to run and play. That fresh start ended up
            being the beginning of something even bigger.
          </p>
        </Section>

        {/* Section 2 — image left */}
        <Section
          title="The Inspiration"
          imageLabel="Meeko & Evee"
          imageSrc={images.about_image_dogs}
          flip
        >
          <p>Everything we do here traces back to two very good dogs.</p>
          <p>
            <strong>Meeko</strong> is our tan maltipoo and a real stud muffin.
            At seven years old, he&rsquo;s been part of our family the longest.
            He can be a bit of a troublemaker with strangers at first, all bark
            and no follow-through, but it never takes long before he warms up
            and shows you he&rsquo;s really the sweetest guy around. He spends
            his days chasing squirrels, sunbathing, and making friends with the
            biggest dogs at the dog park.
          </p>
          <p>
            <strong>Evee</strong> is our white chipoo and an absolute cutie. She
            was rescued in early 2026 and is turning one year old on Halloween
            2026. She&rsquo;s the self-appointed chaos coordinator of the
            household, on a personal mission to find and shred any stray piece
            of trash before we can stop her. When she isn&rsquo;t busy with that
            important work, you&rsquo;ll find her pestering Meeko, napping under
            the couch, chasing sprinklers, or giving you her very best pleading
            eyes for a bite of whatever is in your hand.
          </p>
        </Section>

        {/* Section 3 — image right */}
        <Section
          title="How Barks-A-Lot Began"
          imageLabel="Home-baked treats"
          imageSrc={images.about_image_treats}
        >
          <p>
            Nabil set out with one simple goal: find a treat Meeko would
            actually enjoy, made with all-natural ingredients. Meeko, our
            resident food critic, gave his enthusiastic approval, and that was
            all the encouragement Nabil needed to start sharing the recipe with
            our community.
          </p>
          <p>
            Every batch is home-baked with organic, pet-friendly ingredients and
            nothing else. No preservatives, no fillers, no mystery ingredients.
            Just treats made the way we&rsquo;d want them made for our own dogs,
            because that&rsquo;s exactly what they deserve.
          </p>
        </Section>
      </div>

      {/* Closing */}
      <div className="mt-16 pt-10 border-t border-gray-200 text-center max-w-2xl mx-auto">
        <p className="text-lg text-gray-700">
          Thank you for stopping by. We hope you and your best friend find
          something here worth wagging about.
        </p>
        <div className="mt-8 space-y-4">
          <blockquote className="text-[#4A7C8A] italic">
            &ldquo;The LORD is good to all, and has compassion on all He has
            made.&rdquo;
            <cite className="block not-italic text-sm text-gray-500 mt-1">
              Psalm 145:9
            </cite>
          </blockquote>
          <blockquote className="text-[#4A7C8A] italic">
            &ldquo;A righteous person cares for the life of his animal.&rdquo;
            <cite className="block not-italic text-sm text-gray-500 mt-1">
              Proverbs 12:10
            </cite>
          </blockquote>
        </div>
      </div>
    </div>
  );
}
