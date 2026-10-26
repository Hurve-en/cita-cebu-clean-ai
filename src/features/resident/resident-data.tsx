export const SAMPLE_SCHEDULES = [
  {
    id: "recyclables",
    day: "Monday",
    time: "8:00 AM–11:00 AM",
    title: "Dry recyclables",
    instruction: "Keep accepted materials clean, dry, and separated.",
  },
  {
    id: "organic",
    day: "Wednesday",
    time: "8:00 AM–11:00 AM",
    title: "Organic waste",
    instruction: "Separate food scraps from packaging and containers.",
  },
  {
    id: "residual",
    day: "Friday",
    time: "8:00 AM–11:00 AM",
    title: "Residual waste",
    instruction: "Follow your barangay's containment and collection rules.",
  },
];

export const CATEGORY_GUIDANCE: Record<string, string> = {
  Glass:
    "Separate intact containers from broken glass. Ask your local collector how to package sharp pieces safely.",
  Metal:
    "Empty containers and keep sharp edges contained. Batteries and electronic equipment require separate handling.",
  Organic:
    "Separate food scraps and plant material from plastics. Check which materials your local composting program accepts.",
  Paper:
    "Keep paper and cardboard dry. Food-soiled or coated packaging may require different handling.",
  Plastic:
    "Check the packaging type and your local collector's accepted materials. A recycling symbol does not guarantee local acceptance.",
  "Non-recyclable":
    "Check local residual-waste rules. Batteries, chemicals, sharps, and electronics must not be treated as ordinary residual waste.",
};
