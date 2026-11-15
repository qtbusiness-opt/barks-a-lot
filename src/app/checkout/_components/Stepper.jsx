export default function Stepper({ step }) {
  return (
    <ol
      aria-label="Checkout progress"
      className="flex items-center gap-2 text-sm font-medium mb-6"
    >
      {["Your Info", "Review & Pay"].map((label, i) => {
        const active = step === i;
        const done = step > i;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className="flex items-center gap-2"
          >
            {i > 0 && (
              <span
                aria-hidden="true"
                className="w-6 sm:w-10 h-px bg-gray-300"
              />
            )}
            <span
              aria-hidden="true"
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                done
                  ? "bg-green-700 text-white"
                  : active
                    ? "bg-[#4A7C8A] text-white"
                    : "bg-gray-200 text-gray-600"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={active ? "text-[#2A4A52]" : "text-gray-600"}>
              {label}
              {done && <span className="sr-only"> (completed)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
