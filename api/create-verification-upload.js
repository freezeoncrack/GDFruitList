import crypto from "node:crypto";

const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024;
const DEFAULT_EXPIRES_SECONDS = 300;
const FIREBASE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let certCache = {
  certs: null,
  expiresAtMs: 0
};

function slugPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

function getExtension(fileName) {
  const name = String(fileName || "");
  const lastDot = name.lastIndexOf(".");
  if (lastDot < 0 || lastDot === name.length - 1) {
    return "mp4";
  }
  return name.slice(lastDot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
}

function hashSha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hmacSha256(key, value, encoding) {
  const hmac = crypto.createHmac("sha256", key).update(value);
  return encoding ? hmac.digest(encoding) : hmac.digest();
}

function awsEncode(value) {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function awsPathEncode(path) {
  return path
    .split("/")
    .map((segment) => awsEncode(segment))
    .join("/");
}

function toAmzDate(now) {
  const iso = now.toISOString();
  return {
    amzDate: `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z`,
    dateStamp: `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}`
  };
}

function parseBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return req.body;
}

function parseMaxAgeMs(cacheControl) {
  if (!cacheControl) {
    return 0;
  }

  const match = cacheControl.match(/max-age=(\d+)/i);
  if (!match) {
    return 0;
  }

  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }

  return seconds * 1000;
}

function base64UrlToBuffer(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function parseJsonBuffer(buffer) {
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    return null;
  }
}

async function getFirebaseCerts() {
  const now = Date.now();
  if (certCache.certs && certCache.expiresAtMs > now) {
    return certCache.certs;
  }

  const response = await fetch(FIREBASE_CERTS_URL);
  if (!response.ok) {
    throw new Error("Could not fetch Firebase certs.");
  }

  const certs = await response.json();
  const ttlMs = parseMaxAgeMs(response.headers.get("cache-control"));

  certCache = {
    certs,
    expiresAtMs: now + (ttlMs || 60 * 60 * 1000)
  };

  return certs;
}

function getBearerToken(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim();
}

async function verifyFirebaseIdToken(idToken, projectId) {
  const tokenParts = String(idToken || "").split(".");
  if (tokenParts.length !== 3) {
    throw new Error("Invalid token format.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = tokenParts;
  const header = parseJsonBuffer(base64UrlToBuffer(encodedHeader));
  const payload = parseJsonBuffer(base64UrlToBuffer(encodedPayload));
  const signature = base64UrlToBuffer(encodedSignature);

  if (!header || !payload) {
    throw new Error("Invalid token payload.");
  }

  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Invalid token header.");
  }

  const certs = await getFirebaseCerts();
  const cert = certs[header.kid];
  if (!cert) {
    throw new Error("Unknown signing key.");
  }

  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();

  if (!verifier.verify(cert, signature)) {
    throw new Error("Invalid token signature.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;

  if (payload.aud !== projectId) {
    throw new Error("Invalid token audience.");
  }

  if (payload.iss !== expectedIssuer) {
    throw new Error("Invalid token issuer.");
  }

  if (typeof payload.sub !== "string" || payload.sub.length === 0 || payload.sub.length > 128) {
    throw new Error("Invalid token subject.");
  }

  if (!Number.isFinite(payload.iat) || !Number.isFinite(payload.exp)) {
    throw new Error("Invalid token timestamps.");
  }

  if (payload.exp <= nowSeconds) {
    throw new Error("Token expired.");
  }

  if (payload.iat > nowSeconds + 300) {
    throw new Error("Token issued in the future.");
  }

  return payload;
}

function buildPresignedPutUrl({
  endpoint,
  bucket,
  objectKey,
  accessKeyId,
  secretAccessKey,
  expiresSeconds,
  now
}) {
  const endpointUrl = new URL(endpoint);
  const host = endpointUrl.host;
  const { amzDate, dateStamp } = toAmzDate(now);

  const method = "PUT";
  const service = "s3";
  const region = "auto";
  const signedHeaders = "host";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const canonicalUri = `/${awsPathEncode(bucket)}/${awsPathEncode(objectKey)}`;

  const query = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": signedHeaders
  };

  const canonicalQueryString = Object.keys(query)
    .sort()
    .map((key) => `${awsEncode(key)}=${awsEncode(query[key])}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    hashSha256Hex(canonicalRequest)
  ].join("\n");

  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = hmacSha256(kSigning, stringToSign, "hex");

  const finalQuery = `${canonicalQueryString}&X-Amz-Signature=${signature}`;
  return `${endpointUrl.protocol}//${host}${canonicalUri}?${finalQuery}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || "fruitdemonlist";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT || "https://e4104b4afa44001c802f7ae4a7108450.r2.cloudflarestorage.com";
  const bucket = process.env.R2_BUCKET || "gdfruitlist";

  const idToken = getBearerToken(req);
  if (!idToken) {
    return res.status(401).json({ error: "Missing authentication token." });
  }

  try {
    await verifyFirebaseIdToken(idToken, firebaseProjectId);
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired authentication token." });
  }

  if (!accessKeyId || !secretAccessKey) {
    return res.status(500).json({ error: "Server upload credentials are missing." });
  }

  const body = parseBody(req);
  const levelName = String(body.levelName || "").trim();
  const dateVerified = String(body.dateVerified || "").trim();
  const verifiedBy = String(body.verifiedBy || "").trim();
  const discordUsername = String(body.discordUsername || "").trim();
  const fileName = String(body.fileName || "").trim();
  const fileType = String(body.fileType || "").trim();
  const fileSize = Number(body.fileSize || 0);

  if (!levelName || !dateVerified || !verifiedBy) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  if (!fileName || !fileType.startsWith("video/")) {
    return res.status(400).json({ error: "A single video file is required." });
  }

  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE_BYTES) {
    return res.status(400).json({ error: "Invalid file size." });
  }

  const ext = getExtension(fileName);
  const normalizedFileName = [
    slugPart(levelName) || "unknown-level",
    slugPart(dateVerified) || "unknown-date",
    slugPart(verifiedBy) || "unknown-verifier",
    slugPart(discordUsername) || "no-discord"
  ].join("__") + `.${ext}`;

  const objectKey = `verifications/${normalizedFileName}`;

  try {
    const uploadUrl = buildPresignedPutUrl({
      endpoint,
      bucket,
      objectKey,
      accessKeyId,
      secretAccessKey,
      expiresSeconds: DEFAULT_EXPIRES_SECONDS,
      now: new Date()
    });

    return res.status(200).json({
      uploadUrl,
      objectKey,
      fileName: normalizedFileName,
      expiresIn: DEFAULT_EXPIRES_SECONDS
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not create upload URL." });
  }
}
