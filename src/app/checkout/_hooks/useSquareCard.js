import { useEffect, useRef, useState } from "react";
import { getPublicConfig } from "@/lib/public-config";
import { loadSquareSdk } from "../_lib/square-sdk";

// The Square card form for checkout's info step (`active`). Returns the
// runtime config (`square`: null while loading, then { appId, locationId },
// "" when payments aren't configured), the form's status ("off" when
// Square isn't configured | "loading" | "ready" | "error"), and a ref to
// the mounted card for tokenizing.
export function useSquareCard(active) {
  const [square, setSquare] = useState(null);
  const [cardStatus, setCardStatus] = useState("loading");
  const cardRef = useRef(null);

  useEffect(() => {
    let ignore = false;
    getPublicConfig().then((cfg) => {
      if (ignore) return;
      setSquare({
        appId: cfg.squareAppId,
        locationId: cfg.squareLocationId,
      });
      if (!cfg.squareAppId) setCardStatus("off");
    });
    return () => {
      ignore = true;
    };
  }, []);

  // Mount the Square card form on the info step; the iframe keeps card
  // details inside Square — they never touch our servers.
  useEffect(() => {
    if (!active || !square?.appId) return undefined;
    let cancelled = false;
    let cardInstance;
    (async () => {
      try {
        const Square = await loadSquareSdk(square.appId);
        const payments = square.locationId
          ? Square.payments(square.appId, square.locationId)
          : Square.payments(square.appId);
        cardInstance = await payments.card();
        if (cancelled) {
          cardInstance.destroy();
          return;
        }
        await cardInstance.attach("#card-container");
        // Left the info step while attaching: cleanup has already
        // destroyed this instance, so it must not become the live card.
        if (cancelled) return;
        cardRef.current = cardInstance;
        setCardStatus("ready");
      } catch (err) {
        console.error("[checkout] Square init failed:", err);
        if (!cancelled) setCardStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      cardRef.current = null;
      cardInstance?.destroy();
    };
  }, [active, square]);

  // Leaving the info step tears the card form down; it shows "loading"
  // again until the effect above re-mounts it.
  const markCardReloading = () => {
    if (square?.appId) setCardStatus("loading");
  };

  return { square, cardStatus, cardRef, markCardReloading };
}
