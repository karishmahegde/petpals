//Loads libraries and reads the .env file so all environment variables are available.
const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("../swagger");

//Creates the Express app
const app = express();

// ── Middleware ─────────────────────────────────────────────────
app.use(
  cors({
    origin: "http://localhost:3000", //Allows Cross-origin requests. Since our client and server will be on different ports, the browser would block it as per Same-Origin policy. This line will tell the browser to allow cross-origin requests.
    credentials: true, // required for httpOnly cookies to work
  }),
);
app.use(express.json());
app.use(helmet()); // sets various HTTP response headers to protect your app from common web vulnerabilities

// ── HttpOnly Cookie ─────────────────────────────────────────────────
const cookieParser = require("cookie-parser"); // For reading the refresh-token
app.use(cookieParser());

// ── API Docs ───────────────────────────────────────────────────
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Health check ───────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", version: "v1" });
});

// ── API Routes ────────────
const authRouter = require("./routes/auth.routes");
app.use("/api/v1/auth", authRouter);
const petsRouter = require("./routes/pets.routes");
app.use("/api/v1", petsRouter);
const sheltersRouter = require("./routes/shelters.routes");
app.use("/api/v1", sheltersRouter);
// app.use('/api/v1/adopters',             require('./routes/adopters'));
// app.use('/api/v1/adoption-applications',require('./routes/adoptionApplications'));
// app.use('/api/v1/staff',                require('./routes/staff'));
// app.use('/api/v1/appointments',         require('./routes/appointments'));
// app.use('/api/v1/vaccinations',         require('./routes/vaccinations'));
// app.use('/api/v1/tasks',                require('./routes/tasks'));
// app.use('/api/v1/events',               require('./routes/events'));
// app.use('/api/v1/donors',               require('./routes/donors'));
// app.use('/api/v1/donations',            require('./routes/donations'));
// app.use('/api/v1/transfers',            require('./routes/transfers'));

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    error: {
      code: "NOT_FOUND",
      details: `${req.method} ${req.path} does not exist`,
    },
  });
});

// ── Global error handler ───────────────────────────────────────
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

module.exports = app;
