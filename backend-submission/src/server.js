require('dotenv').config();
const express = require('express');
const { nanoid } = require('nanoid');
const rateLimit = require('express-rate-limit');
const sanitize = require('express-mongo-sanitize');
const Log = require('../../logging-middleware');

const app = express();

app.use(express.json());
app.use(sanitize());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later'
}));


const urlDatabase = {};

const isValidUrl = (url) => {
  try { 
    new URL(url); 
    return true; 
  } catch { 
    return false; 
  }
};

const isValidShortcode = (code) => /^[a-zA-Z0-9_-]{4,10}$/.test(code);

const generateShortcode = () => nanoid(6);

app.post('/shorturls', (req, res) => {
  const { url, validity = 30, shortcode } = req.body;

  if (!isValidUrl(url)) {
    Log("backend", "error", "validation", `Invalid URL: ${url}`);
    return res.status(400).json({ 
      error: "Invalid URL format",
      details: "Please include a valid http/https URL"
    });
  }

  const finalShortcode = shortcode || generateShortcode();
  
  if (shortcode && !isValidShortcode(shortcode)) {
    Log("backend", "error", "validation", `Invalid shortcode format: ${shortcode}`);
    return res.status(400).json({ 
      error: "Invalid shortcode",
      details: "Must be 4-10 alphanumeric characters (a-z, A-Z, 0-9, _, -)"
    });
  }

  if (urlDatabase[finalShortcode]) {
    Log("backend", "warn", "database", `Shortcode collision: ${finalShortcode}`);
    return res.status(409).json({ 
      error: "Shortcode unavailable",
      suggestion: "Please try a different custom shortcode"
    });
  }

  urlDatabase[finalShortcode] = {
    originalUrl: url,
    expiry: new Date(Date.now() + validity * 60000),
    clicks: [],
    createdAt: new Date()
  };

  Log("backend", "info", "handler", `Created short URL: ${finalShortcode}`);
  res.status(201).json({
    shortLink: `${req.protocol}://${req.headers.host}/${finalShortcode}`,
    originalUrl: url,
    expiry: urlDatabase[finalShortcode].expiry.toISOString(),
    managementLink: `${req.protocol}://${req.headers.host}/shorturls/${finalShortcode}`
  });
});

app.get('/:shortcode', (req, res) => {
  const { shortcode } = req.params;
  const entry = urlDatabase[shortcode];

  if (!entry) {
    Log("backend", "warn", "handler", `Invalid shortcode access: ${shortcode}`);
    return res.status(404).json({ 
      error: "Link not found",
      solution: "Please check the URL or create a new short link"
    });
  }

  if (new Date() > entry.expiry) {
    Log("backend", "warn", "expiry", `Expired link accessed: ${shortcode}`);
    return res.status(410).json({ 
      error: "Link expired",
      originalUrl: entry.originalUrl,
      solution: "Create a new short link for this URL"
    });
  }

  entry.clicks.push({
    timestamp: new Date(),
    referrer: req.get('Referer') || "direct",
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    location: req.headers['x-forwarded-for'] || req.connection.remoteAddress
  });

  Log("backend", "debug", "handler", `Redirecting: ${shortcode} → ${entry.originalUrl}`);
  res.redirect(entry.originalUrl);
});

app.get('/shorturls/:shortcode', (req, res) => {
  const entry = urlDatabase[req.params.shortcode];
  
  if (!entry) {
    Log("backend", "error", "handler", `Stats requested for invalid shortcode`);
    return res.status(404).json({ 
      error: "Shortcode not found",
      availableEndpoints: {
        create: "POST /shorturls",
        redirect: "GET /:shortcode"
      }
    });
  }

  Log("backend", "info", "analytics", `Providing stats for ${req.params.shortcode}`);
  res.json({
    originalUrl: entry.originalUrl,
    shortLink: `${req.protocol}://${req.headers.host}/${req.params.shortcode}`,
    createdAt: entry.createdAt,
    expiry: entry.expiry,
    totalClicks: entry.clicks.length,
    clicks: entry.clicks.map(click => ({
      timestamp: click.timestamp,
      referrer: click.referrer,
      device: click.userAgent
    }))
  });
});

app.get('/test-log', async (req, res) => {
  await Log("backend", "info", "handler", "Test log from /test-log endpoint");
  res.json({
    status: "Test log sent",
    note: "Check server console for logging results"
  });
});

app.use((err, req, res, next) => {
  Log("backend", "error", "server", `Unhandled error: ${err.stack}`);
  res.status(500).json({ 
    error: "Internal Server Error",
    requestId: req.id,
    supportContact: "support@example.com"
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  Log("backend", "info", "service", `Server running on port ${PORT}`);
  console.log('Server ready!');
});