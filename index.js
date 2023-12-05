const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
app.use(express.json());

// Configure CORS for the specific client URL
const whitelist = ["http://127.0.0.1:5500"];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

app.use(cors(corsOptions));

// Create a MySQL connection pool
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "chatrooms",
});

// API endpoint to create a new room
app.post("/createRoom", async (req, res) => {
  try {
    const roomName = req.body.roomName;
    const username = req.body.username;

    const [result] = await pool.query(
      "INSERT INTO rooms (room_name) VALUES (?)",
      [roomName]
    );

    const roomId = result.insertId;
    const values = [username, roomId];

    const [userResult] = await pool.query(
      "INSERT INTO users (username, room_id) VALUES (?)",
      [values]
    );

    const userId = userResult.insertId;

    res.status(201).json({ roomId, userId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred." });
  }
});

// API endpoint to join a room
app.post("/joinRoom", async (req, res) => {
  try {
    const { username, roomId } = req.body;

    // Check if the room exists
    const [room] = await pool.query("SELECT * FROM rooms WHERE id = ?", [
      roomId,
    ]);
    if (room.length === 0) {
      return res.status(404).json({ error: "Room not found." });
    }

    // Insert user into the room
    const [userResult] = await pool.query(
      "INSERT INTO users (username, room_id) VALUES (?, ?)",
      [username, roomId]
    );
    const userId = userResult.insertId;

    // Update user count in the room
    await pool.query(
      "UPDATE rooms SET user_count = user_count + 1 WHERE id = ?",
      [roomId]
    );

    res.status(200).json({
      message: "Joined room successfully.",
      userId: userId,
      roomId: roomId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred." });
  }
});

app.get("/getMessages/:roomId", async (req, res) => {
  const roomId = req.params.roomId;

  try {
    const messages = await getMessagesByRoomId(roomId);

    const userMessagesArray = [];
    messages.map((message) => {
      const { username, message: userMessage, created_at } = message;
      userMessagesArray.push({
        username,
        message: userMessage,
        timestamp: created_at,
      });
    });

    res.json({ userMessagesArray });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Error fetching messages" });
  }
});

async function getMessagesByRoomId(roomId) {
  try {
    const query = "SELECT * FROM room_messages WHERE room_id = ?";
    const [messages] = await pool.query(query, [roomId]);
    return messages;
  } catch (error) {
    console.error("Error fetching messages:", error);
    throw error;
  }
}

app.post("/sendMessage", async (req, res) => {
  const { roomId, userId, message } = req.body;

  try {
    // Check if the user is in the room
    const userInRoomQuery = `
      SELECT * FROM users
      WHERE room_id = ? AND id = ?
    `;
    const [userInRoom] = await pool.query(userInRoomQuery, [roomId, userId]);

    if (!userInRoom.length) {
      return res.status(403).json({ error: "User is not in the room." });
    }

    // Insert the message into the database
    const insertQuery = `
      INSERT INTO room_messages (room_id, user_id, message)
      VALUES (?, ?, ?)
    `;
    await pool.query(insertQuery, [roomId, userId, message]);

    res.status(200).json({ message: "Message sent successfully." });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Error sending message." });
  }
});

async function insertMessage(roomId, userId, message) {
  try {
    const query = `
      INSERT INTO room_messages (room_id, user_id, message)
      VALUES (?, ?, ?)
    `;
    await pool.query(query, [roomId, userId, message]);
  } catch (error) {
    throw error;
  }
}

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
