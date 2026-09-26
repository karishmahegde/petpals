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

// Stripe webhook — mounted BEFORE express.json() below, and given its own
// express.raw() body parser (see routes/webhooks/stripe.routes.js), since
// stripe.webhooks.constructEvent needs the untouched raw request body to
// verify the signature. Every other route is unaffected and still gets the
// normal JSON-parsed body from express.json().
const stripeWebhookRouter = require("./routes/webhooks/stripe.routes");
app.use("/api/v1/webhooks", stripeWebhookRouter);

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
const authRouter = require("./routes/auth/auth.routes");
app.use("/api/v1/auth", authRouter);
const petsRouter = require("./routes/public/pets.routes");
app.use("/api/v1", petsRouter);
const staffPetsRouter = require("./routes/staff/pets.routes");
app.use("/api/v1", staffPetsRouter);
const staffSpeciesRouter = require("./routes/staff/species.routes");
app.use("/api/v1", staffSpeciesRouter);
const sheltersRouter = require("./routes/public/shelters.routes");
app.use("/api/v1", sheltersRouter);
const adminSheltersRouter = require("./routes/admin/shelters.routes");
app.use("/api/v1", adminSheltersRouter);
const adoptersRouter = require("./routes/adopter/adopters.routes");
app.use("/api/v1/adopters", adoptersRouter);
const adminAdoptersRouter = require("./routes/admin/adopters.routes");
app.use("/api/v1/adopters", adminAdoptersRouter);
const adoptionApplicationsRouter = require("./routes/adopter/adoptionApplications.routes");
app.use("/api/v1/adoption-applications", adoptionApplicationsRouter);
const visitsRouter = require("./routes/adopter/visits.routes");
app.use("/api/v1/visits", visitsRouter);
const favoritesRouter = require("./routes/adopter/favorites.routes");
app.use("/api/v1", favoritesRouter);
// Staff self-service routes (/staff/me) must be mounted BEFORE the admin
// staff router below — its GET /staff/:id would otherwise swallow
// "/staff/me" first (:id="me").
const staffSelfRouter = require("./routes/staff/staff.routes");
app.use("/api/v1", staffSelfRouter);
// Also before the Admin /staff/:id router — see routes/staff/shelterStaff.routes.js.
const shelterStaffRouter = require("./routes/staff/shelterStaff.routes");
app.use("/api/v1", shelterStaffRouter);
const staffVetsRouter = require("./routes/staff/vets.routes");
app.use("/api/v1", staffVetsRouter);
const staffRouter = require("./routes/admin/staff.routes");
app.use("/api/v1", staffRouter);
const adminsRouter = require("./routes/admin/admins.routes");
app.use("/api/v1", adminsRouter);
const analyticsRouter = require("./routes/admin/analytics.routes");
app.use("/api/v1", analyticsRouter);
const eventsRouter = require("./routes/public/events.routes");
app.use("/api/v1", eventsRouter);
const staffEventsRouter = require("./routes/staff/events.routes");
app.use("/api/v1", staffEventsRouter);
const staffTransfersRouter = require("./routes/staff/transfers.routes");
app.use("/api/v1", staffTransfersRouter);
const staffAppointmentsRouter = require("./routes/staff/appointments.routes");
app.use("/api/v1", staffAppointmentsRouter);
const staffGovernmentIdsRouter = require("./routes/staff/governmentIds.routes");
app.use("/api/v1", staffGovernmentIdsRouter);
const staffVolunteersRouter = require("./routes/staff/volunteers.routes");
app.use("/api/v1", staffVolunteersRouter);
const staffTasksRouter = require("./routes/staff/tasks.routes");
app.use("/api/v1", staffTasksRouter);
const staffDonationsRouter = require("./routes/staff/donations.routes");
app.use("/api/v1", staffDonationsRouter);
// app.use('/api/v1/vaccinations',         require('./routes/vaccinations'));
// app.use('/api/v1/donors',               require('./routes/donors'));

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
