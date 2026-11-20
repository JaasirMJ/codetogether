
import ChatPanel from "./ChatPanel-temp";
import { connectNexconn, openRoomGroup } from "./lib/nexconn";
import CollaborativeEditor from "./CollaborativeEditor";
import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [activeRoom, setActiveRoom] = useState("");
  const [error, setError] = useState("");
  const [nexconnStatus, setNexconnStatus] = useState("Disconnected");
  const [userId, setUserId] = useState("");

  // Read room code from an invitation URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invitedRoom = params.get("room");

    if (invitedRoom) {
      setRoomCode(invitedRoom);
    }
  }, []);

  // Connect to Nexconn before entering a room
  async function connectAndEnterRoom(
    code: string,
    isCreator: boolean
  ) {
    setError("");
    setIsConnecting(true);

    try {
      let currentUserId = localStorage.getItem("codetogether-user-id");

      if (!currentUserId) {
        currentUserId = crypto.randomUUID();
        localStorage.setItem("codetogether-user-id", currentUserId);
      }

      setUserId(currentUserId);

      await connectNexconn(currentUserId, name.trim());

      setNexconnStatus("Connected");

      await openRoomGroup(code, isCreator,currentUserId);

      enterRoom(code);
    } catch (err) {
      console.error("Nexconn room error:", err);
      setNexconnStatus("Disconnected");
      setError("Unable to connect to the Nexconn room. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  }

  // Create a new room
  async function createRoom() {
    if (!name.trim()) {
      setError("Please enter your display name first.");
      return;
    }

    const newRoomCode = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

    await connectAndEnterRoom(newRoomCode, true);
  }

  // Join an existing room
  async function joinRoom() {
    if (!name.trim()) {
      setError("Please enter your display name first.");
      return;
    }

    if (!roomCode.trim()) {
      setError("Please enter a room code.");
      return;
    }

    await connectAndEnterRoom(
      roomCode.trim().toUpperCase(),
      false
    );
  }

  // Enter the workspace
  function enterRoom(code: string) {
    setError("");
    setActiveRoom(code);

    const inviteUrl = `${window.location.origin}/?room=${code}`;
    window.history.pushState({}, "", inviteUrl);
  }

  // Copy room invitation link
  async function copyInvite() {
    const inviteUrl = `${window.location.origin}/?room=${activeRoom}`;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      alert("Invitation link copied!");
    } catch {
      setError("Unable to copy the link. Please copy it from your browser.");
    }
  }

  // Leave the current room
  function leaveRoom() {
    setActiveRoom("");
    setNexconnStatus("Disconnected");
    window.history.pushState({}, "", "/");
  }

  // Workspace screen
  if (activeRoom) {
    return (
      <main className="workspace">
        <header className="workspace-header">
          <h2 className="logo">
            CodeTogether<span>.</span>
          </h2>

          <div className="workspace-info">
            <span>ROOM: {activeRoom}</span>
            <span className="online-indicator">
              ● Nexconn: {nexconnStatus}
            </span>
          </div>

          <button className="secondary-button" onClick={copyInvite}>
            Copy invite link
          </button>

          <button
            className="secondary-button leave-button"
            onClick={leaveRoom}
          >
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

        <div className="workspace-main">
          <section className="editor-container">
            <CollaborativeEditor roomId={activeRoom} />
          </section>

          <ChatPanel
            roomId={activeRoom}
            userId={userId}
            userName={name}
          />
        </div>

        <footer className="workspace-footer">
          <span>CodeTogether Workspace</span>
          <span>
            {name} · Room {activeRoom}
          </span>
        </footer>
      </main>
    );
  }

  // Landing screen
  return (
    <main className="app-shell">
      <header className="topbar">
        <h2 className="logo">
          CodeTogether<span>.</span>
        </h2>

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
            disabled={isConnecting}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
          />

          <button
            className="primary-button"
            onClick={createRoom}
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting..." : "Create a new room"}
            {!isConnecting && <span>↗</span>}
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
            disabled={isConnecting}
            onChange={(e) => {
              setRoomCode(e.target.value);
              setError("");
            }}
          />

          <button
            className="secondary-button join-button"
            onClick={joinRoom}
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting..." : "Join room →"}
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
