
import { useEffect, useState } from "react";
import {
  sendRoomMessage,
  subscribeToRoomMessages,
  type ChatMessage,
} from "./lib/nexconn";

interface ChatPanelProps {
  roomId: string;
  userId: string;
  userName: string;
}

function ChatPanel({ roomId, userId, userName }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  // Listen for incoming Nexconn messages
  useEffect(() => {
    const unsubscribe = subscribeToRoomMessages(
      roomId,
      (newMessage) => {
        setMessages((previous) => {
          if (
            previous.some(
              (item) => item.messageId === newMessage.messageId
            )
          ) {
            return previous;
          }

          return [...previous, newMessage];
        });
      }
    );

    return unsubscribe;
  }, [roomId]);

  // Send a message
  async function handleSendMessage() {
    const text = message.trim();

    if (!text || isSending) return;

    setIsSending(true);
    setError("");

    try {
      const sentMessage = await sendRoomMessage(roomId, text);
      if (!sentMessage) {
  throw new Error("Nexconn returned an empty message response.");
}

      setMessages((previous) => {
        if (
          previous.some(
            (item) => item.messageId === sentMessage.messageId
          )
        ) {
          return previous;
        }

        return [
          ...previous,
          {
            messageId: sentMessage.messageId,
            senderUserId: sentMessage.senderUserId,
            text,
            sentTime: sentMessage.sentTime,
          },
        ];
      });

      setMessage("");
    } catch (err) {
      console.error("[ChatPanel] Message sending error:", err);
      setError("Unable to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  // Send message when Enter is pressed
  function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleSendMessage();
    }
  }

  return (
    <aside className="chat-panel">
      <header className="chat-header">
        <div>
          <h3>Team Chat · {userName}</h3>
          <span>Room {roomId}</span>
        </div>

        <span className="chat-status">● Connected</span>
      </header>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <span>💬</span>
            <p>No messages yet.</p>
            <small>Start the conversation!</small>
          </div>
        ) : (
          messages.map((item) => {
            const isOwnMessage = item.senderUserId === userId;

            return (
              <div
                key={item.messageId}
                className={`chat-message ${
                  isOwnMessage ? "own-message" : ""
                }`}
              >
                <div className="message-sender">
                  {isOwnMessage ? "You" : item.senderUserId}
                </div>

                <div className="message-bubble">
                  {item.text}
                </div>

                <time className="message-time">
                  {new Date(item.sentTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
            );
          })
        )}
      </div>

      {error && <p className="chat-error">{error}</p>}

      <div className="chat-input-area">
        <input
          type="text"
          placeholder="Type a message..."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
        />

        <button
          onClick={() => void handleSendMessage()}
          disabled={!message.trim() || isSending}
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </div>
    </aside>
  );
}

export default ChatPanel;
