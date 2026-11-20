
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createHash, randomBytes } from "crypto";

dotenv.config();

console.log("[DEBUG] Environment loaded");

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Health check
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
    const apiBase = process.env.NEXCONN_API_BASE_URL;

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
      console.error("[Nexconn] Token error:", data);

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
    console.error("[Nexconn] Token endpoint error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

// Add a user to an existing Nexconn group
app.post("/api/nexconn/group/join", async (req, res) => {
  try {
    const { roomId, userId } = req.body;

    if (!roomId || !userId) {
      return res.status(400).json({
        error: "roomId and userId are required",
      });
    }

    const appKey = process.env.NEXCONN_APP_KEY;
    const appSecret = process.env.NEXCONN_APP_SECRET;
    const apiBase = process.env.NEXCONN_API_BASE_URL;

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
      `${apiBase}/v4/group-channel/join`,
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
          channelId: roomId,
          userIds: [userId],
        }),
      }
    );

    const data = await response.json();

    console.log("[Nexconn] Add group member response:", data);

    if (!response.ok || data.code !== 0) {
      return res.status(502).json({
        error: "Failed to add user to Nexconn group",
        details: data,
      });
    }

    return res.json({
      success: true,
      message: "User added to Nexconn group",
      result: data.result,
    });
  } catch (error) {
    console.error("[Nexconn] Group member error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

// Save a collaborative room's code to GitHub
app.post("/api/github/commit", async (req, res) => {
  try {
    const { roomId, fileName, content, commitMessage } = req.body;

    if (!roomId || !fileName || typeof content !== "string") {
      return res.status(400).json({
        error: "roomId, fileName and content are required",
      });
    }

    if (
      !/^[a-zA-Z0-9_-]+$/.test(roomId) ||
      !/^[a-zA-Z0-9._-]+$/.test(fileName) ||
      fileName === "." ||
      fileName === ".."
    ) {
      return res.status(400).json({
        error: "Invalid room ID or filename",
      });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    if (!githubToken || !owner || !repo) {
      return res.status(500).json({
        error: "GitHub configuration is missing",
      });
    }

    const path = `rooms/${roomId}/${fileName}`;

    const headers = {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };

    const apiUrl =
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    // Check whether the file already exists
    let existingSha: string | undefined;

    const existingResponse = await fetch(apiUrl, {
      method: "GET",
      headers,
    });

    if (existingResponse.ok) {
      const existingData = await existingResponse.json();

      if (existingData.type !== "file") {
        return res.status(409).json({
          error: "The target path is not a file",
        });
      }

      existingSha = existingData.sha;
    } else if (existingResponse.status !== 404) {
      const errorData = await existingResponse.json();

      console.error("[GitHub] Lookup error:", errorData);

      return res.status(502).json({
        error: "Failed to check existing GitHub file",
        details: errorData.message,
      });
    }

    // Create or update the file
    const saveResponse = await fetch(apiUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message:
          commitMessage ||
          `Save ${fileName} from CodeTogether room ${roomId}`,
        content: Buffer.from(content, "utf8").toString("base64"),
        ...(existingSha ? { sha: existingSha } : {}),
      }),
    });

    const saveData = await saveResponse.json();

    if (!saveResponse.ok) {
      console.error("[GitHub] Save error:", saveData);

      return res.status(502).json({
        error: "GitHub failed to save the file",
        details: saveData.message,
      });
    }

    console.log("[GitHub] File saved:", path);

    return res.json({
      success: true,
      message: "Code successfully saved to GitHub",
      path,
      commitUrl: saveData.commit.html_url,
      fileUrl: saveData.content?.html_url,
    });
  } catch (error) {
    console.error("[GitHub] Commit error:", error);

    return res.status(500).json({
      error: "Failed to save code to GitHub",
    });
  }
});

// Start backend server
console.log("[DEBUG] Reached app.listen");

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
