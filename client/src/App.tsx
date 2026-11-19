
import { useEffect, useState } from "react";
import "./App.css";

function App() {
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
      <main className="app-shell">
        <header className="topbar">
          <h2 className="logo">CodeTogether<span>.</span></h2>
          <button className="secondary-button" onClick={leaveRoom}>
            Leave room
          </button>
        </header>

        <section className="room-card">
          <span className="eyebrow">COLLABORATION ROOM</span>
          <h1>You're in the room.</h1>
          <p className="subtitle">
            Welcome, {name}. Your collaborative workspace is ready.
          </p>

          <div className="room-code">
            <span>ROOM CODE</span>
            <strong>{activeRoom}</strong>
          </div>

          <button className="primary-button" onClick={copyInvite}>
            Copy invitation link ↗
          </button>

          <p className="room-note">
            The shared editor and live chat will appear here in our next milestone.
          </p>
        </section>
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
