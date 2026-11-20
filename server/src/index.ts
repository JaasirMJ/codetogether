
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createHash, randomBytes } from "crypto";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("CodeTogether Backend is running!");
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "success",
    message: "CodeTogether API is healthy!",
  });
});

// Generate a Nexconn user access token
app.post("/api/nexconn/token", async (req, res) => {
  try {
    const { userId, name, avatarUrl = "" } = req.body;

    if (!userId || !name) {
      return res.status(400).json({
        error: "userId and name are required",
      });
    }

    const appKey = process.env.NEXCONN_APP_KEY;
    const appSecret = process.env.NEXCONN_APP_SECRET;
    const apiBase =
      process.env.NEXCONN_API_BASE_URL;

    if (!appKey || !appSecret || !apiBase) {
      return res.status(500).json({
        error: "Nexconn server configuration is missing",
      });
    }

    const nonce = randomBytes(9).toString("hex");
    const timestamp = Date.now().toString();

    const signature = createHash("sha1")
      .update(appSecret + nonce + timestamp)
      .digest("hex");

    const response = await fetch(
      `${apiBase}/v4/auth/access-token/issue`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "App-Key": appKey,
          Nonce: nonce,
          Timestamp: timestamp,
          Signature: signature,
        },
        body: JSON.stringify({
          userId,
          name,
          avatarUrl,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || data.code !== 0) {
      console.error("Nexconn token error:", data);

      return res.status(502).json({
        error: "Failed to obtain Nexconn access token",
        details: data,
      });
    }

    return res.json({
      userId: data.result.userId,
      token: data.result.accessToken,
    });

  } catch (error) {
    console.error("Token endpoint error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
