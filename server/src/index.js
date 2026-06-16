//Loads libraries and reads the .env file so all environment variables are available.
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("../swagger");

dotenv.config();

//Creates the Express app
const app = express();

// ── Middleware ─────────────────────────────────────────────────
app.use(cors()); //Allows Cross-origin requests. Since our client and server will be on different ports, the browser would block it as per Same-Origin policy. This line will tell the browser to allow cross-origin requests.
app.use(express.json());
app.use(helmet());

// ── API Docs ───────────────────────────────────────────────────
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Health check ───────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", version: "v1" });
});

// ── API Routes ────────────
// app.use('/api/v1/auth',                 require('./routes/auth'));
// app.use('/api/v1/pets',                 require('./routes/pets'));
// app.use('/api/v1/adopters',             require('./routes/adopters'));
// app.use('/api/v1/adoption-applications',require('./routes/adoptionApplications'));
// app.use('/api/v1/shelters',             require('./routes/shelters'));
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
app.use((err, req, res, next) => {
  //The 4 parameters err,req,res,next indicate that it's an error handler, not a regular route (which has 3 parameters)
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: { code: "INTERNAL_SERVER_ERROR", details: err.message },
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`PetPals API running on port ${PORT}`);
});

module.exports = app;
