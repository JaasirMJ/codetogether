
import {
  NCEngine,
  GroupChannel,
  MessageHandler,
  SendTextMessageParams,
} from "@nexconn/chat";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

let initialized = false;
let connectionPromise: Promise<string> | null = null;
let messageHandlerRegistered = false;
let activeRoomId: string | null = null;

export interface ChatMessage {
  messageId: string;
  senderUserId: string;
  text: string;
  sentTime: number;
}

type MessageCallback = (message: ChatMessage) => void;

const messageListeners = new Map<string, Set<MessageCallback>>();

// Register the global Nexconn message listener
function registerMessageHandler() {
  if (messageHandlerRegistered) return;

  NCEngine.addMessageHandler(
    "codetogether-messages",
    new MessageHandler({
      onMessageReceived({ messages }) {
        console.log("[Nexconn] Incoming messages:", messages);
        messages.forEach((msg) => {
          if (msg.messageType !== "RC:TxtMsg") return;

          const content = msg.content as { text?: string };

          if (!content.text || !activeRoomId) return;

          const listeners = messageListeners.get(activeRoomId);

          if (!listeners) return;

          const chatMessage: ChatMessage = {
            messageId: msg.messageId,
            senderUserId: msg.senderUserId,
            text: content.text,
            sentTime: msg.sentTime,
          };

          listeners.forEach((callback) => callback(chatMessage));
        });
      },
    })
  );

  messageHandlerRegistered = true;
}

// Connect user to Nexconn
export async function connectNexconn(
  userId: string,
  name: string
): Promise<string> {
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    const response = await fetch(
      `${API_BASE_URL}/api/nexconn/token`,
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

    registerMessageHandler();

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

// Create or join a Nexconn group
export async function openRoomGroup(
  roomId: string,
  isCreator: boolean,
  userId: string
): Promise<GroupChannel> {
  if (isCreator) {
    const result = await GroupChannel.createGroup({
      groupId: roomId,
      groupName: `CodeTogether - ${roomId}`,
    });

    console.log("[Nexconn] Group creation result:", result);

    if (result.code !== 0) {
      throw new Error(
        `Failed to create Nexconn group. Code: ${result.code}`
      );
    }
  } else {
    const response = await fetch(
      `${API_BASE_URL}/api/nexconn/group/join`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId,
          userId,
        }),
      }
    );

    const data = await response.json();

    console.log("[Nexconn] Add member result:", data);

    if (!response.ok || !data.success) {
      throw new Error(
        data.error || "Failed to add user to Nexconn group"
      );
    }
  }

  activeRoomId = roomId;

  console.log("[Nexconn] Active room ID:", activeRoomId);

  return new GroupChannel(roomId);
}

// Send a text message to a room
export async function sendRoomMessage(
  roomId: string,
  text: string
) {
  const channel = new GroupChannel(roomId);

  console.log("[Nexconn] Sending message:", {
    roomId,
    text,
  });

  try {
    const result = await channel.sendMessage(
      new SendTextMessageParams({ text })
    );

    console.log("[Nexconn] Send result:", result);

    if (result.code !== 0) {
      throw new Error(
        `Nexconn send failed. Code: ${result.code}`
      );
    }

    console.log("[Nexconn] Message sent successfully:", result.data);

    return result.data;
  } catch (error) {
    console.error("[Nexconn] Message send exception:", error);
    throw error;
  }
}

// Subscribe to messages from a specific room
export function subscribeToRoomMessages(
  roomId: string,
  callback: MessageCallback
) {
  if (!messageListeners.has(roomId)) {
    messageListeners.set(roomId, new Set());
  }

  messageListeners.get(roomId)!.add(callback);

  return () => {
    const listeners = messageListeners.get(roomId);

    listeners?.delete(callback);

    if (listeners?.size === 0) {
      messageListeners.delete(roomId);
    }
  };
}
