import { useEffect, useState } from "react";

/** Eases a number from 0 up to `target` over `duration`ms (ease-out
 * cubic) — used for stat/percent displays that should "count up" into
 * place instead of snapping straight to the value on load. */
export function useCountUp(target: number, duration = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/** Returns 0 on the first paint, then `target` right after — pairs with an
 * existing CSS `transition` on the consumer (e.g. a bar's width) to make it
 * grow into place on mount instead of appearing already full. Cheaper than
 * useCountUp for things that don't also need the animated number itself. */
export function useGrowIn(target: number) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setValue(target));
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}
