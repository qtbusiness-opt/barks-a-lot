import { inputClass } from "./checkout-ui";

function AddressField({ id, label, value, onChange }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(id, e.target.value)}
        required
        className={inputClass}
      />
    </div>
  );
}

// Only shown for shipped orders; pickup orders need no address. Each
// field's id doubles as its key in the page's form state.
export default function ShippingAddressFields({ form, update }) {
  return (
    <>
      <h2 className="text-xl font-semibold text-[#2A4A52]">Shipping Address</h2>
      <AddressField
        id="address"
        label="Street Address"
        value={form.address}
        onChange={update}
      />
      <AddressField
        id="city"
        label="City"
        value={form.city}
        onChange={update}
      />
      <div className="grid grid-cols-2 gap-4">
        <AddressField
          id="state"
          label="State"
          value={form.state}
          onChange={update}
        />
        <AddressField
          id="zip"
          label="ZIP Code"
          value={form.zip}
          onChange={update}
        />
      </div>
    </>
  );
}
