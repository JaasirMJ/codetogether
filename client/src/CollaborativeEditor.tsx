
import { useEffect, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import type { editor } from "monaco-editor";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const YJS_SERVER_URL =
  import.meta.env.VITE_YJS_URL || "ws://localhost:1234";

const STARTER_CODE = `// Welcome to CodeTogether!

function hello() {
  console.log("Hello, world!");
}

hello();
`;

interface CollaborativeEditorProps {
  roomId: string;
  displayName: string;
  userId: string;
  onCollaboratorsChange: (users: Record<string, string>) => void;
}

type SaveStatus = "idle" | "saving" | "success" | "error";

interface Commit {
  sha: string;
  shortSha: string;
  message: string;
  contributor: {
    name: string;
    id: string | null;
    githubUsername: string | null;
    avatarUrl: string | null;
  };
  date: string | null;
  commitUrl: string;
  files: {
    fileName: string;
    status: string;
    additions: number;
    deletions: number;
  }[];
}

const SUPPORTED_LANGUAGES = [
  { id: "typescript", label: "TypeScript" },
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "json", label: "JSON" },
] as const;

type SupportedLanguage =
  (typeof SUPPORTED_LANGUAGES)[number]["id"];

function isSupportedLanguage(
  value: unknown
): value is SupportedLanguage {
  return (
    typeof value === "string" &&
    SUPPORTED_LANGUAGES.some((language) => language.id === value)
  );
}

function formatCommitDate(date: string | null) {
  if (!date) return "Date unavailable";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Date unavailable";
  }

  return parsedDate.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function CollaborativeEditor({
  roomId,
  displayName,
  userId,
  onCollaboratorsChange,
}: CollaborativeEditorProps) {
  const [editorInstance, setEditorInstance] =
    useState<editor.IStandaloneCodeEditor | null>(null);

  const [connectionStatus, setConnectionStatus] =
    useState("Connecting...");

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const [fileName, setFileName] = useState("main.ts");
  const [commitMessage, setCommitMessage] = useState("");
  const [savedFileName, setSavedFileName] = useState("");
  const [commitUrl, setCommitUrl] = useState("");

  const [sharedDocument, setSharedDocument] =
    useState<Y.Text | null>(null);

  const [language, setLanguage] =
    useState<SupportedLanguage>("typescript");

  const [sharedMetadata, setSharedMetadata] =
    useState<Y.Map<unknown> | null>(null);

  const [isLanguageReady, setIsLanguageReady] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const handleEditorMount: OnMount = (editor) => {
    setEditorInstance(editor);
  };

  // Fetch GitHub commit history for this room
  const loadCommitHistory = async () => {
    try {
      setIsLoadingHistory(true);
      setHistoryError("");

      const response = await fetch(
        `${API_BASE_URL}/api/github/rooms/${encodeURIComponent(roomId)}/commits`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to load commit history."
        );
      }

      setCommits(Array.isArray(data.commits) ? data.commits : []);
    } catch (error) {
      console.error("[GitHub] History error:", error);

      setHistoryError(
        error instanceof Error
          ? error.message
          : "Unable to load commit history."
      );
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const toggleCommitHistory = () => {
    const shouldOpen = !historyOpen;

    setHistoryOpen(shouldOpen);

    if (shouldOpen) {
      void loadCommitHistory();
    }
  };

  // Download the current shared file
  const downloadFile = () => {
    if (!sharedDocument) {
      return;
    }

    const cleanFileName = fileName.trim();

    if (
      !cleanFileName ||
      !/^[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/.test(cleanFileName) ||
      cleanFileName === "." ||
      cleanFileName === ".."
    ) {
      alert("Please enter a valid filename before downloading.");
      return;
    }

    const content = sharedDocument.toString();

    const blob = new Blob([content], {
      type: "text/plain;charset=utf-8",
    });

    const downloadUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = cleanFileName;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(downloadUrl);

    console.log(
      `[CodeTogether] Downloaded ${cleanFileName}`
    );
  };

  useEffect(() => {
    if (!editorInstance) return;

    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("codetogether");

    const metadata = ydoc.getMap<unknown>("codetogether-metadata");

    const provider = new WebsocketProvider(
      YJS_SERVER_URL,
      `codetogether-${roomId}`,
      ydoc
    );

    const model = editorInstance.getModel();

    if (!model) {
      provider.destroy();
      ydoc.destroy();
      return;
    }

    const colors = [
      "#E06C75",
      "#61AFEF",
      "#98C379",
      "#C678DD",
      "#E5C07B",
    ];

    const userColor =
      colors[Math.floor(Math.random() * colors.length)];

    provider.awareness.setLocalStateField("user", {
      name: displayName.trim() || "Collaborator",
      color: userColor,
      userId,
    });

    const cursorStyle = document.createElement("style");

    cursorStyle.id = `codetogether-cursors-${roomId}`;
    document.head.appendChild(cursorStyle);

    const updateCursorStyles = () => {
      const css = Array.from(
        provider.awareness.getStates().entries()
      )
        .map(([clientId, state]) => {
          const user = state.user as
            | { name?: string; color?: string }
            | undefined;

          if (!user) return "";

          const name = user.name || "Collaborator";

          const color =
            /^#[0-9a-fA-F]{6}$/.test(user.color || "")
              ? user.color
              : "#61AFEF";

          return `
            .yRemoteSelection-${clientId} {
              background-color: ${color}55;
            }

            .yRemoteSelectionHead-${clientId} {
              border-left: 2px solid ${color};
              position: absolute;
              height: 100%;
              box-sizing: border-box;
            }

            .yRemoteSelectionHead-${clientId}::after {
              content: ${JSON.stringify(name)};
              position: absolute;
              top: -1.5em;
              left: -2px;
              padding: 3px 7px;
              border-radius: 4px;
              background-color: ${color};
              color: white;
              font-size: 11px;
              font-weight: 600;
              white-space: nowrap;
              pointer-events: none;
              z-index: 1000;
            }
          `;
        })
        .join("\n");

      const collaborators: Record<string, string> = {};

      provider.awareness.getStates().forEach((state) => {
        const user = state.user as
          | { name?: string; userId?: string }
          | undefined;

        if (user?.userId) {
          collaborators[user.userId] =
            user.name || "Collaborator";
        }
      });

      onCollaboratorsChange(collaborators);
      cursorStyle.textContent = css;
    };

    provider.awareness.on("update", updateCursorStyles);
    updateCursorStyles();

    // Synchronize filename and language across collaborators.
    const updateSharedMetadata = () => {
      const sharedLanguage = metadata.get("language");
      const sharedFileName = metadata.get("fileName");

      if (isSupportedLanguage(sharedLanguage)) {
        setLanguage(sharedLanguage);
      }

      if (typeof sharedFileName === "string") {
        setFileName(sharedFileName);
      }
    };

    metadata.observe(updateSharedMetadata);

    provider.on("status", ({ status }: { status: string }) => {
      setConnectionStatus(
        status === "connected" ? "Connected" : "Connecting..."
      );

      console.log(`[Yjs ${roomId}] Connection status:`, status);
    });

    let binding: MonacoBinding | null = null;

    provider.on("sync", (isSynced: boolean) => {
      if (!isSynced) return;

      console.log(`[Yjs ${roomId}] Document synchronized`);

      if (!metadata.has("language")) {
        metadata.set("language", "typescript");
      }

      if (!metadata.has("fileName")) {
        metadata.set("fileName", "main.ts");
      }

      updateSharedMetadata();

      setSharedMetadata(metadata);
      setIsLanguageReady(true);

      if (binding) return;

      if (ytext.length === 0) {
        ytext.insert(0, STARTER_CODE);
      }

      binding = new MonacoBinding(
        ytext,
        model,
        new Set([editorInstance]),
        provider.awareness
      );

      setSharedDocument(ytext);

      console.log(`[Yjs ${roomId}] Monaco binding initialized`);
    });

    ytext.observe(() => {
      console.log(
        `[Yjs ${roomId}] Document updated:`,
        ytext.toString()
      );
    });

    return () => {
      binding?.destroy();

      provider.awareness.off("update", updateCursorStyles);
      metadata.unobserve(updateSharedMetadata);

      cursorStyle.remove();

      setSharedDocument(null);
      setSharedMetadata(null);
      setIsLanguageReady(false);

      provider.destroy();
      ydoc.destroy();

      console.log(`[Yjs ${roomId}] Connection cleaned up`);
    };
  }, [
    roomId,
    editorInstance,
    displayName,
    userId,
    onCollaboratorsChange,
  ]);

  // Change language for everyone in this room.
  const handleLanguageChange = (nextLanguage: string) => {
    if (!isSupportedLanguage(nextLanguage)) return;

    setLanguage(nextLanguage);

    if (sharedMetadata) {
      sharedMetadata.set("language", nextLanguage);

      console.log(
        `[Yjs ${roomId}] Shared language changed to:`,
        nextLanguage
      );
    }
  };

  // Save the shared Yjs document to GitHub
  const saveToGitHub = async () => {
    if (!sharedDocument) {
      setSaveStatus("error");
      setSaveMessage("Shared document is not ready yet.");
      return;
    }

    const cleanFileName = fileName.trim();

    if (!cleanFileName) {
      setSaveStatus("error");
      setSaveMessage("Please enter a filename.");
      return;
    }

    if (
      !/^[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/.test(cleanFileName) ||
      cleanFileName === "." ||
      cleanFileName === ".."
    ) {
      setSaveStatus("error");
      setSaveMessage(
        "Invalid filename. Avoid spaces and special characters."
      );
      return;
    }

    try {
      setIsSaving(true);
      setSaveStatus("saving");
      setSaveMessage("Saving to GitHub...");
      setCommitUrl("");
      setSavedFileName("");

      const response = await fetch(
        `${API_BASE_URL}/api/github/commit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomId,
            fileName: cleanFileName,
            content: sharedDocument.toString(),
            commitMessage:
              commitMessage.trim() ||
              `Save ${cleanFileName} from CodeTogether room ${roomId}`,

            contributorId: userId,
            contributorName: displayName.trim() || "Collaborator",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "GitHub save failed");
      }

      setSaveStatus("success");
      setSaveMessage("Successfully saved to GitHub!");
      setSavedFileName(cleanFileName);
      setCommitUrl(data.commitUrl || "");

      console.log("[GitHub] Commit URL:", data.commitUrl);
      console.log("[GitHub] Contributor:", {
        userId,
        displayName,
      });

      if (historyOpen) {
        void loadCommitHistory();
      }
    } catch (error) {
      console.error("[GitHub] Save error:", error);

      setSaveStatus("error");
      setSaveMessage(
        error instanceof Error
          ? error.message
          : "Failed to save to GitHub."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="collaborative-editor">
      <div className="editor-connection">
        <span className="online-indicator">●</span>
        {connectionStatus}
      </div>

      <div className="editor-toolbar">
        <input
          className="editor-filename"
          type="text"
          value={fileName}
          onChange={(event) => {
            const nextFileName = event.target.value;

            setFileName(nextFileName);
            sharedMetadata?.set("fileName", nextFileName);

            setSaveStatus("idle");
            setSaveMessage("");
            setCommitUrl("");
            setSavedFileName("");
          }}
          placeholder="Enter filename (e.g. main.py)"
          disabled={isSaving}
        />

        <select
          className="editor-language-select"
          value={language}
          onChange={(event) =>
            handleLanguageChange(event.target.value)
          }
          disabled={!isLanguageReady}
          aria-label="Select programming language"
        >
          {SUPPORTED_LANGUAGES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>

        <input
          className="editor-commit-message"
          type="text"
          value={commitMessage}
          onChange={(event) => setCommitMessage(event.target.value)}
          placeholder="Enter commit message (optional)"
          disabled={isSaving}
        />

        <button
          className="github-save-button"
          onClick={saveToGitHub}
          disabled={isSaving || !sharedDocument}
        >
          {isSaving
            ? "Saving..."
            : !sharedDocument
              ? "Connecting..."
              : "Save to GitHub"}
        </button>

        <button
          className="download-file-button"
          onClick={downloadFile}
          type="button"
          disabled={!sharedDocument}
        >
          Download File
        </button>

        <button
          className={`github-history-toggle ${historyOpen ? "active" : ""}`}
          onClick={toggleCommitHistory}
          type="button"
        >
          {historyOpen ? "Hide History" : "Commit History"}
        </button>

        {saveMessage && (
          <span
            className={`github-save-message ${saveStatus}`}
            aria-live="polite"
          >
            {saveStatus === "success" && "✓ "}
            {saveStatus === "error" && "✕ "}
            {saveStatus === "saving" && "⏳ "}
            {saveMessage}
          </span>
        )}

        {savedFileName && (
          <span className="github-save-message">
            Saved: {savedFileName}
          </span>
        )}

        {commitUrl && (
          <a
            href={commitUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="github-commit-link"
          >
            View Commit ↗
          </a>
        )}
      </div>

      {historyOpen && (
        <section className="github-history-panel">
          <div className="github-history-header">
            <div>
              <h3>Commit History</h3>
              <span>
                {commits.length} commit{commits.length === 1 ? "" : "s"} in this room
              </span>
            </div>

            <button
              className="github-history-refresh"
              type="button"
              onClick={() => void loadCommitHistory()}
              disabled={isLoadingHistory}
            >
              {isLoadingHistory ? "Refreshing..." : "↻ Refresh"}
            </button>
          </div>

          {isLoadingHistory && commits.length === 0 && (
            <div className="github-history-state">
              Loading commit history...
            </div>
          )}

          {historyError && (
            <div className="github-history-error">
              {historyError}
              <button
                type="button"
                onClick={() => void loadCommitHistory()}
              >
                Try again
              </button>
            </div>
          )}

          {!isLoadingHistory &&
            !historyError &&
            commits.length === 0 && (
              <div className="github-history-state">
                No commits yet. Save your code to GitHub to create the first commit.
              </div>
            )}

          {commits.length > 0 && (
            <div className="github-history-list">
              {commits.map((commit) => (
                <article
                  className="github-history-item"
                  key={commit.sha}
                >
                  <div className="github-history-avatar">
                    {commit.contributor.avatarUrl ? (
                      <img
                        src={commit.contributor.avatarUrl}
                        alt=""
                      />
                    ) : (
                      <span>
                        {(commit.contributor.name || "?")
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="github-history-details">
                    <div className="github-history-commit-message">
                      {commit.message || "Untitled commit"}
                    </div>

                    <div className="github-history-meta">
                      <strong>{commit.contributor.name}</strong>
                      <span>·</span>
                      <span>{formatCommitDate(commit.date)}</span>
                      <span>·</span>
                      <code>{commit.shortSha}</code>
                    </div>

                    {commit.contributor.id && (
                      <div className="github-history-contributor-id">
                        Contributor ID: {commit.contributor.id}
                      </div>
                    )}
                  </div>

                  <a
                    className="github-history-link"
                    href={commit.commitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View ↗
                  </a>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="editor-monaco-container">
        <Editor
          height="100%"
          language={language}
          theme="vs-dark"
          defaultValue={STARTER_CODE}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 15,
            fontFamily: "Consolas, monospace",
            fontLigatures: true,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            padding: { top: 20 },
            wordWrap: "on",
            lineNumbers: "on",
          }}
        />
      </div>
    </div>
  );
}

export default CollaborativeEditor;
