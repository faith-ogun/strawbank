import { Placeholder } from "@/components/placeholder";

// F1. The AI reads the price card and counts the shelf; nothing is priced
// until the grower confirms. The confirmed list becomes the day's catalogue.
export default function MorningPage() {
  return (
    <Placeholder flow="F1. Morning set-up" title="Set up the stand">
      <p>Photograph the price card, then the stocked shelf. Check what the AI read and correct anything wrong.</p>
    </Placeholder>
  );
}
