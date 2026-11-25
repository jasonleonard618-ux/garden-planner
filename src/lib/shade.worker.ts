import { sunHours, type ShadeInput } from "./shade";

self.onmessage = (e: MessageEvent<{ id: number; input: ShadeInput }>) => {
  const { id, input } = e.data;
  try {
    const hours = sunHours(input);
    (self as unknown as Worker).postMessage({ id, hours }, [hours.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
