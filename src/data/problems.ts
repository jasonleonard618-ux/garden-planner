import type { SrcKey } from "./sources";

/** "What's wrong?" helper. Each problem cites the Extension pages it comes from. */
export type Problem = { id: string; name: string; crops: string; cat: "water" | "sun" | "feed" | "bugs" | "dis"; see: string; why: string; todo: string[]; src: SrcKey[]; svg: string };

export const PROBLEM_CATS = [["all", "All"], ["water", "Water"], ["sun", "Sun + heat"], ["feed", "Feeding"], ["bugs", "Insects"], ["dis", "Disease"]] as const;

export const PROBLEMS: Problem[] = [
 {
  "id": "blossom-end-rot",
  "name": "Blossom end rot",
  "crops": "Tomato, pepper",
  "cat": "water",
  "see": "A dark, dry, leathery patch on the bottom of the fruit.",
  "why": "The fruit runs short of calcium. Usually the soil has dried out unevenly, so the roots can't take it up.",
  "todo": [
   "Water evenly. Tomatoes need about 1.5 in a week; don't let them wilt.",
   "Mulch to hold moisture. Drip helps.",
   "Soil test: aim for pH 6.0 to 6.8."
  ],
  "src": [
   "uga",
   "msu"
  ],
  "svg": "<svg viewBox=\"0 0 64 64\"  ><circle cx=\"32\" cy=\"36\" r=\"17\" fill=\"#FF6F47\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></circle><path d=\"M26 19 L32 22 L38 19 M32 22 L32 15\" stroke=\"#5E9C7E\" stroke-width=\"2.4\" fill=\"none\" stroke-linecap=\"round\"></path><path d=\"M20 46 C 26 54, 38 54, 44 46 C 40 50, 24 50, 20 46 Z\" fill=\"#3A1A10\" stroke=\"#3A1A10\" stroke-width=\"5\" stroke-linejoin=\"round\"></path></svg>"
 },
 {
  "id": "too-much-water",
  "name": "Too much water",
  "crops": "Any crop",
  "cat": "water",
  "see": "Leaves droop or roll even though the soil is wet. The newest leaves turn pale.",
  "why": "Waterlogged roots. Iron is hard for roots to take up in poorly drained soil.",
  "todo": [
   "Let the top inch dry before watering again.",
   "Cut back the drip timer after rain.",
   "Raised beds drain better than in-ground rows."
  ],
  "src": [
   "msu",
   "uga",
   "clemsonWater"
  ],
  "svg": "<svg viewBox=\"0 0 64 64\"  ><line x1=\"10\" y1=\"56\" x2=\"54\" y2=\"56\" stroke=\"#7FC4E8\" stroke-width=\"1.6\"></line><line x1=\"16\" y1=\"60\" x2=\"48\" y2=\"60\" stroke=\"#7FC4E8\" stroke-width=\"1.2\"></line><path d=\"M32 58 L32 20\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.6\"></path><g transform=\"translate(32 30) rotate(140) scale(0.85)\"><path d=\"M0 0 C 8 -10, 22 -10, 30 0 C 22 10, 8 10, 0 0 Z\" fill=\"#C9D98A\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></path><path d=\"M2 0 L 27 0\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1\"></path></g><g transform=\"translate(32 38) rotate(40) scale(0.85)\"><path d=\"M0 0 C 8 -10, 22 -10, 30 0 C 22 10, 8 10, 0 0 Z\" fill=\"#C9D98A\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></path><path d=\"M2 0 L 27 0\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1\"></path></g><path d=\"M14 14 C 19 20, 18 25, 14 25 C 10 25, 9 20, 14 14 Z\" fill=\"#7FC4E8\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1\"></path><path d=\"M50 8 C 55 14, 54 19, 50 19 C 46 19, 45 14, 50 8 Z\" fill=\"#7FC4E8\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1\"></path></svg>"
 },
 {
  "id": "too-little-water",
  "name": "Too little water",
  "crops": "Any crop",
  "cat": "water",
  "see": "Wilting in the heat, flowers falling off, small fruit.",
  "why": "Drought stress. Dry roots also cause blossom end rot.",
  "todo": [
   "Water deeply and on a schedule rather than a little each day.",
   "Mulch around plants.",
   "Check the drip lines for clogs."
  ],
  "src": [
   "msu",
   "uga"
  ],
  "svg": "<svg viewBox=\"0 0 64 64\"  ><path d=\"M8 56 L56 56 M20 56 L24 60 M36 56 L33 61 M46 56 L50 60\" stroke=\"#C8A27A\" stroke-width=\"1.6\" fill=\"none\"></path><path d=\"M32 56 C 32 40, 30 32, 22 26\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.6\" fill=\"none\"></path><g transform=\"translate(22 26) rotate(110) scale(0.8)\"><path d=\"M0 0 C 8 -10, 22 -10, 30 0 C 22 10, 8 10, 0 0 Z\" fill=\"#5E9C7E\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></path><path d=\"M2 0 L 27 0\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1\"></path></g><g transform=\"translate(30 38) rotate(70) scale(0.8)\"><path d=\"M0 0 C 8 -10, 22 -10, 30 0 C 22 10, 8 10, 0 0 Z\" fill=\"#5E9C7E\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></path><path d=\"M2 0 L 27 0\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1\"></path></g><circle cx=\"50\" cy=\"14\" r=\"5\" fill=\"#F4C46B\"></circle><line x1=\"58.0\" y1=\"14.0\" x2=\"62.0\" y2=\"14.0\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line><line x1=\"42.0\" y1=\"14.0\" x2=\"38.0\" y2=\"14.0\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line><line x1=\"50.0\" y1=\"22.0\" x2=\"50.0\" y2=\"26.0\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line><line x1=\"50.0\" y1=\"6.0\" x2=\"50.0\" y2=\"2.0\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line><line x1=\"55.6\" y1=\"19.6\" x2=\"58.4\" y2=\"22.4\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line><line x1=\"44.4\" y1=\"19.6\" x2=\"41.6\" y2=\"22.4\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line><line x1=\"55.6\" y1=\"8.4\" x2=\"58.4\" y2=\"5.6\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line><line x1=\"44.4\" y1=\"8.4\" x2=\"41.6\" y2=\"5.6\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line></svg>"
 },
 {
  "id": "cracked-fruit",
  "name": "Cracked fruit",
  "crops": "Tomato",
  "cat": "water",
  "see": "Rings or star-shaped splits around the stem.",
  "why": "Uneven water, like heavy rain after a dry spell. The fruit swells faster than the skin can stretch.",
  "todo": [
   "Keep watering even, with drip or soaker hoses.",
   "Mulch.",
   "Pick crack-resistant varieties next year."
  ],
  "src": [
   "uga",
   "msu"
  ],
  "svg": "<svg viewBox=\"0 0 64 64\"  ><circle cx=\"32\" cy=\"36\" r=\"17\" fill=\"#FF6F47\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></circle><path d=\"M26 19 L32 22 L38 19 M32 22 L32 15\" stroke=\"#5E9C7E\" stroke-width=\"2.4\" fill=\"none\" stroke-linecap=\"round\"></path><path d=\"M32 22 L28 32 L31 38 M32 22 L38 30 L36 36 M32 22 L24 26\" stroke=\"#3A1A10\" stroke-width=\"2\" fill=\"none\" stroke-linecap=\"round\"></path></svg>"
 },
 {
  "id": "not-enough-sun",
  "name": "Not enough sun",
  "crops": "Fruiting crops",
  "cat": "sun",
  "see": "Tall, thin plants, few flowers and small fruit.",
  "why": "The bed gets fewer hours than the crop needs: 6+ for fruiting crops, 3 to 4 for leafy greens.",
  "todo": [
   "Move fruiting crops to a sunnier bed.",
   "Grow greens in the shady bed instead.",
   "The planner's sun check flags this before you plant."
  ],
  "src": [
   "isu",
   "msu"
  ],
  "svg": "<svg viewBox=\"0 0 64 64\"  ><path d=\"M32 60 L32 14\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></path><g transform=\"translate(32 16) rotate(-30) scale(0.6)\"><path d=\"M0 0 C 8 -10, 22 -10, 30 0 C 22 10, 8 10, 0 0 Z\" fill=\"#5E9C7E\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></path><path d=\"M2 0 L 27 0\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1\"></path></g><g transform=\"translate(32 24) rotate(200) scale(0.55)\"><path d=\"M0 0 C 8 -10, 22 -10, 30 0 C 22 10, 8 10, 0 0 Z\" fill=\"#5E9C7E\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></path><path d=\"M2 0 L 27 0\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1\"></path></g><circle cx=\"50\" cy=\"16\" r=\"5\" fill=\"#F4C46B\"></circle><line x1=\"58.0\" y1=\"16.0\" x2=\"62.0\" y2=\"16.0\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line><line x1=\"42.0\" y1=\"16.0\" x2=\"38.0\" y2=\"16.0\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line><line x1=\"50.0\" y1=\"24.0\" x2=\"50.0\" y2=\"28.0\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line><line x1=\"50.0\" y1=\"8.0\" x2=\"50.0\" y2=\"4.0\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line><line x1=\"55.6\" y1=\"21.6\" x2=\"58.4\" y2=\"24.4\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line><line x1=\"44.4\" y1=\"21.6\" x2=\"41.6\" y2=\"24.4\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line><line x1=\"55.6\" y1=\"10.4\" x2=\"58.4\" y2=\"7.6\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line><line x1=\"44.4\" y1=\"10.4\" x2=\"41.6\" y2=\"7.6\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line><path d=\"M40 22 C 40 16, 48 14, 50 18 C 54 16, 60 20, 57 24 L 41 24 Z\" fill=\"#9FB3AE\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.2\"></path></svg>"
 },
 {
  "id": "sunscald",
  "name": "Sunscald",
  "crops": "Tomato, pepper",
  "cat": "sun",
  "see": "A white or tan blistered patch on the sunny side of the fruit.",
  "why": "Fruit left exposed to strong sun, often after heavy pruning or leaf loss.",
  "todo": [
   "Don't over-prune. Keep leaves shading the fruit.",
   "Control leaf diseases so the canopy stays full.",
   "No cure once it shows. Prevention only."
  ],
  "src": [
   "uga",
   "msu"
  ],
  "svg": "<svg viewBox=\"0 0 64 64\"  ><circle cx=\"32\" cy=\"36\" r=\"17\" fill=\"#FF6F47\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></circle><path d=\"M26 19 L32 22 L38 19 M32 22 L32 15\" stroke=\"#5E9C7E\" stroke-width=\"2.4\" fill=\"none\" stroke-linecap=\"round\"></path><ellipse cx=\"38\" cy=\"32\" rx=\"7\" ry=\"6\" fill=\"#F4E3C8\" stroke=\"#E9D2AE\" stroke-width=\"1\"></ellipse><circle cx=\"52\" cy=\"12\" r=\"5\" fill=\"#F4C46B\"></circle><line x1=\"60.0\" y1=\"12.0\" x2=\"64.0\" y2=\"12.0\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line><line x1=\"44.0\" y1=\"12.0\" x2=\"40.0\" y2=\"12.0\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line><line x1=\"52.0\" y1=\"20.0\" x2=\"52.0\" y2=\"24.0\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line><line x1=\"52.0\" y1=\"4.0\" x2=\"52.0\" y2=\"0.0\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line><line x1=\"57.6\" y1=\"17.6\" x2=\"60.4\" y2=\"20.4\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line><line x1=\"46.4\" y1=\"17.6\" x2=\"43.6\" y2=\"20.4\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line><line x1=\"57.6\" y1=\"6.4\" x2=\"60.4\" y2=\"3.6\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line><line x1=\"46.4\" y1=\"6.4\" x2=\"43.6\" y2=\"3.6\" stroke=\"#F4C46B\" stroke-width=\"1.6\" stroke-linecap=\"round\"></line></svg>"
 },
 {
  "id": "flowers-drop-no-fruit",
  "name": "Flowers drop, no fruit",
  "crops": "Tomato, pepper",
  "cat": "sun",
  "see": "Flowers fall off without setting fruit.",
  "why": "Heat near 93°F kills the pollen. Nights below 55°F, too much nitrogen and dry soil also cause it.",
  "todo": [
   "Usually wait it out. A new set of flowers often follows.",
   "Keep watering even and don't overfeed.",
   "Try heat-set or cold-set varieties."
  ],
  "src": [
   "msu"
  ],
  "svg": "<svg viewBox=\"0 0 64 64\"  ><path d=\"M32 58 L32 20\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.6\"></path><g transform=\"translate(32 30) rotate(200) scale(0.7)\"><path d=\"M0 0 C 8 -10, 22 -10, 30 0 C 22 10, 8 10, 0 0 Z\" fill=\"#5E9C7E\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></path><path d=\"M2 0 L 27 0\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1\"></path></g><circle cx=\"44\" cy=\"44\" r=\"4\" fill=\"#F4C46B\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1\"></circle><path d=\"M44 50 L44 54 M41 52 L44 55 L47 52\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.2\" fill=\"none\"></path><rect x=\"10\" y=\"12\" width=\"7\" height=\"30\" rx=\"3.5\" fill=\"none\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></rect><circle cx=\"13.5\" cy=\"45\" r=\"5.5\" fill=\"#FF6F47\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></circle><rect x=\"12\" y=\"20\" width=\"3\" height=\"24\" fill=\"#FF6F47\"></rect></svg>"
 },
 {
  "id": "all-leaves-no-fruit",
  "name": "All leaves, no fruit",
  "crops": "Tomato, pepper, squash",
  "cat": "feed",
  "see": "Big, dark green plants with few flowers or fruit.",
  "why": "Too much nitrogen. It pushes leaves instead of flowers, and it draws aphids.",
  "todo": [
   "Feed at planting, then not again until fruit is dime-sized.",
   "Go easy on liquid fertilizer."
  ],
  "src": [
   "uga",
   "msu"
  ],
  "svg": "<svg viewBox=\"0 0 64 64\"  ><path d=\"M32 58 L32 20\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.6\"></path><g transform=\"translate(32 20) rotate(-35) scale(0.75)\"><path d=\"M0 0 C 8 -10, 22 -10, 30 0 C 22 10, 8 10, 0 0 Z\" fill=\"#2F7D5A\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></path><path d=\"M2 0 L 27 0\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1\"></path></g><g transform=\"translate(32 24) rotate(215) scale(0.75)\"><path d=\"M0 0 C 8 -10, 22 -10, 30 0 C 22 10, 8 10, 0 0 Z\" fill=\"#2F7D5A\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></path><path d=\"M2 0 L 27 0\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1\"></path></g><g transform=\"translate(32 32) rotate(-25) scale(0.75)\"><path d=\"M0 0 C 8 -10, 22 -10, 30 0 C 22 10, 8 10, 0 0 Z\" fill=\"#2F7D5A\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></path><path d=\"M2 0 L 27 0\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1\"></path></g><g transform=\"translate(32 36) rotate(205) scale(0.75)\"><path d=\"M0 0 C 8 -10, 22 -10, 30 0 C 22 10, 8 10, 0 0 Z\" fill=\"#2F7D5A\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></path><path d=\"M2 0 L 27 0\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1\"></path></g><g transform=\"translate(32 44) rotate(-20) scale(0.75)\"><path d=\"M0 0 C 8 -10, 22 -10, 30 0 C 22 10, 8 10, 0 0 Z\" fill=\"#2F7D5A\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></path><path d=\"M2 0 L 27 0\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1\"></path></g><g transform=\"translate(32 48) rotate(200) scale(0.75)\"><path d=\"M0 0 C 8 -10, 22 -10, 30 0 C 22 10, 8 10, 0 0 Z\" fill=\"#2F7D5A\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></path><path d=\"M2 0 L 27 0\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1\"></path></g></svg>"
 },
 {
  "id": "aphids",
  "name": "Aphids",
  "crops": "Kale, lettuce, pepper",
  "cat": "bugs",
  "see": "Curled young leaves, sticky residue, black sooty mold, ants.",
  "why": "Small sap-sucking insects living in colonies under the leaves.",
  "todo": [
   "Spray them off with a strong stream of water, both leaf sides.",
   "Squish them or trim curled leaves.",
   "Row cover on seedlings. Keep ladybugs and lacewings around."
  ],
  "src": [
   "umdInsects"
  ],
  "svg": "<svg viewBox=\"0 0 64 64\"  ><g transform=\"translate(8 34) rotate(-12) scale(1.6)\"><path d=\"M0 0 C 8 -10, 22 -10, 30 0 C 22 10, 8 10, 0 0 Z\" fill=\"#5E9C7E\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></path><path d=\"M2 0 L 27 0\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1\"></path></g><ellipse cx=\"26\" cy=\"28\" rx=\"2.4\" ry=\"1.8\" fill=\"#8FD3B6\" stroke=\"#1C4038\" stroke-width=\"0.6\"></ellipse><ellipse cx=\"30\" cy=\"31\" rx=\"2.4\" ry=\"1.8\" fill=\"#8FD3B6\" stroke=\"#1C4038\" stroke-width=\"0.6\"></ellipse><ellipse cx=\"34\" cy=\"27\" rx=\"2.4\" ry=\"1.8\" fill=\"#8FD3B6\" stroke=\"#1C4038\" stroke-width=\"0.6\"></ellipse><ellipse cx=\"29\" cy=\"25\" rx=\"2.4\" ry=\"1.8\" fill=\"#8FD3B6\" stroke=\"#1C4038\" stroke-width=\"0.6\"></ellipse><ellipse cx=\"37\" cy=\"31\" rx=\"2.4\" ry=\"1.8\" fill=\"#8FD3B6\" stroke=\"#1C4038\" stroke-width=\"0.6\"></ellipse><ellipse cx=\"33\" cy=\"34\" rx=\"2.4\" ry=\"1.8\" fill=\"#8FD3B6\" stroke=\"#1C4038\" stroke-width=\"0.6\"></ellipse><ellipse cx=\"24\" cy=\"32\" rx=\"2.4\" ry=\"1.8\" fill=\"#8FD3B6\" stroke=\"#1C4038\" stroke-width=\"0.6\"></ellipse></svg>"
 },
 {
  "id": "tomato-hornworm",
  "name": "Tomato hornworm",
  "crops": "Tomato, pepper",
  "cat": "bugs",
  "see": "Whole leaves gone overnight, gouged fruit, dark droppings below.",
  "why": "A big green caterpillar that blends into the leaves.",
  "todo": [
   "Hand-pick into soapy water.",
   "Leave any with white rice-like cocoons. Wasps will finish them.",
   "Spray is rarely needed."
  ],
  "src": [
   "umdInsects"
  ],
  "svg": "<svg viewBox=\"0 0 64 64\"  ><path d=\"M10 40 C 18 30, 30 30, 38 38 C 44 44, 52 42, 54 36\" stroke=\"#8FD3B6\" stroke-width=\"9\" fill=\"none\" stroke-linecap=\"round\"></path><path d=\"M16 34 l 3 4\" stroke=\"#FFFFFF\" stroke-width=\"1.2\"></path><path d=\"M22 31 l 3 4\" stroke=\"#FFFFFF\" stroke-width=\"1.2\"></path><path d=\"M28 32 l 3 4\" stroke=\"#FFFFFF\" stroke-width=\"1.2\"></path><path d=\"M34 35 l 3 4\" stroke=\"#FFFFFF\" stroke-width=\"1.2\"></path><path d=\"M40 40 l 3 4\" stroke=\"#FFFFFF\" stroke-width=\"1.2\"></path><path d=\"M46 40 l 3 4\" stroke=\"#FFFFFF\" stroke-width=\"1.2\"></path><path d=\"M54 36 L 58 28\" stroke=\"#FF6F47\" stroke-width=\"2\" stroke-linecap=\"round\"></path></svg>"
 },
 {
  "id": "squash-vine-borer",
  "name": "Squash vine borer",
  "crops": "Squash, zucchini",
  "cat": "bugs",
  "see": "A vine suddenly wilts in the heat; sawdust-like frass by a hole near the base.",
  "why": "A larva tunnels inside the stem.",
  "todo": [
   "Row cover until flowering, or wrap the base in foil.",
   "Slit the stem, remove the borer, mound soil over it.",
   "Try butternut or tromboncino, which resist it."
  ],
  "src": [
   "umdInsects"
  ],
  "svg": "<svg viewBox=\"0 0 64 64\"  ><path d=\"M26 60 L26 22 M38 60 L38 22\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></path><rect x=\"26\" y=\"22\" width=\"12\" height=\"38\" fill=\"#7FA35E\"></rect><ellipse cx=\"32\" cy=\"40\" rx=\"3\" ry=\"2.4\" fill=\"#3A1A10\"></ellipse><circle cx=\"20\" cy=\"50\" r=\"1.2\" fill=\"#E9E4D6\"></circle><circle cx=\"22\" cy=\"54\" r=\"1.2\" fill=\"#E9E4D6\"></circle><circle cx=\"18\" cy=\"57\" r=\"1.2\" fill=\"#E9E4D6\"></circle><circle cx=\"24\" cy=\"58\" r=\"1.2\" fill=\"#E9E4D6\"></circle><circle cx=\"44\" cy=\"52\" r=\"1.2\" fill=\"#E9E4D6\"></circle><circle cx=\"42\" cy=\"57\" r=\"1.2\" fill=\"#E9E4D6\"></circle><circle cx=\"46\" cy=\"58\" r=\"1.2\" fill=\"#E9E4D6\"></circle><g transform=\"translate(38 22) rotate(-40) scale(0.8)\"><path d=\"M0 0 C 8 -10, 22 -10, 30 0 C 22 10, 8 10, 0 0 Z\" fill=\"#B9C77A\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></path><path d=\"M2 0 L 27 0\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1\"></path></g></svg>"
 },
 {
  "id": "spider-mites",
  "name": "Spider mites",
  "crops": "Bean, cucumber, tomato",
  "cat": "bugs",
  "see": "Fine pale speckles, bronze leaves, fine webbing underneath.",
  "why": "Tiny mites, worst in hot, dry weather.",
  "todo": [
   "Spray leaves with water, both sides.",
   "Avoid drought stress and extra nitrogen.",
   "Skip broad pesticides; they kill mite predators."
  ],
  "src": [
   "umdInsects"
  ],
  "svg": "<svg viewBox=\"0 0 64 64\"  ><g transform=\"translate(8 32) rotate(-8) scale(1.6)\"><path d=\"M0 0 C 8 -10, 22 -10, 30 0 C 22 10, 8 10, 0 0 Z\" fill=\"#A9B98A\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></path><path d=\"M2 0 L 27 0\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1\"></path></g><circle cx=\"20\" cy=\"28\" r=\"0.9\" fill=\"#F4F0E4\"></circle><circle cx=\"24\" cy=\"32\" r=\"0.9\" fill=\"#F4F0E4\"></circle><circle cx=\"28\" cy=\"27\" r=\"0.9\" fill=\"#F4F0E4\"></circle><circle cx=\"32\" cy=\"33\" r=\"0.9\" fill=\"#F4F0E4\"></circle><circle cx=\"36\" cy=\"29\" r=\"0.9\" fill=\"#F4F0E4\"></circle><circle cx=\"40\" cy=\"34\" r=\"0.9\" fill=\"#F4F0E4\"></circle><circle cx=\"22\" cy=\"36\" r=\"0.9\" fill=\"#F4F0E4\"></circle><circle cx=\"30\" cy=\"38\" r=\"0.9\" fill=\"#F4F0E4\"></circle><circle cx=\"38\" cy=\"26\" r=\"0.9\" fill=\"#F4F0E4\"></circle><circle cx=\"44\" cy=\"31\" r=\"0.9\" fill=\"#F4F0E4\"></circle><path d=\"M44 20 L56 30 M48 18 L54 34 M44 24 L58 24\" stroke=\"rgba(255,255,255,0.7)\" stroke-width=\"0.6\"></path></svg>"
 },
 {
  "id": "early-blight",
  "name": "Early blight",
  "crops": "Tomato",
  "cat": "dis",
  "see": "Dark spots with rings on the lower leaves that spread upward.",
  "why": "A fungus that splashes up from the soil.",
  "todo": [
   "Water at the base, not overhead.",
   "Space and stake plants for air flow.",
   "Remove spotted leaves."
  ],
  "src": [
   "oregonTomato"
  ],
  "svg": "<svg viewBox=\"0 0 64 64\"  ><g transform=\"translate(6 34) rotate(-10) scale(1.7)\"><path d=\"M0 0 C 8 -10, 22 -10, 30 0 C 22 10, 8 10, 0 0 Z\" fill=\"#8FAE5A\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1.4\"></path><path d=\"M2 0 L 27 0\" stroke=\"rgba(255,255,255,0.85)\" stroke-width=\"1\"></path></g><circle cx=\"24\" cy=\"30\" r=\"5\" fill=\"#3A1A10\" stroke=\"#C9A06A\" stroke-width=\"0.8\"></circle><circle cx=\"24\" cy=\"30\" r=\"3\" fill=\"none\" stroke=\"#C9A06A\" stroke-width=\"0.6\"></circle><circle cx=\"38\" cy=\"34\" r=\"4\" fill=\"#3A1A10\" stroke=\"#C9A06A\" stroke-width=\"0.8\"></circle><circle cx=\"38\" cy=\"34\" r=\"2\" fill=\"none\" stroke=\"#C9A06A\" stroke-width=\"0.6\"></circle><circle cx=\"32\" cy=\"24\" r=\"3.5\" fill=\"#3A1A10\" stroke=\"#C9A06A\" stroke-width=\"0.8\"></circle><circle cx=\"32\" cy=\"24\" r=\"1.5\" fill=\"none\" stroke=\"#C9A06A\" stroke-width=\"0.6\"></circle></svg>"
 }
];
