import app from "./src/app.js";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
.then(() => {
  console.log("DB Connected");
  app.listen(PORT, () =>
    console.log("Server running on port " + PORT)
  );
});