
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
}

function CollaborativeEditor({ roomId }: CollaborativeEditorProps) {
  const [editorInstance, setEditorInstance] =
    useState<editor.IStandaloneCodeEditor | null>(null);

  const [connectionStatus, setConnectionStatus] =
    useState("Connecting...");

  const handleEditorMount: OnMount = (editor) => {
    setEditorInstance(editor);
  };

  useEffect(() => {
    if (!editorInstance) return;

    // 1. Create a shared Yjs document
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("codetogether");

    // 2. Connect to the Yjs WebSocket server
    const provider = new WebsocketProvider(
      "ws://localhost:1234",
      `codetogether-${roomId}`,
      ydoc
    );

    // 3. Get the Monaco editor model
    const model = editorInstance.getModel();

    if (!model) {
      provider.destroy();
      ydoc.destroy();
      return;
    }

    // 4. Give this collaborator a unique identity
    const colors = [
      "#E06C75",
      "#61AFEF",
      "#98C379",
      "#C678DD",
      "#E5C07B",
    ];

    const userColor =
      colors[Math.floor(Math.random() * colors.length)];

    const userName =
      `Coder-${Math.floor(100 + Math.random() * 900)}`;

    provider.awareness.setLocalStateField("user", {
      name: userName,
      color: userColor,
    });

    // 5. Create styles for remote collaborators' cursors
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

      cursorStyle.textContent = css;
    };

    provider.awareness.on("update", updateCursorStyles);
    updateCursorStyles();

    // 6. Track the connection status
    provider.on("status", ({ status }: { status: string }) => {
      setConnectionStatus(
        status === "connected" ? "Connected" : "Connecting..."
      );

      console.log(`[Yjs ${roomId}] Connection status:`, status);
    });

    // Keep track of the Monaco-Yjs binding
    let binding: MonacoBinding | null = null;

    // 7. Wait until the shared document has synchronized
    provider.on("sync", (isSynced: boolean) => {
      if (!isSynced || binding) return;

      console.log(`[Yjs ${roomId}] Document synchronized`);

      // Add starter code only if the shared document is empty
      if (ytext.length === 0) {
        ytext.insert(0, STARTER_CODE);
      }

      // 8. Connect Monaco editor with Yjs
      binding = new MonacoBinding(
        ytext,
        model,
        new Set([editorInstance]),
        provider.awareness
      );

      console.log(`[Yjs ${roomId}] Monaco binding initialized`);
    });

    // 9. Observe document changes
    ytext.observe(() => {
      console.log(
        `[Yjs ${roomId}] Document updated:`,
        ytext.toString()
      );
    });

    // 10. Cleanup when leaving the room
    return () => {
      binding?.destroy();

      provider.awareness.off("update", updateCursorStyles);

      cursorStyle.remove();

      provider.destroy();
      ydoc.destroy();

      console.log(`[Yjs ${roomId}] Connection cleaned up`);
    };
  }, [roomId, editorInstance]);

  return (
    <div className="collaborative-editor">
      <div className="editor-connection">
        <span className="online-indicator">●</span>
        {connectionStatus}
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
