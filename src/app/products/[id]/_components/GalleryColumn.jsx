import StoreImage from "@/components/StoreImage";

// The product's cover image, its gallery extras, and — when the customer
// picks an option choice that has a thumbnail of its own — that choice's
// photo, appended as one more entry. Clicking the big photo advances to
// the next one; thumbnails jump straight to an image.
//
// `photos` is [{ src, label, key }] from buildGallery, where a label
// marks a choice's photo ("Style: Plaid") and null marks one of the
// product's own.
export default function GalleryColumn({
  productName,
  photos,
  imageIndex,
  setImageIndex,
}) {
  // The list shrinks when a choice is unpicked, so never trust the index
  // to still be in range.
  const index = Math.min(Math.max(imageIndex, 0), photos.length - 1);
  const altFor = (photo, i) =>
    photo.label
      ? `${productName} — ${photo.label}`
      : `${productName} — photo ${i + 1} of ${photos.length}`;

  if (photos.length <= 1) {
    return (
      <div className="relative aspect-square bg-[#F5F0E8] rounded-xl overflow-hidden self-start">
        <StoreImage
          src={photos[0].src}
          alt={productName}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain"
        />
      </div>
    );
  }

  return (
    <div className="self-start">
      <button
        type="button"
        onClick={() => setImageIndex((index + 1) % photos.length)}
        aria-label={`${altFor(photos[index], index)} — show next photo`}
        className="relative block w-full aspect-square bg-[#F5F0E8] rounded-xl overflow-hidden cursor-pointer"
      >
        <StoreImage
          src={photos[index].src}
          alt={altFor(photos[index], index)}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain"
        />
      </button>
      <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
        {photos.map((photo, i) => (
          <button
            key={photo.key}
            type="button"
            onClick={() => setImageIndex(i)}
            aria-label={
              photo.label
                ? `Show ${photo.label}`
                : `Show photo ${i + 1} of ${photos.length}`
            }
            aria-current={index === i ? "true" : undefined}
            className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition ${
              index === i
                ? "border-[#4A7C8A]"
                : "border-transparent opacity-70 hover:opacity-100"
            }`}
          >
            <StoreImage
              src={photo.src}
              alt=""
              width={48}
              height={48}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-gray-600 mt-2">
        Click the photo to see the next one
      </p>
    </div>
  );
}
