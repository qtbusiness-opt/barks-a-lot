import Image from "next/image";

// Every image in the storefront goes through here so one rule about
// vector art lives in one place.
//
// next/image resizes and re-encodes photos, which is the whole point:
// an uploaded product photo straight off a phone is several megabytes,
// and customers on mobile data pay for every one of them. But Next
// refuses to run an SVG through that pipeline unless `dangerouslyAllowSVG`
// is turned on, and SVGs can carry scripts, so we'd rather not. Vector
// art is already a few kilobytes and gains nothing from resizing, so it
// is served untouched instead.
const isVector = (src) =>
  typeof src === "string" && src.toLowerCase().split("?")[0].endsWith(".svg");

export default function StoreImage({ src, alt, ...rest }) {
  return <Image src={src} alt={alt} unoptimized={isVector(src)} {...rest} />;
}
