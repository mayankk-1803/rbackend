import app from "./src/app.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import http from "http";
import { initSocket } from "./src/config/socket.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
.then(() => {
  console.log("DB Connected");
  
  const server = http.createServer(app);
  initSocket(server);
  
  server.listen(PORT, () =>
    console.log("Server running on port " + PORT)
  );
});