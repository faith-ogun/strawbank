import { Placeholder } from "@/components/placeholder";

// F4 human gate. Requests over the limit, contradicted by the photo, or
// uncertain wait here with the photo and the agent's reading.
export default function RefundQueuePage() {
  return (
    <Placeholder flow="F4. Refund requests" title="Waiting for you">
      <p>Refund requests the agent may not settle on its own.</p>
    </Placeholder>
  );
}
