import { useEffect, useState } from "react";
import api from "@/lib/api";
import { orderLinePayload } from "../_lib/order-payload";

const NO_DISCOUNT = { discountTotal: 0, applied: [] };

// Promo code the customer types, the code actually applied, and the
// server-computed discount preview. Only a preview: the order API
// recomputes discounts authoritatively.
export function usePromotions(items) {
  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [discount, setDiscount] = useState(NO_DISCOUNT);
  const [codeError, setCodeError] = useState("");
  const [checkingCode, setCheckingCode] = useState(false);

  // Preview discounts (automatic bundles + any applied code) whenever the
  // cart or applied code changes. A quick cart edit fires overlapping
  // previews; only the latest may land, or an older total could sit
  // beside the newer cart.
  useEffect(() => {
    if (items.length === 0) {
      setDiscount({ discountTotal: 0, applied: [] });
      return undefined;
    }
    let ignore = false;
    api
      .post("/promotions/validate", {
        items: items.map(orderLinePayload),
        ...(appliedCode ? { code: appliedCode } : {}),
      })
      .then((res) => {
        if (ignore) return;
        setDiscount({
          discountTotal: res.data.discountTotal,
          applied: res.data.applied,
        });
        // A code that stopped being valid (deactivated) clears itself.
        if (appliedCode && res.data.codeError) {
          setCodeError(res.data.codeError);
          setAppliedCode("");
        }
      })
      .catch(() => {
        if (!ignore) setDiscount({ discountTotal: 0, applied: [] });
      });
    return () => {
      ignore = true;
    };
  }, [items, appliedCode]);

  const applyCode = async () => {
    const code = codeInput.trim();
    if (!code) return;
    setCodeError("");
    setCheckingCode(true);
    try {
      const res = await api.post("/promotions/validate", {
        items: items.map(orderLinePayload),
        code,
      });
      if (res.data.codeError) {
        setCodeError(res.data.codeError);
        setAppliedCode("");
      } else {
        setAppliedCode(code);
        setDiscount({
          discountTotal: res.data.discountTotal,
          applied: res.data.applied,
        });
      }
    } catch {
      setCodeError("Couldn't check that code — please try again.");
    } finally {
      setCheckingCode(false);
    }
  };

  const removeCode = () => {
    setAppliedCode("");
    setCodeInput("");
    setCodeError("");
  };

  return {
    codeInput,
    setCodeInput,
    appliedCode,
    discount,
    codeError,
    checkingCode,
    applyCode,
    removeCode,
  };
}
