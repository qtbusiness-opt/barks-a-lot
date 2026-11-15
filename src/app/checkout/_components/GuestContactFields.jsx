import Link from "next/link";
import { inputClass } from "./checkout-ui";

// Only guests see these; a signed-in customer's contact details come from
// their account. `update(field, value)` writes into the page's form state.
export default function GuestContactFields({ form, update }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[#2A4A52]">Guest Checkout</h2>
        <Link
          href="/login"
          className="text-sm text-[#3A6270] font-medium hover:underline"
        >
          Have an account? Log in
        </Link>
      </div>
      <div>
        <label
          htmlFor="guest-name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Name
        </label>
        <input
          id="guest-name"
          type="text"
          value={form.guestName}
          onChange={(e) => update("guestName", e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label
          htmlFor="guest-email"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Email
        </label>
        <input
          id="guest-email"
          type="email"
          value={form.guestEmail}
          onChange={(e) => update("guestEmail", e.target.value)}
          required
          className={inputClass}
        />
      </div>
    </>
  );
}
