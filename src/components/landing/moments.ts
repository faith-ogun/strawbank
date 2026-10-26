// The moments of one day at the stand, in scroll order. The landing page's
// text and the 3D stand both follow this list, so they never disagree.
// The clock times are an example day, not data.

export type Moment = {
  id: "open" | "tin" | "morning" | "customer" | "wrong" | "dusk";
  clock: string;
  label: string;
  /** Set when this moment starts with a photo; the frame flashes and shows what was photographed. */
  photo?: string;
};

export const MOMENTS: Moment[] = [
  { id: "open", clock: "07:30", label: "The stand opens" },
  { id: "tin", clock: "07:30", label: "The old way" },
  { id: "morning", clock: "07:40", label: "Morning set-up", photo: "Price card and shelf" },
  { id: "customer", clock: "11:15", label: "A customer", photo: "Basket" },
  { id: "wrong", clock: "11:20", label: "Something's wrong" },
  { id: "dusk", clock: "19:50", label: "Dusk", photo: "Shelf" },
];
