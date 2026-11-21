
import { useEffect, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import type { editor } from "monaco-editor";

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

  const [fileName, setFileName] = useState("main.ts");

  const [sharedDocument, setSharedDocument] =
    useState<Y.Text | null>(null);

  const handleEditorMount: OnMount = (editor) => {
    setEditorInstance(editor);
  };

  useEffect(() => {
    if (!editorInstance) return;

    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("codetogether");

    const provider = new WebsocketProvider(
      "ws://localhost:1234",
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
          collaborators[user.userId] = user.name || "Collaborator";
        }
      });

      onCollaboratorsChange(collaborators);
      cursorStyle.textContent = css;
    };

    provider.awareness.on("update", updateCursorStyles);
    updateCursorStyles();

    provider.on("status", ({ status }: { status: string }) => {
      setConnectionStatus(
        status === "connected" ? "Connected" : "Connecting..."
      );

      console.log(`[Yjs ${roomId}] Connection status:`, status);
    });

    let binding: MonacoBinding | null = null;

    provider.on("sync", (isSynced: boolean) => {
      if (!isSynced || binding) return;

      console.log(`[Yjs ${roomId}] Document synchronized`);

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

      cursorStyle.remove();

      setSharedDocument(null);

      provider.destroy();
      ydoc.destroy();

      console.log(`[Yjs ${roomId}] Connection cleaned up`);
    };
  }, [roomId, editorInstance, displayName, userId, onCollaboratorsChange]);

  // Save the shared Yjs document to GitHub
  const saveToGitHub = async () => {
    if (!sharedDocument) {
      setSaveMessage("Shared document is not ready yet.");
      return;
    }

    const cleanFileName = fileName.trim();

    if (!cleanFileName) {
      setSaveMessage("Please enter a filename.");
      return;
    }

    if (
      !/^[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/.test(cleanFileName) ||
      cleanFileName === "." ||
      cleanFileName === ".."
    ) {
      setSaveMessage("Invalid filename. Avoid spaces and special characters.");
      return;
    }

    try {
      setIsSaving(true);
      setSaveMessage("");

      const response = await fetch(
        "http://localhost:5000/api/github/commit",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomId,
            fileName: cleanFileName,
            content: sharedDocument.toString(),
            commitMessage: `Save ${cleanFileName} from CodeTogether room ${roomId}`,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "GitHub save failed");
      }

      setSaveMessage("Successfully saved to GitHub!");

      console.log("[GitHub] Commit URL:", data.commitUrl);
    } catch (error) {
      console.error("[GitHub] Save error:", error);

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
            setFileName(event.target.value);
            setSaveMessage("");
          }}
          placeholder="Enter filename (e.g. main.py)"
          disabled={isSaving}
        />

        <button
          className="github-save-button"
          onClick={saveToGitHub}
          disabled={isSaving || !sharedDocument}
        >
          {isSaving ? "Saving..." : "Save to GitHub"}
        </button>

        {saveMessage && (
          <span className="github-save-message">
            {saveMessage}
          </span>
        )}
      </div>

      <Editor
        height="100%"
        language="typescript"
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
  );
}

export default CollaborativeEditor;
