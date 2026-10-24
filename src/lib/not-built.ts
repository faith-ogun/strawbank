/** Response for an API route that is laid out but not built yet. */
export function notBuilt(flow: string): Response {
  return Response.json({ error: "not built yet", flow }, { status: 501 });
}
