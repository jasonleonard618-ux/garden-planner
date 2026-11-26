import type { SrcKey } from "./sources";

/** Season checklists. "when" is relative to the local frost dates so it works anywhere. */
export type Task = { id: string; title: string; detail: string; src: SrcKey | "app" | "practical" };
export type Group = { title: string; when: { ref: "lastSpring" | "firstFall"; fromDays: number; toDays: number }; tasks: Task[] };

export const START: Group[] = [
  {
    title: "Plan and start seeds",
    when: { ref: "lastSpring", fromDays: -84, toDays: -42 },
    tasks: [
      { id: "s-layout", title: "Check this year's layout", detail: "Move tomato-family crops to a different bed than last year.", src: "app" },
      { id: "s-lights", title: "Order seeds, set up lights", detail: "Keep lights a few inches above the seedlings and raise them as they grow.", src: "umnSeeds" },
      { id: "s-start", title: "Start the first seeds", detail: "Peppers and onions first, 8 to 12 weeks before planting out. The timeline has your dates.", src: "rutgers" },
    ],
  },
  {
    title: "Wake up the beds",
    when: { ref: "lastSpring", fromDays: -35, toDays: -7 },
    tasks: [
      { id: "s-rye", title: "End any cereal rye", detail: "Cut or crimp it a few weeks before planting so it breaks down.", src: "isuCoverEnd" },
      { id: "s-oats", title: "Leave winter-killed oats as mulch", detail: "Oats and peas die over winter; plant through them or rake them aside.", src: "isuCover" },
      { id: "s-compost", title: "Top up beds with compost", detail: "Beds settle over winter.", src: "practical" },
      { id: "s-fence", title: "Walk the fence and gate", detail: "Check panels, the buried apron and the latch.", src: "practical" },
    ],
  },
  {
    title: "Planting time",
    when: { ref: "lastSpring", fromDays: -7, toDays: 28 },
    tasks: [
      { id: "s-drip", title: "Reconnect the drip", detail: "Backflow preventer, timer, pressure regulator, filter. Flush the lines.", src: "clemsonDrip" },
      { id: "s-harden", title: "Harden off seedlings", detail: "About a week of more sun and time outside each day.", src: "rutgers" },
      { id: "s-warm", title: "Wait for warm soil for tomatoes", detail: "Cold soil stalls warm-season crops.", src: "uga" },
      { id: "s-plant", title: "Plant out on a cloudy day", detail: "Water at the base after planting.", src: "umnPlant" },
    ],
  },
];

export const END: Group[] = [
  {
    title: "As crops finish",
    when: { ref: "firstFall", fromDays: -35, toDays: 0 },
    tasks: [
      { id: "e-disease", title: "Bag diseased plants", detail: "Diseases overwinter on old leaves and stems, so don't leave them in the bed.", src: "umdFall" },
      { id: "e-cut", title: "Clear spent plants", detail: "Compost healthy tops.", src: "umdFall" },
      { id: "e-log", title: "Note what did well where", detail: "It shapes next year's layout.", src: "app" },
    ],
  },
  {
    title: "Cover the empty beds",
    when: { ref: "firstFall", fromDays: -42, toDays: -7 },
    tasks: [
      { id: "e-oats", title: "Sow oats and peas", detail: "They die over winter, so there's little to clear in spring.", src: "isuCover" },
      { id: "e-rye", title: "Late beds: cereal rye", detail: "It can go in later in fall, but it lives through winter and has to be ended in spring.", src: "isuCover" },
      { id: "e-leaves", title: "Or mulch with shredded leaves", detail: "Cover bare soil over winter.", src: "umdFall" },
    ],
  },
  {
    title: "Before the ground freezes",
    when: { ref: "firstFall", fromDays: 0, toDays: 35 },
    tasks: [
      { id: "e-soil", title: "Soil test", detail: "Through your county Extension office. Add lime only if the lab says to.", src: "umdFall" },
      { id: "e-drip", title: "Drain the drip lines", detail: "Bring the timer and filter inside.", src: "practical" },
      { id: "e-stakes", title: "Pull stakes, cages and hoses", detail: "Clean and store them for next year.", src: "umdFall" },
    ],
  },
];
