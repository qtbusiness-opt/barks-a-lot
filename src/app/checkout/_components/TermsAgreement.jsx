import Link from "next/link";

export default function TermsAgreement({ agreed, setAgreed }) {
  return (
    <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
      <input
        type="checkbox"
        checked={agreed}
        onChange={(e) => setAgreed(e.target.checked)}
        required
        className="mt-1 h-4 w-4 shrink-0 accent-[#4A7C8A]"
      />
      <span>
        I have read and agree to the{" "}
        <Link
          href="/privacy"
          target="_blank"
          className="text-[#3A6270] underline hover:text-[#2A4A52]"
        >
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link
          href="/terms"
          target="_blank"
          className="text-[#3A6270] underline hover:text-[#2A4A52]"
        >
          Terms of Service
        </Link>
        .
      </span>
    </label>
  );
}
