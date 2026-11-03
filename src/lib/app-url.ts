/**
 * The app's public address. Behind Cloud Run, request.url names the container
 * (0.0.0.0:8080), so anything PayPal sends a browser back to is built from this.
 */
export const appUrl = () => process.env.APP_URL ?? "https://strawbank-434001576954.europe-west1.run.app";
