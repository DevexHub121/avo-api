const express = require("express");
const db = require("./src/DB/db");
const userRoutes = require("./src/Routes/routes");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8000;

const cron = require("node-cron");

// Middleware
app.use(express.json()); // Allow JSON body parsing
// app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
// Test Route
app.get("/", (req, res) => {
  res.send("Welcome to Avo Backend!");
});

app.use("/Avo", userRoutes);

// app.use(function (request, response, next) {
//   if (request.session && !request.session.regenerate) {
//     request.session.regenerate = (cb) => {
//       cb();
//     };
//   }
//   if (request.session && !request.session.save) {
//     request.session.save = (cb) => {
//       cb();
//     };
//   }
//   next();
// });

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
