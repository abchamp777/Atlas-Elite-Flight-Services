const express = require("express");
const crypto = require("crypto");
const path = require("path");
const { put, head } = require("@vercel/blob");
const fs = require("fs/promises");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const BOOKING_BLOB = "atlas-elite-flight-services/bookings.json";
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "bookings.json");
const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const TOKEN_SECRET = process.env.ADMIN_PASSWORD || "atlas-elite-change-this";

if (!ADMIN_PASSWORD) {
  console.warn("WARNING: ADMIN_PASSWORD is not set. Configure it in Vercel Environment Variables.");
}
if (!USE_BLOB) {
  console.warn("INFO: BLOB_READ_WRITE_TOKEN is not set. Using local data/bookings.json storage for this server instance.");
}

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

function clean(value, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyToken(token) {
  try {
    const [body, signature] = String(token || "").split(".");
    if (!body || !signature) return false;
    const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.exp > Date.now();
  } catch {
    return false;
  }
}

async function ensureLocalDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]\n", "utf8");
  }
}

async function readBookings() {
  if (USE_BLOB) {
    try {
      const blob = await head(BOOKING_BLOB);
      const response = await fetch(blob.url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Booking blob read failed (${response.status}).`);
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (error?.statusCode === 404 || String(error?.message || "").toLowerCase().includes("not found")) return [];
      throw error;
    }
  }

  await ensureLocalDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  const data = JSON.parse(raw || "[]");
  return Array.isArray(data) ? data : [];
}

async function writeBookings(bookings) {
  if (USE_BLOB) {
    await put(BOOKING_BLOB, JSON.stringify(bookings, null, 2), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
      cacheControlMaxAge: 0
    });
    return;
  }

  await ensureLocalDataFile();
  const temp = `${DATA_FILE}.tmp`;
  await fs.writeFile(temp, JSON.stringify(bookings, null, 2) + "\n", "utf8");
  await fs.rename(temp, DATA_FILE);
}

function isValidDate(dateString) {
  const d = new Date(`${dateString}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return !Number.isNaN(d.getTime()) && d >= today;
}

function isValidTime(time) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

const aircraftOptions = [
  "Light Jet",
  "Midsize Jet",
  "Heavy Jet",
  "Ultra Long Range",
  "Specific aircraft — discuss with concierge"
];

const transportOptions = [
  "Private Car / Chauffeur",
  "Luxury SUV",
  "Airport Terminal Transfer",
  "Self-Arranged",
  "Other — Discuss with Concierge"
];

const cateringOptions = [
  "Light Refreshments",
  "Breakfast Service",
  "Lunch Service",
  "Dinner Service",
  "Custom Catering — Discuss with Concierge",
  "No Catering"
];

const airportOptions = [
  { name: "Greater Rockford Airport", region: "Greater Rockford" },
  { name: "Perth International", region: "Perth" },
  { name: "Tokyo International Airport", region: "Orenji" },
  { name: "Larnaca Airport", region: "Cyprus" },
  { name: "Izolirani International", region: "Izolirani" },
  { name: "Keflavik Airport", region: "Grindavik" },
  { name: "Sauthemptona Airport", region: "Sauthemptona" },
  { name: "Paphos Airport", region: "Cyprus" },
  { name: "Barra Airport", region: "Cyprus" },
  { name: "Saba Airport", region: "Orenji" },
  { name: "Lukla", region: "Perth" },
  { name: "Pingeyri Airport", region: "Grindavik" },
  { name: "Skopelos Airfield", region: "Skopelos" },
  { name: "Saint Barthélemy Airport", region: "Saint Barthélemy" },
  { name: "Henstridge Airfield", region: "Cyprus" },
  { name: "Airbase Garry", region: "Greater Rockford" },
  { name: "RAF Scampton", region: "Izolirani" },
  { name: "McConnell AFB", region: "Cyprus" },
  { name: "HMS Queen Elizabeth", region: "Off Greater Rockford" }
];
const airportNames = airportOptions.map(a => a.name);

async function handleBookingCreation(req, res) {
  try {
    const body = req.body || {};
    const discordUsername = clean(body.discordUsername, 100);
    const origin = clean(body.origin, 160);
    const destination = clean(body.destination, 160);
    const robloxUsername = clean(body.robloxUsername, 100);
    const passengers = Number(body.passengers);
    const flightDate = clean(body.flightDate, 10);
    const preferredTime = clean(body.preferredTime, 5);
    const aircraft = clean(body.aircraft, 120);
    const transportation = clean(body.transportation, 120);
    const catering = clean(body.catering, 120);
    const notes = clean(body.notes, 2000);

    const errors = {};
    if (!discordUsername) errors.discordUsername = "Discord username is required.";
    if (!airportNames.includes(origin)) errors.origin = "Choose a valid origin airport.";
    if (!airportNames.includes(destination)) errors.destination = "Choose a valid destination airport.";
    if (origin && destination && origin === destination) errors.destination = "Origin and destination must be different.";
    if (!robloxUsername) errors.robloxUsername = "Roblox username is required.";
    if (!Number.isInteger(passengers) || passengers < 1 || passengers > 20) errors.passengers = "Passengers must be between 1 and 20.";
    if (!isValidDate(flightDate)) errors.flightDate = "Choose today or a future date.";
    if (!isValidTime(preferredTime)) errors.preferredTime = "Choose a valid time.";
    if (!aircraftOptions.includes(aircraft)) errors.aircraft = "Choose an aircraft option.";
    if (!transportOptions.includes(transportation)) errors.transportation = "Choose a transport option.";
    if (!cateringOptions.includes(catering)) errors.catering = "Choose a catering option.";

    if (Object.keys(errors).length) return res.status(400).json({ error: "Please correct the highlighted fields.", fields: errors });

    const bookings = await readBookings();
    const booking = {
      id: `AEFS-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      createdAt: new Date().toISOString(),
      discordUsername,
      origin,
      destination,
      robloxUsername,
      passengers,
      flightDate,
      preferredTime,
      aircraft,
      transportation,
      catering,
      notes,
      status: "New"
    };

    bookings.unshift(booking);
    await writeBookings(bookings);
    return res.status(201).json({ success: true, bookingId: booking.id });
  } catch (error) {
    console.error("Booking creation error:", error);
    return res.status(500).json({ success: false, error: "Unable to record the flight request right now." });
  }
}

app.post("/api/bookings", handleBookingCreation);
app.post("/api/book", handleBookingCreation);

app.post("/api/admin/login", (req, res) => {
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: "Admin password is not configured on the server." });
  const supplied = String(req.body?.password ?? "");
  const expected = Buffer.from(ADMIN_PASSWORD);
  const actual = Buffer.from(supplied);
  const valid = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  if (!valid) return res.status(401).json({ error: "Incorrect password." });

  const token = signToken({ exp: Date.now() + 1000 * 60 * 60 * 24 * 7 });
  res.json({ token });
});

function requireAdmin(req, res, next) {
  const token = req.header("x-admin-token");
  if (!verifyToken(token)) return res.status(401).json({ error: "Unauthorized." });
  next();
}

app.post("/api/admin/logout", requireAdmin, (req, res) => res.json({ ok: true }));

app.get("/api/admin/bookings", requireAdmin, async (req, res) => {
  try {
    res.json(await readBookings());
  } catch (error) {
    console.error("Booking read error:", error);
    res.status(500).json({ error: "Unable to read bookings." });
  }
});

app.patch("/api/admin/bookings/:id/status", requireAdmin, async (req, res) => {
  try {
    const allowed = ["New", "Contacted", "Confirmed", "Completed", "Cancelled"];
    const status = clean(req.body?.status, 30);
    if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid booking status." });

    const bookings = await readBookings();
    const index = bookings.findIndex(b => b.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Booking not found." });

    bookings[index].status = status;
    bookings[index].updatedAt = new Date().toISOString();
    await writeBookings(bookings);
    res.json(bookings[index]);
  } catch (error) {
    console.error("Booking status update error:", error);
    res.status(500).json({ error: "Unable to update booking." });
  }
});

app.delete("/api/admin/bookings/:id", requireAdmin, async (req, res) => {
  try {
    const bookings = await readBookings();
    const index = bookings.findIndex(b => b.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Booking not found." });

    bookings.splice(index, 1);
    await writeBookings(bookings);
    res.json({ ok: true });
  } catch (error) {
    console.error("Booking deletion error:", error);
    res.status(500).json({ error: "Unable to delete booking." });
  }
});

app.get("/api/storage-status", (req, res) => {
  res.json({
    configured: USE_BLOB,
    durable: USE_BLOB,
    mode: USE_BLOB ? "vercel-blob" : "local-json"
  });
});

app.use((req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

if (require.main === module) {
  app.listen(PORT, () => console.log(`Atlas Elite Flight Services running on http://localhost:${PORT}`));
}

module.exports = app;
async function readBookings() {
  if (USE_BLOB) {
    try {
      const blob = await head(BOOKING_BLOB);

      const response = await fetch(blob.url, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(
          `Booking blob read failed (${response.status}).`
        );
      }

      const data = await response.json();

      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (
        error?.statusCode === 404 ||
        String(error?.message || "")
          .toLowerCase()
          .includes("not found")
      ) {
        return [];
      }

      throw error;
    }
  }

  // Local VS Code fallback
  await ensureLocalDataFile();

  const raw = await fs.readFile(
    DATA_FILE,
    "utf8"
  );

  const data = JSON.parse(raw || "[]");

  return Array.isArray(data) ? data : [];
}
async function writeBookings(bookings) {
  if (USE_BLOB) {
    await put(
      BOOKING_BLOB,
      JSON.stringify(bookings, null, 2),
      {
        access: "public",
        addRandomSuffix: false,
        contentType: "application/json",
        cacheControlMaxAge: 0
      }
    );

    return;
  }

  // Local VS Code fallback
  await ensureLocalDataFile();

  const temp = `${DATA_FILE}.tmp`;

  await fs.writeFile(
    temp,
    JSON.stringify(bookings, null, 2) + "\n",
    "utf8"
  );

  await fs.rename(
    temp,
    DATA_FILE
  );
}