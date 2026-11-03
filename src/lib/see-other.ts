/**
 * A 303 redirect to a path on this site. The Location stays relative: behind
 * Cloud Run, request.url names the container's own address (0.0.0.0:8080),
 * not the public one.
 */
export const seeOther = (path: string) => new Response(null, { status: 303, headers: { Location: path } });
