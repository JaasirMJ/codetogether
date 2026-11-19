
import Editor from "@monaco-editor/react";
import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [code, setCode] = useState(
  '// Welcome to CodeTogether!\n\nfunction hello() {\n  console.log("Hello, world!");\n}\n\nhello();'
);
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [activeRoom, setActiveRoom] = useState("");
  const [error, setError] = useState("");

  // Read room code from an invitation URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invitedRoom = params.get("room");

    if (invitedRoom) {
      setRoomCode(invitedRoom);
    }
  }, []);

  function createRoom() {
    if (!name.trim()) {
      setError("Please enter your display name first.");
      return;
    }

    const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    enterRoom(newRoomCode);
  }

  function joinRoom() {
    if (!name.trim()) {
      setError("Please enter your display name first.");
      return;
    }

    if (!roomCode.trim()) {
      setError("Please enter a room code.");
      return;
    }

    enterRoom(roomCode.trim().toUpperCase());
  }

  function enterRoom(code: string) {
    setError("");
    setActiveRoom(code);

    const inviteUrl = `${window.location.origin}/?room=${code}`;
    window.history.pushState({}, "", inviteUrl);
  }

  async function copyInvite() {
    const inviteUrl = `${window.location.origin}/?room=${activeRoom}`;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      alert("Invitation link copied!");
    } catch {
      setError("Unable to copy the link. Please copy it from your browser.");
    }
  }

  function leaveRoom() {
    setActiveRoom("");
    window.history.pushState({}, "", "/");
  }

  
if (activeRoom) {
  return (
    <main className="workspace">
      <header className="workspace-header">
        <h2 className="logo">CodeTogether<span>.</span></h2>

        <div className="workspace-info">
          <span>ROOM: {activeRoom}</span>
          <span className="online-indicator">● Online</span>
        </div>

        <button className="secondary-button leave-button" onClick={leaveRoom}>
          Leave room
        </button>
      </header>

      <section className="editor-toolbar">
        <div>
          <span className="file-icon">TS</span>
          <span>main.ts</span>
        </div>
        <span className="language-label">TypeScript</span>
      </section>

      <section className="editor-container">
        <Editor
          height="100%"
          language="typescript"
          theme="vs-dark"
          value={code}
          onChange={(value) => setCode(value ?? "")}
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
      </section>

      <footer className="workspace-footer">
        <span>CodeTogether Workspace</span>
        <span>{name} · Room {activeRoom}</span>
      </footer>
    </main>
  );
}


  return (
    <main className="app-shell">
      <header className="topbar">
        <h2 className="logo">CodeTogether<span>.</span></h2>
        <span className="topbar-label">BUILD TOGETHER. BETTER.</span>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">YOUR SHARED CODING SPACE</span>

          <h1>
            Great ideas
            <br />
            are built <span>together.</span>
          </h1>

          <p className="subtitle">
            A space for developers to think, code and collaborate in real time.
            Bring your team together and turn ideas into working code.
          </p>

          <div className="feature-list">
            <span>✦ Real-time collaboration</span>
            <span>✦ Shared coding workspace</span>
            <span>✦ Built for developer teams</span>
          </div>
        </div>

        <div className="action-card">
          <span className="eyebrow">GET STARTED</span>
          <h2>Enter your workspace</h2>
          <p className="card-description">
            Choose a name and create a room or join your team.
          </p>

          <label htmlFor="display-name">YOUR DISPLAY NAME</label>
          <input
            id="display-name"
            type="text"
            placeholder="e.g. Alex"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
          />

          <button className="primary-button" onClick={createRoom}>
            Create a new room <span>↗</span>
          </button>

          <div className="separator">
            <span>OR JOIN AN EXISTING ROOM</span>
          </div>

          <label htmlFor="room-code">ROOM CODE</label>
          <input
            id="room-code"
            type="text"
            placeholder="Enter invitation code"
            value={roomCode}
            onChange={(e) => {
              setRoomCode(e.target.value);
              setError("");
            }}
          />

          <button className="secondary-button join-button" onClick={joinRoom}>
            Join room →
          </button>

          {error && <p className="error-message">{error}</p>}
        </div>
      </section>

      <footer>
        <span>CodeTogether © 2026</span>
        <span>Made for developers, by developers.</span>
      </footer>
    </main>
  );
}

export default App;
