
import { NCEngine } from "@nexconn/chat";

let initialized = false;
let connectionPromise: Promise<string> | null = null;

export async function connectNexconn(
  userId: string,
  name: string
): Promise<string> {
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    const response = await fetch(
      "http://localhost:5000/api/nexconn/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, name }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to obtain Nexconn token");
    }

    const { token } = await response.json();

    if (!initialized) {
      NCEngine.initialize({
        appKey: import.meta.env.VITE_NEXCONN_APP_KEY,
      });

      initialized = true;
    }

    const result = await NCEngine.connect({ token });

    if (!result.isOk) {
      throw new Error("Nexconn connection failed");
    }

    return userId;
  })();

  try {
    return await connectionPromise;
  } catch (error) {
    connectionPromise = null;
    throw error;
  }
}
