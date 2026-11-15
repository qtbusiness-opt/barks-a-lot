export default function OrderSummary({
  items,
  subtotal,
  discount = 0,
  applied = [],
}) {
  const total = Math.max(0, subtotal - discount);
  return (
    <div className="bg-[#F5F0E8] rounded-xl p-4 sm:p-6">
      <h2 className="text-xl font-semibold text-[#2A4A52] mb-4">
        Order Summary
      </h2>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.key} className="flex justify-between text-sm">
            <span>
              {item.name} x {item.quantity}
              {item.optionsLabel && (
                <span className="block text-xs text-gray-600">
                  {item.optionsLabel}
                </span>
              )}
            </span>
            <span className="font-medium">
              ${(item.price * item.quantity).toFixed(2)}
            </span>
          </div>
        ))}
        <hr className="border-[#E8DFC8]" />
        {discount > 0 && (
          <>
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-green-800">
              <span>Discount</span>
              <span>−${discount.toFixed(2)}</span>
            </div>
            {applied.length > 0 && (
              <ul className="text-xs text-green-800 list-disc pl-4">
                {applied.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
          </>
        )}
        <div className="flex justify-between font-bold text-lg">
          <span>Total</span>
          <span className="text-[#8A4D1A]">${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
