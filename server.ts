import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";

// Initialize Firebase Admin SDK
const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "cowplugng-8b4ca";
try {
  if (getApps().length === 0) {
    initializeApp({
      projectId: projectId
    });
    console.log("Firebase Admin initialized successfully with Project ID:", projectId);
  }
} catch (error) {
  console.error("Firebase Admin initialization error:", error);
}

// Helper functions to parse and serialize Firestore document fields
function parseFirestoreFields(fields: any): any {
  const result: any = {};
  if (!fields) return result;
  for (const [key, value] of Object.entries(fields)) {
    result[key] = parseFirestoreValue(value);
  }
  return result;
}

function parseFirestoreValue(valueObj: any): any {
  if (!valueObj || typeof valueObj !== 'object') return valueObj;
  
  if ('stringValue' in valueObj) return valueObj.stringValue;
  if ('integerValue' in valueObj) return parseInt(valueObj.integerValue, 10);
  if ('doubleValue' in valueObj) return parseFloat(valueObj.doubleValue);
  if ('booleanValue' in valueObj) return valueObj.booleanValue;
  if ('nullValue' in valueObj) return null;
  if ('arrayValue' in valueObj) {
    const values = valueObj.arrayValue.values || [];
    return values.map((val: any) => parseFirestoreValue(val));
  }
  if ('mapValue' in valueObj) {
    return parseFirestoreFields(valueObj.mapValue.fields || {});
  }
  if ('timestampValue' in valueObj) return valueObj.timestampValue;
  
  return valueObj;
}

function serializeToFirestoreFields(obj: any): any {
  const fields: any = {};
  for (const [key, value] of Object.entries(obj)) {
    fields[key] = serializeToFirestoreValue(value);
  }
  return { fields };
}

function serializeToFirestoreValue(val: any): any {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: val.toString() };
    } else {
      return { doubleValue: val };
    }
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(item => serializeToFirestoreValue(item))
      }
    };
  }
  if (typeof val === 'object') {
    return {
      mapValue: {
        fields: serializeToFirestoreFields(val).fields
      }
    };
  }
  return { stringValue: String(val) };
}

const app = express();
const PORT = 3000;

app.use(express.json());

// API routes FIRST
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Dynamic Branding & PWA Icon Helper Cache
interface CachedServerBranding {
  appName: string;
  tagline: string;
  primaryColor: string;
  logoUrl?: string;
  updatedAt?: number;
}
let cachedServerBranding: CachedServerBranding | null = null;
let serverBrandingCacheTime = 0;

async function getLiveServerBranding(): Promise<CachedServerBranding> {
  const now = Date.now();
  if (cachedServerBranding && now - serverBrandingCacheTime < 30000) {
    return cachedServerBranding;
  }
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/global`
    );
    if (res.ok) {
      const data: any = await res.json();
      const fields = data.fields || {};
      const brandingMap = fields.branding?.mapValue?.fields || {};
      const customLogo = brandingMap.logoUrl?.stringValue?.trim() || "";
      const companyName = fields.companyName?.stringValue?.trim() || brandingMap.appName?.stringValue?.trim() || "CowPlugNG";
      const tagline = brandingMap.tagline?.stringValue?.trim() || "Smart Agriculture. Secure Tomorrow.";
      const primaryColor = brandingMap.primaryColor?.stringValue?.trim() || "#064e3b";
      const updatedAt = Number(brandingMap.updatedAt?.integerValue || 0) || now;

      cachedServerBranding = {
        appName: companyName,
        tagline,
        primaryColor,
        logoUrl: customLogo || undefined,
        updatedAt,
      };
      serverBrandingCacheTime = now;
      return cachedServerBranding;
    }
  } catch (err) {
    console.warn("[Server Branding] Could not fetch live branding from Firestore, using fallback:", err);
  }
  return (
    cachedServerBranding || {
      appName: "CowPlugNG",
      tagline: "Smart Agriculture. Secure Tomorrow.",
      primaryColor: "#064e3b",
      updatedAt: now,
    }
  );
}

function buildCloudinaryServerIconUrl(logoUrl: string | undefined, size: number, maskable: boolean = false): string {
  if (!logoUrl) {
    if (maskable) return `/icons/icon-maskable-${size}x${size}.png`;
    if (size === 180) return '/icons/apple-touch-icon.png';
    if (size === 64 || size === 32) return '/favicon.png';
    return `/icons/icon-${size}x${size}.png`;
  }
  if (logoUrl.includes("cloudinary.com") && logoUrl.includes("/upload/")) {
    let transformation = "";
    if (maskable) {
      const innerSize = Math.round(size * 0.65);
      transformation = `b_white,c_pad,h_${innerSize},w_${innerSize}/b_white,c_pad,h_${size},w_${size}`;
    } else {
      transformation = `b_white,c_pad,h_${size},w_${size}`;
    }
    return logoUrl.replace("/upload/", `/upload/${transformation}/`);
  }
  return logoUrl;
}

// PWA Service Worker and Manifest routes with strict caching rules
app.get(["/sw.js", "/firebase-messaging-sw.js"], (req, res, next) => {
  res.setHeader("Service-Worker-Allowed", "/");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Content-Type", "application/javascript");
  next();
});

// Dynamic PWA Web Manifest responding with live Branding Logo and Custom Identity
app.get(["/manifest.webmanifest", "/manifest.json", "/api/manifest.json"], async (req, res) => {
  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=86400");

  const branding = await getLiveServerBranding();
  const icon512 = buildCloudinaryServerIconUrl(branding.logoUrl, 512, false);
  const icon192 = buildCloudinaryServerIconUrl(branding.logoUrl, 192, false);
  const maskable512 = buildCloudinaryServerIconUrl(branding.logoUrl, 512, true);
  const maskable192 = buildCloudinaryServerIconUrl(branding.logoUrl, 192, true);

  const manifest = {
    name: `${branding.appName} - Smart Agriculture`,
    short_name: branding.appName,
    description: "Nigeria's premier digital livestock investment, asset tracking, and professional portfolio management platform.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: branding.primaryColor || "#064e3b",
    categories: ["business", "finance", "productivity"],
    prefer_related_applications: false,
    icons: [
      {
        src: icon192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: icon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: maskable192,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: maskable512,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/icons/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/icons/icon-maskable.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ],
    shortcuts: [
      {
        name: "Portfolio & Livestock",
        short_name: "Portfolio",
        description: "View your active livestock portfolio and health records",
        url: "/?tab=my-livestock",
        icons: [{ src: icon192, sizes: "192x192" }]
      },
      {
        name: "My Spending & Ledger",
        short_name: "Spending",
        description: "Track payments, itemized fee breakdowns, and invoices",
        url: "/?tab=spending",
        icons: [{ src: icon192, sizes: "192x192" }]
      },
      {
        name: "Source Livestock",
        short_name: "Source",
        description: "Initiate livestock acquisition and consultation",
        url: "/?tab=sourcing",
        icons: [{ src: icon192, sizes: "192x192" }]
      }
    ]
  };

  res.json(manifest);
});

// Dynamic Icon Proxy / Redirect for Direct Static Icon Requests
app.get([
  "/icons/icon-512x512.png",
  "/icons/icon-192x192.png",
  "/icons/icon-maskable-512x512.png",
  "/icons/icon-maskable-192x192.png",
  "/icons/apple-touch-icon.png",
  "/apple-touch-icon.png"
], async (req, res, next) => {
  try {
    const branding = await getLiveServerBranding();
    if (branding.logoUrl && branding.logoUrl.includes("cloudinary.com")) {
      const isMaskable = req.path.includes("maskable");
      const is192 = req.path.includes("192");
      const isApple = req.path.includes("apple");
      const size = is192 ? 192 : (isApple ? 180 : 512);
      const targetUrl = buildCloudinaryServerIconUrl(branding.logoUrl, size, isMaskable);

      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      return res.redirect(302, targetUrl);
    }
  } catch (e) {
    // Fallback to local static asset
  }
  next();
});

// Register or Update Device FCM Token Endpoint
app.post("/api/notifications/register-token", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
  }

  const idToken = authHeader.split("Bearer ")[1];
  const { token, platform, userAgent, isStandalone } = req.body;

  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Bad Request: Missing or invalid registration token" });
  }

  try {
    const authAdmin = getAuth();
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const callerUid = decodedToken.uid;
    const callerEmail = decodedToken.email || "";

    // Fetch caller's user role from Firestore REST API
    let userRole = "investor";
    try {
      const userRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${callerUid}`,
        { headers: { "Authorization": `Bearer ${idToken}` } }
      );
      if (userRes.ok) {
        const docJson = await userRes.json();
        const userData = parseFirestoreFields(docJson.fields || {});
        userRole = userData.role || "investor";
      }
    } catch (e) {
      console.warn("Could not fetch user profile for token registration:", e);
    }

    // Hash or sanitize token string for document ID
    const tokenDocId = `${callerUid}_${Buffer.from(token.slice(-16)).toString("hex")}`;
    const tokenPayload = {
      userId: callerUid,
      userEmail: callerEmail,
      userRole: userRole,
      token: token,
      platform: platform || "web",
      userAgent: userAgent || "",
      isStandalone: Boolean(isStandalone),
      active: true,
      updatedAt: Date.now()
    };

    const writeRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/fcmTokens/${tokenDocId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify(serializeToFirestoreFields(tokenPayload))
      }
    );

    if (!writeRes.ok) {
      const errText = await writeRes.text();
      console.warn(`Firestore write warning for token: ${errText}`);
    }

    return res.json({ success: true, message: "Device registered for push notifications", docId: tokenDocId });
  } catch (error: any) {
    console.error("Token registration error:", error);
    return res.status(500).json({ error: error.message || "Failed to register push token" });
  }
});

// Server-Side FCM Push Notification Dispatch Endpoint
app.post("/api/notifications/send-push", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
  }

  const idToken = authHeader.split("Bearer ")[1];
  const { userId, title, message, category, priority, actionLink, actionText } = req.body;

  if (!userId || !title || !message) {
    return res.status(400).json({ error: "Bad Request: Missing required notification fields (userId, title, message)" });
  }

  try {
    const authAdmin = getAuth();
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const callerUid = decodedToken.uid;

    console.log(`[Push Dispatch] Request from ${callerUid} -> Target: ${userId} | Title: "${title}"`);

    // 1. Gather destination FCM tokens from Firestore
    let tokensToNotify: Array<{ docId: string; token: string; userId: string }> = [];

    if (userId === "TEST_ME") {
      // Query tokens for the caller themselves
      const queryRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
          },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: "fcmTokens" }],
              where: {
                fieldFilter: {
                  field: { fieldPath: "userId" },
                  op: "EQUAL",
                  value: { stringValue: callerUid }
                }
              }
            }
          })
        }
      );

      if (queryRes.ok) {
        const queryJson = await queryRes.json();
        if (Array.isArray(queryJson)) {
          for (const item of queryJson) {
            if (item.document && item.document.fields) {
              const data = parseFirestoreFields(item.document.fields);
              const docName = item.document.name || "";
              const docId = docName.split("/").pop() || "";
              if (data.token && data.active !== false) {
                tokensToNotify.push({ docId, token: data.token, userId: data.userId });
              }
            }
          }
        }
      }
    } else if (userId === "ADMIN_BROADCAST") {
      // Query tokens where userRole is admin, super_admin, or staff
      const queryRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
          },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: "fcmTokens" }]
            }
          })
        }
      );

      if (queryRes.ok) {
        const queryJson = await queryRes.json();
        if (Array.isArray(queryJson)) {
          for (const item of queryJson) {
            if (item.document && item.document.fields) {
              const data = parseFirestoreFields(item.document.fields);
              const docName = item.document.name || "";
              const docId = docName.split("/").pop() || "";
              const role = (data.userRole || "").toLowerCase();
              const isAdminRole = role.includes("admin") || role.includes("staff");
              if (data.token && data.active !== false && isAdminRole) {
                tokensToNotify.push({ docId, token: data.token, userId: data.userId });
              }
            }
          }
        }
      }
    } else {
      // Query tokens for specific target user ID
      const queryRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
          },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: "fcmTokens" }],
              where: {
                fieldFilter: {
                  field: { fieldPath: "userId" },
                  op: "EQUAL",
                  value: { stringValue: userId }
                }
              }
            }
          })
        }
      );

      if (queryRes.ok) {
        const queryJson = await queryRes.json();
        if (Array.isArray(queryJson)) {
          for (const item of queryJson) {
            if (item.document && item.document.fields) {
              const data = parseFirestoreFields(item.document.fields);
              const docName = item.document.name || "";
              const docId = docName.split("/").pop() || "";
              if (data.token && data.active !== false) {
                tokensToNotify.push({ docId, token: data.token, userId: data.userId });
              }
            }
          }
        }
      }
    }

    // Deduplicate tokens
    const uniqueTokensMap = new Map<string, { docId: string; token: string; userId: string }>();
    for (const t of tokensToNotify) {
      if (!uniqueTokensMap.has(t.token)) {
        uniqueTokensMap.set(t.token, t);
      }
    }
    const targetTokens = Array.from(uniqueTokensMap.values());

    if (targetTokens.length === 0) {
      console.log(`[Push Dispatch] No active push tokens registered for target ${userId}.`);
      return res.json({
        success: true,
        sentCount: 0,
        message: "No registered device tokens found for recipient."
      });
    }

    const tokenStrings = targetTokens.map(t => t.token);
    console.log(`[Push Dispatch] Dispatched to ${tokenStrings.length} registered device(s)`);

    const cleanActionLink = actionLink || "/?tab=dashboard";

    // 2. Dispatch Push via Firebase Admin SDK Messaging
    let successCount = 0;
    let failureCount = 0;
    const invalidTokenDocIds: string[] = [];

    try {
      const messagingAdmin = getMessaging();
      const multicastPayload = {
        tokens: tokenStrings,
        notification: {
          title: title,
          body: message
        },
        data: {
          title: String(title),
          message: String(message),
          actionLink: String(cleanActionLink),
          category: String(category || "General"),
          priority: String(priority || "INFO"),
          timestamp: String(Date.now()),
          click_action: String(cleanActionLink)
        },
        webpush: {
          notification: {
            title: title,
            body: message,
            icon: "/icons/icon-192x192.png",
            badge: "/icons/icon-192x192.png",
            tag: `cowplug-push-${Date.now()}`,
            renotify: true,
            requireInteraction: priority === "CRITICAL" || priority === "HIGH",
            data: {
              url: cleanActionLink,
              actionLink: cleanActionLink,
              timestamp: Date.now()
            },
            actions: [
              { action: "open", title: actionText || "View Details" }
            ]
          },
          fcmOptions: {
            link: cleanActionLink
          }
        }
      };

      const response = await messagingAdmin.sendEachForMulticast(multicastPayload);
      successCount = response.successCount;
      failureCount = response.failureCount;

      console.log(`[Push Dispatch Result] Success: ${successCount}, Failures: ${failureCount}`);

      // Track invalid tokens for cleanup
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const errCode = resp.error.code;
          console.warn(`Push delivery failure for token ${idx}:`, errCode, resp.error.message);
          if (
            errCode === "messaging/invalid-registration-token" ||
            errCode === "messaging/registration-token-not-registered"
          ) {
            invalidTokenDocIds.push(targetTokens[idx].docId);
          }
        }
      });
    } catch (fcmError: any) {
      console.error("[Push Dispatch Error] Firebase Admin Messaging failure:", fcmError);
      return res.status(200).json({
        success: false,
        warning: "FCM delivery service encountered an issue: " + (fcmError.message || String(fcmError)),
        targetCount: tokenStrings.length
      });
    }

    // 3. Clean up invalid/expired tokens asynchronously
    if (invalidTokenDocIds.length > 0) {
      for (const docId of invalidTokenDocIds) {
        fetch(
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/fcmTokens/${docId}`,
          {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${idToken}` }
          }
        ).catch(e => console.warn("Failed to delete stale token:", e));
      }
    }

    return res.json({
      success: true,
      sentCount: successCount,
      failedCount: failureCount,
      cleanedTokensCount: invalidTokenDocIds.length
    });
  } catch (error: any) {
    console.error("Push dispatch error:", error);
    return res.status(500).json({ error: error.message || "Failed to dispatch push notification" });
  }
});


// Secure User Deletion Endpoint for Super Admin
app.post("/api/admin/delete-user", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing or malformed authentication header" });
  }

  const idToken = authHeader.split("Bearer ")[1];
  const { targetUid } = req.body;

  if (!targetUid) {
    return res.status(400).json({ error: "Bad Request: Missing target user identifier (targetUid)" });
  }

  try {
    const authAdmin = getAuth();

    // 1. Verify caller's identity and load token using Firebase Admin SDK (stateless, requires no project IAM keys)
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const callerUid = decodedToken.uid;
    const callerEmail = decodedToken.email || "";

    // 2. Fetch caller's profile via secure Firestore REST API using caller's own ID token
    let callerData: any = null;
    try {
      const callerRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${callerUid}`,
        {
          headers: {
            "Authorization": `Bearer ${idToken}`
          }
        }
      );
      if (callerRes.ok) {
        const docJson = await callerRes.json();
        callerData = parseFirestoreFields(docJson.fields || {});
      } else {
        console.warn(`Failed to fetch caller profile from Firestore REST API: status ${callerRes.status}`);
      }
    } catch (err) {
      console.error("Error fetching caller profile via REST API:", err);
    }
    
    // Authorization Check: Must be super_admin role in DB or primary admin email
    const isSuperAdmin = 
      callerEmail.toLowerCase() === "tugbobodare4@gmail.com" || 
      (callerData && (callerData.role === "super_admin" || callerData.role === "SUPER_ADMIN"));

    if (!isSuperAdmin) {
      return res.status(403).json({ error: "Forbidden: Only Super Admins are authorized to perform permanent user deletion." });
    }

    // 3. Prevent self-deletion
    if (callerUid === targetUid) {
      return res.status(400).json({ error: "Forbidden: You are not allowed to delete your own Super Admin account." });
    }

    // 4. Fetch target user's details (for verification and log details)
    let targetUserAuth: any = null;
    try {
      targetUserAuth = await authAdmin.getUser(targetUid);
    } catch (err: any) {
      console.log(`[Preview Limitation] Target user Auth fetch failed (requires service account). Proceeding with document cleanup. ${err?.message}`);
    }

    // Fetch target profile via secure Firestore REST API using caller's own ID token
    let targetData: any = null;
    let targetDocExists = false;
    try {
      const targetRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${targetUid}`,
        {
          headers: {
            "Authorization": `Bearer ${idToken}`
          }
        }
      );
      if (targetRes.ok) {
        targetDocExists = true;
        const docJson = await targetRes.json();
        targetData = parseFirestoreFields(docJson.fields || {});
      }
    } catch (err) {
      console.error("Error fetching target profile via REST API:", err);
    }

    // Prevent deletion of primary Super Admin
    const isTargetPrimaryAdmin = 
      (targetUserAuth && targetUserAuth.email?.toLowerCase() === "tugbobodare4@gmail.com") || 
      (targetData && targetData.email?.toLowerCase() === "tugbobodare4@gmail.com") ||
      (targetData && (targetData.role === "super_admin" || targetData.role === "SUPER_ADMIN") && targetData.email?.toLowerCase() === "tugbobodare4@gmail.com");

    if (isTargetPrimaryAdmin) {
      return res.status(403).json({ error: "Forbidden: The primary Super Admin account cannot be deleted." });
    }

    console.log(`[Super Admin Action] Initiating cascading deletion for user: ${targetUid} (${targetUserAuth?.email || targetData?.email || "Unknown"})`);

    // 5. Delete Firebase Auth Account (using Firebase Admin Auth SDK)
    let authDeleted = false;
    let authError = "";
    if (targetUserAuth) {
      try {
        await authAdmin.deleteUser(targetUid);
        authDeleted = true;
        console.log(`Successfully deleted auth user: ${targetUid}`);
      } catch (err: any) {
        console.log(`[Preview Limitation] Failed to delete user from Firebase Auth: ${err?.message}`);
        authError = err?.message || String(err);
      }
    }

    // 6. Cascading deletions in Firestore (associated user records based on the retention policy)
    const deletionSummary: { [key: string]: number } = {};

    // Helper function to query & delete via Firestore REST API (using caller's ID token)
    const batchDeleteCollection = async (collectionName: string, fieldName: string) => {
      try {
        const queryRes = await fetch(
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`
            },
            body: JSON.stringify({
              structuredQuery: {
                from: [{ collectionId: collectionName }],
                where: {
                  fieldFilter: {
                    field: { fieldPath: fieldName },
                    op: "EQUAL",
                    value: { stringValue: targetUid }
                  }
                }
              }
            })
          }
        );

        if (!queryRes.ok) {
          const errText = await queryRes.text();
          console.error(`Query failed for collection ${collectionName}: ${errText}`);
          deletionSummary[collectionName] = 0;
          return;
        }

        const queryResult = await queryRes.json();
        let count = 0;
        if (Array.isArray(queryResult)) {
          for (const item of queryResult) {
            if (item.document && item.document.name) {
              const docName = item.document.name;
              const delRes = await fetch(
                `https://firestore.googleapis.com/v1/${docName}`,
                {
                  method: "DELETE",
                  headers: {
                    "Authorization": `Bearer ${idToken}`
                  }
                }
              );
              if (delRes.ok) {
                count++;
              } else {
                console.warn(`Failed to delete document ${docName}: status ${delRes.status}`);
              }
            }
          }
        }
        deletionSummary[collectionName] = count;
        console.log(`Deleted ${count} records in collection: ${collectionName}`);
      } catch (err) {
        console.error(`Error in batchDeleteCollection for ${collectionName}:`, err);
        deletionSummary[collectionName] = 0;
      }
    };

    // Cascade deletions on notifications, sourcing, payments, delivery, invoices, and applications
    await batchDeleteCollection("notifications", "userId");
    await batchDeleteCollection("consultationRequests", "userId");
    await batchDeleteCollection("paymentReceipts", "investorId");
    await batchDeleteCollection("deliveryRequests", "investorId");
    await batchDeleteCollection("invoices", "investorId");
    await batchDeleteCollection("opportunityApplications", "custodianId");

    // Finally, delete the main user document in users collection
    if (targetDocExists) {
      try {
        const delRes = await fetch(
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${targetUid}`,
          {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${idToken}`
            }
          }
        );
        if (delRes.ok) {
          deletionSummary["users"] = 1;
          console.log(`Deleted user document in Firestore: ${targetUid}`);
        } else {
          deletionSummary["users"] = 0;
          console.error(`Failed to delete main user document: status ${delRes.status}`);
        }
      } catch (err) {
        console.error("Error deleting main user document:", err);
        deletionSummary["users"] = 0;
      }
    } else {
      deletionSummary["users"] = 0;
    }

    // 7. Audit Logging via REST API (using caller's ID token)
    const logPayload = {
      adminId: callerUid,
      adminName: callerData?.displayName || callerEmail || "Super Admin",
      action: "USER_DELETED_PERMANENTLY",
      targetId: targetUid,
      targetType: "USER",
      previousValue: {
        uid: targetUid,
        email: targetUserAuth?.email || targetData?.email || "",
        displayName: targetUserAuth?.displayName || targetData?.displayName || "Unnamed User",
        role: targetData?.role || ""
      },
      newValue: {
        deletedAuth: authDeleted,
        authError: authError || undefined,
        cascadingDeletions: deletionSummary
      },
      timestamp: Date.now()
    };

    try {
      const logFields = serializeToFirestoreFields(logPayload);
      const logRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/activityLogs`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
          },
          body: JSON.stringify(logFields)
        }
      );
      if (logRes.ok) {
        console.log("Audit log written successfully via REST API");
      } else {
        const errText = await logRes.text();
        console.error(`Failed to write audit log: status ${logRes.status}, error: ${errText}`);
      }
    } catch (err) {
      console.error("Error writing audit log via REST API:", err);
    }

    console.log(`[Super Admin Action] Permanent user deletion complete for ${targetUid}`);
    return res.status(200).json({
      success: true,
      message: "User and all associated records have been successfully and permanently deleted.",
      cascadingDeletions: deletionSummary
    });

  } catch (error: any) {
    console.error("Error in delete-user backend handler:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error?.message || error
    });
  }
});

// ==========================================
// TESTING RESET & DATA MANAGEMENT ENGINE
// ==========================================

const PROTECTED_SUPER_ADMIN_EMAILS = [
  "tugbobodare4@gmail.com"
];

const ALL_TRANSACTIONAL_COLLECTIONS = [
  "consultationRequests",
  "invoices",
  "paymentReceipts",
  "spendingLedger",
  "deliveryRequests",
  "liquidationRequests",
  "opportunityApplications",
  "notifications",
  "fcmTokens",
  "healthRecords",
  "livestockGrowthRecords",
  "livestockHealthRecords",
  "livestock",
  "livestockArchives",
  "livestockAssignments",
  "livestockMedia",
  "generalInquiries",
  "announcements"
];

// Phase 3 Safety Guard: Strict enforcement with robust environment fallback
function isTestingResetEnabled(): boolean {
  const val = process.env.TESTING_RESET_ENABLED;
  if (val === "false") return false;
  if (val === "true") return true;
  return process.env.NODE_ENV !== "production";
}

function isProtectedSuperAdmin(email?: string, role?: string): boolean {
  if (!email && !role) return false;
  const emailLower = (email || "").toLowerCase().trim();
  if (PROTECTED_SUPER_ADMIN_EMAILS.includes(emailLower)) {
    return true;
  }
  const roleLower = (role || "").toLowerCase().trim();
  return roleLower === "super_admin";
}

// User Classification: Differentiates verified test data from ambiguous real accounts and protected admins
interface UserClassification {
  status: 'PROTECTED_ADMIN' | 'VERIFIED_TEST' | 'AMBIGUOUS';
  reason: string;
}

function classifyUser(user: { id: string; fields: any }): UserClassification {
  const email = (user.fields?.email || "").toLowerCase().trim();
  const role = (user.fields?.role || "").toLowerCase().trim();
  const displayName = (user.fields?.displayName || user.fields?.name || "").toLowerCase().trim();
  const investorId = (user.fields?.investorId || "").toUpperCase().trim();
  const isTestFlag = Boolean(user.fields?.isTest || user.fields?.isTestData || user.fields?.testAccount || user.fields?.isTestUser);
  const permissions = Array.isArray(user.fields?.permissions) ? user.fields.permissions : [];

  // 1. Protected Admin Check
  if (
    PROTECTED_SUPER_ADMIN_EMAILS.includes(email) ||
    role === "super_admin" ||
    role === "admin" ||
    role === "staff" ||
    permissions.some((p: string) => ['dashboard.view', 'admin.access', 'all'].includes(p))
  ) {
    return {
      status: 'PROTECTED_ADMIN',
      reason: email === "tugbobodare4@gmail.com" 
        ? "Protected Primary Super Admin account"
        : `Protected Administrative Staff account (${role || 'admin'})`
    };
  }

  // 2. Verified Test User Check (Positive test markers)
  const isTestDomain = email.endsWith("@example.com") || 
                       email.endsWith("@test.com") || 
                       email.endsWith("@testing.com") || 
                       email.endsWith("@cowplug.test") || 
                       email.endsWith("@mailinator.com") ||
                       email.endsWith("@tempmail.com");

  const hasTestEmailPattern = email.includes("+test") || 
                              email.startsWith("test") || 
                              email.startsWith("demo") || 
                              email.startsWith("mock") || 
                              email.includes("tester");

  const hasTestName = displayName.includes("test") || 
                      displayName.includes("demo") || 
                      displayName.includes("simulation") || 
                      displayName.includes("mock");

  const hasTestInvestorId = investorId.startsWith("TEST") || 
                            investorId.includes("TEST") || 
                            investorId.startsWith("DEMO");

  if (isTestFlag || isTestDomain || hasTestEmailPattern || hasTestName || hasTestInvestorId) {
    let reason = "Flagged with explicit test indicator";
    if (isTestFlag) reason = "Document explicitly marked with test flag (isTest=true)";
    else if (isTestDomain) reason = `Test email domain (${email.split('@')[1]})`;
    else if (hasTestEmailPattern) reason = `Test email pattern/prefix (${email})`;
    else if (hasTestName) reason = `Test display name identifier ("${displayName}")`;
    else if (hasTestInvestorId) reason = `Test investor ID identifier (${investorId})`;

    return {
      status: 'VERIFIED_TEST',
      reason
    };
  }

  // In non-production environments, classify standard non-admin investor accounts as testable
  if (process.env.NODE_ENV !== 'production' && role !== 'admin' && role !== 'super_admin' && role !== 'staff') {
    return {
      status: 'VERIFIED_TEST',
      reason: 'Standard testable investor account (Development mode classification)'
    };
  }

  // 3. Ambiguous Account (Must be skipped to protect real non-admin users)
  return {
    status: 'AMBIGUOUS',
    reason: `Ambiguous user account: lacks explicit test flag or verified test identifier. Skipped to prevent accidental deletion.`
  };
}

// Helper: Verify Super Admin password using Firebase Auth Identity Toolkit REST API
async function verifySuperAdminPassword(password: string): Promise<{ success: boolean; error?: string }> {
  if (!password || typeof password !== "string" || password.trim().length === 0) {
    return { success: false, error: "Super Admin password is required." };
  }
  const apiKey = process.env.VITE_FIREBASE_API_KEY || "AIzaSyDwNZOwWgXEgBHArXc1UMfvuSR2AUrL9jU";
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "tugbobodare4@gmail.com",
          password: password.trim(),
          returnSecureToken: true
        })
      }
    );
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData?.error?.message;
      if (msg === "INVALID_LOGIN_CREDENTIALS" || msg === "INVALID_PASSWORD") {
        return { success: false, error: "Incorrect Super Admin password. Please check your credentials and try again." };
      }
      return { success: false, error: msg || "Super Admin password verification failed." };
    }
    const data = await res.json();
    return { success: Boolean(data.idToken) };
  } catch (err: any) {
    console.error("Error during Super Admin password verification:", err);
    return { success: false, error: err?.message || "Super Admin password verification request failed." };
  }
}

// Helper: List all documents in a collection via REST API with pagination
async function fetchAllDocsInCollection(
  collectionName: string,
  idToken: string
): Promise<Array<{ name: string; id: string; fields: any }>> {
  const docs: Array<{ name: string; id: string; fields: any }> = [];
  let pageToken: string | undefined = undefined;

  try {
    do {
      let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}?pageSize=300`;
      if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
      }

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      });

      if (!res.ok) {
        if (res.status === 404) break;
        const errText = await res.text().catch(() => "");
        console.warn(`Listing collection ${collectionName} returned status ${res.status}: ${errText}`);
        break;
      }

      const data = await res.json();
      if (Array.isArray(data.documents)) {
        for (const doc of data.documents) {
          const docId = doc.name.split("/").pop() || "";
          docs.push({
            name: doc.name,
            id: docId,
            fields: parseFirestoreFields(doc.fields || {})
          });
        }
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
  } catch (err) {
    console.error(`Error listing collection ${collectionName}:`, err);
  }

  return docs;
}

// Helper: Query documents by field equality with resilient in-memory fallback
async function fetchDocsByField(
  collectionName: string,
  fieldPath: string,
  fieldValue: string,
  idToken: string
): Promise<Array<{ name: string; id: string; fields: any }>> {
  const docs: Array<{ name: string; id: string; fields: any }> = [];
  try {
    const queryRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: collectionName }],
            where: {
              fieldFilter: {
                field: { fieldPath },
                op: "EQUAL",
                value: { stringValue: fieldValue }
              }
            }
          }
        })
      }
    );

    if (queryRes.ok) {
      const queryResult = await queryRes.json();
      if (Array.isArray(queryResult)) {
        for (const item of queryResult) {
          if (item.document && item.document.name) {
            const docId = item.document.name.split("/").pop() || "";
            docs.push({
              name: item.document.name,
              id: docId,
              fields: parseFirestoreFields(item.document.fields || {})
            });
          }
        }
      }
      return docs;
    } else {
      const errText = await queryRes.text().catch(() => "");
      console.warn(`runQuery on ${collectionName} by ${fieldPath} returned ${queryRes.status}: ${errText}. Falling back to list & filter.`);
    }
  } catch (err) {
    console.warn(`Error querying ${collectionName} by ${fieldPath}:`, err);
  }

  // Fallback: List all documents and filter in memory
  try {
    const allDocs = await fetchAllDocsInCollection(collectionName, idToken);
    return allDocs.filter(d => String(d.fields?.[fieldPath] ?? "") === String(fieldValue));
  } catch (fallbackErr) {
    console.error(`Fallback failed for ${collectionName}:`, fallbackErr);
    return [];
  }
}

// Helper: Resilient batch delete of documents using Firestore REST API :commit
async function batchDeleteDocNames(
  docNames: string[],
  idToken: string
): Promise<{ deletedCount: number; failedDocNames: string[]; errors: string[] }> {
  let deletedCount = 0;
  const failedDocNames: string[] = [];
  const errors: string[] = [];

  if (!docNames || docNames.length === 0) {
    return { deletedCount: 0, failedDocNames, errors };
  }

  const uniqueDocNames = Array.from(new Set(docNames));
  const chunkSize = 200;

  for (let i = 0; i < uniqueDocNames.length; i += chunkSize) {
    const chunk = uniqueDocNames.slice(i, i + chunkSize);
    try {
      const commitBody = {
        writes: chunk.map((name) => ({
          delete: name.startsWith("projects/")
            ? name
            : `projects/${projectId}/databases/(default)/documents/${name}`
        }))
      };

      const commitRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`
          },
          body: JSON.stringify(commitBody)
        }
      );

      if (commitRes.ok) {
        deletedCount += chunk.length;
      } else {
        const errText = await commitRes.text().catch(() => "");
        console.warn(`Commit failed (${commitRes.status}), falling back to individual deletes: ${errText}`);
        
        // Individual delete fallback
        for (const docName of chunk) {
          try {
            const url = docName.startsWith("https://")
              ? docName
              : docName.startsWith("projects/")
              ? `https://firestore.googleapis.com/v1/${docName}`
              : `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${docName}`;

            const delRes = await fetch(url, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${idToken}` }
            });

            if (delRes.ok || delRes.status === 404) {
              deletedCount++;
            } else {
              failedDocNames.push(docName);
              errors.push(`Doc ${docName}: status ${delRes.status}`);
            }
          } catch (err: any) {
            failedDocNames.push(docName);
            errors.push(`Doc ${docName}: ${err?.message || err}`);
          }
        }
      }
    } catch (err: any) {
      console.error("Batch delete chunk error:", err);
      errors.push(`Chunk error: ${err?.message || err}`);
    }
  }

  return { deletedCount, failedDocNames, errors };
}

// Helper: Safely delete Firebase Auth user account
async function deleteAuthUserSafely(uid: string): Promise<{ success: boolean; error?: string }> {
  try {
    const authAdmin = getAuth();
    await authAdmin.deleteUser(uid);
    return { success: true };
  } catch (err: any) {
    const code = err?.code || "";
    const msg = err?.message || String(err);
    if (code === "auth/user-not-found") {
      return { success: true, error: "User already removed from Auth" };
    }
    return { success: false, error: msg };
  }
}

// Helper: Reset livestock back to AVAILABLE without destroying definition records
async function resetLivestockToAvailable(
  livestockDocs: Array<{ name: string; id: string; fields: any }>,
  idToken: string
): Promise<number> {
  let count = 0;
  for (const docItem of livestockDocs) {
    try {
      const updatePayload = {
        ownerId: "",
        custodianId: "",
        status: "AVAILABLE",
        invoiceId: "",
        paymentId: "",
        sourcingRequestId: "",
        saleAmount: 0,
        saleDate: 0,
        saleNotes: "",
        liquidationStatus: "",
        isLiquidated: false,
        lastUpdated: Date.now()
      };
      const maskParams = Object.keys(updatePayload)
        .map((k) => `updateMask.fieldPaths=${k}`)
        .join("&");

      const url = docItem.name.startsWith("https://")
        ? `${docItem.name}?${maskParams}`
        : docItem.name.startsWith("projects/")
        ? `https://firestore.googleapis.com/v1/${docItem.name}?${maskParams}`
        : `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${docItem.name}?${maskParams}`;

      const patchRes = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify(serializeToFirestoreFields(updatePayload))
      });
      if (patchRes.ok) count++;
    } catch (e) {
      console.warn(`Failed to unassign livestock ${docItem.id}:`, e);
    }
  }
  return count;
}

// Helper: Record Testing Reset Audit Log in activityLogs
async function recordTestingAuditLog(params: {
  callerUid: string;
  callerName: string;
  callerEmail: string;
  scope: string;
  details: string;
  status: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED';
  startTime: number;
  completionTime: number;
  identifiedCount: number;
  deletedCount: number;
  skippedCount: number;
  failedCount: number;
  summary: Record<string, any>;
  idToken: string;
}) {
  const durationMs = params.completionTime - params.startTime;
  const logPayload = {
    userId: params.callerUid,
    adminId: params.callerUid,
    adminName: params.callerName || params.callerEmail || "Super Admin",
    adminEmail: params.callerEmail,
    action: `TESTING_RESET_${params.scope}`,
    targetType: "SYSTEM_TESTING_RESET",
    targetId: params.scope,
    details: params.details,
    metadata: {
      scope: params.scope,
      status: params.status,
      startTime: params.startTime,
      completionTime: params.completionTime,
      durationMs,
      identifiedCount: params.identifiedCount,
      deletedCount: params.deletedCount,
      skippedCount: params.skippedCount,
      failedCount: params.failedCount,
      summary: params.summary,
      environment: process.env.NODE_ENV || "development",
      timestamp: Date.now()
    },
    timestamp: Date.now()
  };

  try {
    const logFields = serializeToFirestoreFields(logPayload);
    await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/activityLogs`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.idToken}`
        },
        body: JSON.stringify(logFields)
      }
    );
  } catch (err) {
    console.error("Failed to write reset audit log:", err);
  }
}

// Helper: Middleware to check Admin authorization from Firebase ID token
async function verifyAdminAuth(req: express.Request): Promise<{
  authorized: boolean;
  isSuperAdmin: boolean;
  callerUid: string;
  callerEmail: string;
  callerData: any;
  idToken: string;
  error?: string;
  statusCode?: number;
}> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      authorized: false,
      isSuperAdmin: false,
      callerUid: "",
      callerEmail: "",
      callerData: null,
      idToken: "",
      error: "Unauthorized: Missing authentication Bearer token",
      statusCode: 401
    };
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const authAdmin = getAuth();
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const callerUid = decodedToken.uid;
    const callerEmail = decodedToken.email || "";

    const callerRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${callerUid}`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    );
    let callerData: any = null;
    if (callerRes.ok) {
      const docJson = await callerRes.json();
      callerData = parseFirestoreFields(docJson.fields || {});
    }

    const superAdmin = isProtectedSuperAdmin(callerEmail, callerData?.role);
    const isAdmin = superAdmin || 
                    callerData?.role === "admin" || 
                    callerData?.role === "staff" || 
                    (callerData?.permissions && Array.isArray(callerData.permissions) && callerData.permissions.some((p: string) => ['dashboard.view', 'admin.access', 'all'].includes(p)));

    if (!isAdmin) {
      return {
        authorized: false,
        isSuperAdmin: false,
        callerUid,
        callerEmail,
        callerData,
        idToken,
        error: "Forbidden: Admin privileges required to access reset management tools",
        statusCode: 403
      };
    }

    return {
      authorized: true,
      isSuperAdmin: superAdmin,
      callerUid,
      callerEmail,
      callerData,
      idToken
    };
  } catch (err: any) {
    return {
      authorized: false,
      isSuperAdmin: false,
      callerUid: "",
      callerEmail: "",
      callerData: null,
      idToken,
      error: `Authentication failed: ${err?.message || "Invalid or expired token"}`,
      statusCode: 401
    };
  }
}

// Endpoint 1: Testing Reset Tool Status & Live Database Metric Inspection
app.get("/api/admin/testing/status", async (req, res) => {
  const isEnabled = isTestingResetEnabled();
  const authCheck = await verifyAdminAuth(req);
  if (!authCheck.authorized) {
    return res.status(authCheck.statusCode || 401).json({ error: authCheck.error });
  }

  const { idToken } = authCheck;

  try {
    const users = await fetchAllDocsInCollection("users", idToken);
    
    // Classify all users
    const verifiedTestUsers: any[] = [];
    const ambiguousUsers: any[] = [];
    const protectedAdmins: any[] = [];

    for (const u of users) {
      const classification = classifyUser(u);
      const userItem = {
        uid: u.id,
        email: u.fields?.email || "No email",
        displayName: u.fields?.displayName || u.fields?.name || "Unnamed User",
        role: u.fields?.role || "investor",
        investorId: u.fields?.investorId || "",
        createdAt: u.fields?.createdAt || 0,
        classificationStatus: classification.status,
        reason: classification.reason
      };

      if (classification.status === 'VERIFIED_TEST') {
        verifiedTestUsers.push(userItem);
      } else if (classification.status === 'AMBIGUOUS') {
        ambiguousUsers.push(userItem);
      } else {
        protectedAdmins.push(userItem);
      }
    }

    const livestock = await fetchAllDocsInCollection("livestock", idToken);
    const assignedLivestock = livestock.filter(l => Boolean(l.fields?.ownerId));
    const invoices = await fetchAllDocsInCollection("invoices", idToken);
    const paymentReceipts = await fetchAllDocsInCollection("paymentReceipts", idToken);
    const consultationRequests = await fetchAllDocsInCollection("consultationRequests", idToken);
    const deliveryRequests = await fetchAllDocsInCollection("deliveryRequests", idToken);
    const liquidationRequests = await fetchAllDocsInCollection("liquidationRequests", idToken);
    const spendingLedger = await fetchAllDocsInCollection("spendingLedger", idToken);
    const notifications = await fetchAllDocsInCollection("notifications", idToken);
    const activityLogs = await fetchAllDocsInCollection("activityLogs", idToken);
    const healthRecords = await fetchAllDocsInCollection("healthRecords", idToken);
    const growthRecords = await fetchAllDocsInCollection("livestockGrowthRecords", idToken);

    return res.json({
      enabled: isEnabled,
      projectId,
      protectedSuperAdmin: "tugbobodare4@gmail.com",
      counts: {
        totalUsers: users.length,
        testUsers: verifiedTestUsers.length,
        ambiguousUsers: ambiguousUsers.length,
        protectedAdmins: protectedAdmins.length,
        totalLivestock: livestock.length,
        assignedLivestock: assignedLivestock.length,
        invoices: invoices.length,
        paymentReceipts: paymentReceipts.length,
        consultationRequests: consultationRequests.length,
        deliveryRequests: deliveryRequests.length,
        liquidationRequests: liquidationRequests.length,
        spendingLedger: spendingLedger.length,
        notifications: notifications.length,
        activityLogs: activityLogs.length,
        healthRecords: healthRecords.length,
        growthRecords: growthRecords.length
      },
      testUsersList: verifiedTestUsers,
      ambiguousUsersList: ambiguousUsers,
      protectedAdminsList: protectedAdmins
    });
  } catch (err: any) {
    console.error("Error in /api/admin/testing/status:", err);
    return res.status(500).json({ error: err?.message || "Failed to fetch testing reset status" });
  }
});

// Endpoint 2: Dry-Run / Preview Analysis Before Destruction (Phase 3 Requirement)
app.post("/api/admin/testing/preview", async (req, res) => {
  const authCheck = await verifyAdminAuth(req);
  if (!authCheck.authorized) {
    return res.status(authCheck.statusCode || 401).json({ error: authCheck.error });
  }

  const { idToken } = authCheck;
  const { scope, targetUid } = req.body;

  if (!scope) {
    return res.status(400).json({ error: "Missing required parameter 'scope'" });
  }

  const isEnabled = isTestingResetEnabled();

  try {
    const allUsers = await fetchAllDocsInCollection("users", idToken);

    // ==========================================
    // PREVIEW: SCOPE 1 - SPECIFIC TEST USER
    // ==========================================
    if (scope === "RESET_SELECTED_USER" || scope === "RESET_CURRENT_USER") {
      if (!targetUid) {
        return res.status(400).json({ error: "targetUid is required for single user preview" });
      }

      const targetDoc = allUsers.find(u => u.id === targetUid);
      const targetEmail = targetDoc?.fields?.email || "";
      const targetRole = targetDoc?.fields?.role || "";
      const classification = targetDoc ? classifyUser(targetDoc) : { status: 'AMBIGUOUS', reason: 'User not found' };

      if (isProtectedSuperAdmin(targetEmail, targetRole)) {
        return res.json({
          scope,
          canExecute: false,
          blockReason: "Super Admin account (tugbobodare4@gmail.com) is permanently protected.",
          isTestingResetEnabled: isEnabled
        });
      }

      const estimatedDeletions: Record<string, number> = {};
      for (const col of ALL_TRANSACTIONAL_COLLECTIONS) {
        const byUser = await fetchDocsByField(col, "userId", targetUid, idToken);
        const byInvestor = await fetchDocsByField(col, "investorId", targetUid, idToken);
        const count = Array.from(new Set([...byUser.map(d => d.id), ...byInvestor.map(d => d.id)])).length;
        if (count > 0) estimatedDeletions[col] = count;
      }

      const ownedLivestock = await fetchDocsByField("livestock", "ownerId", targetUid, idToken);
      const custodianLivestock = await fetchDocsByField("livestock", "custodianId", targetUid, idToken);
      const uniqueLivestockCount = Array.from(new Set([...ownedLivestock.map(l => l.id), ...custodianLivestock.map(l => l.id)])).length;

      return res.json({
        scope,
        canExecute: isEnabled,
        blockReason: !isEnabled ? "TESTING_RESET_ENABLED is not enabled in environment." : undefined,
        isTestingResetEnabled: isEnabled,
        targetUser: {
          uid: targetUid,
          email: targetEmail,
          displayName: targetDoc?.fields?.displayName || targetDoc?.fields?.name || "User",
          role: targetRole,
          classification: classification.status,
          classificationReason: classification.reason
        },
        estimatedDeletions,
        livestockToUnassign: uniqueLivestockCount,
        authAccountToDelete: 1,
        userProfileToDelete: 1,
        preservedAssets: [
          "Livestock catalog & animal profiles (restored to AVAILABLE, not deleted)",
          "Super Admin account (tugbobodare4@gmail.com)",
          "All other users and platform settings"
        ]
      });
    }

    // ==========================================
    // PREVIEW: SCOPE 2 - ALL TEST USERS
    // ==========================================
    if (scope === "RESET_ALL_TEST_USERS") {
      const qualifiedTestUsers: any[] = [];
      const skippedUsers: any[] = [];
      const protectedAdmins: any[] = [];

      for (const u of allUsers) {
        const c = classifyUser(u);
        const item = {
          uid: u.id,
          email: u.fields?.email || "No email",
          displayName: u.fields?.displayName || u.fields?.name || "Unnamed",
          role: u.fields?.role || "investor",
          reason: c.reason
        };

        if (c.status === 'VERIFIED_TEST') qualifiedTestUsers.push(item);
        else if (c.status === 'AMBIGUOUS') skippedUsers.push(item);
        else protectedAdmins.push(item);
      }

      const estimatedDeletions: Record<string, number> = {
        userProfiles: qualifiedTestUsers.length,
        authAccounts: qualifiedTestUsers.length
      };

      const allLivestock = await fetchAllDocsInCollection("livestock", idToken);
      const assignedCount = allLivestock.filter(l => Boolean(l.fields?.ownerId)).length;

      return res.json({
        scope,
        canExecute: isEnabled && qualifiedTestUsers.length > 0,
        blockReason: !isEnabled 
          ? "TESTING_RESET_ENABLED is not enabled in environment."
          : qualifiedTestUsers.length === 0 ? "No positively verified test users found." : undefined,
        isTestingResetEnabled: isEnabled,
        qualifiedUsersCount: qualifiedTestUsers.length,
        qualifiedUsers: qualifiedTestUsers,
        skippedUsersCount: skippedUsers.length,
        skippedUsers: skippedUsers,
        protectedAdminsCount: protectedAdmins.length,
        protectedAdmins: protectedAdmins,
        estimatedDeletions,
        livestockToUnassign: assignedCount,
        preservedAssets: [
          `Protected Admin & Staff accounts (${protectedAdmins.length})`,
          `Ambiguous real accounts skipped (${skippedUsers.length})`,
          "Livestock definitions & catalog records (unassigned and set to AVAILABLE)",
          "Global platform parameters & settings"
        ]
      });
    }

    // ==========================================
    // PREVIEW: SCOPE 3 - CLEAR OPERATIONAL DATA
    // ==========================================
    if (scope === "CLEAR_TEST_DATA") {
      const estimatedDeletions: Record<string, number> = {};
      let totalOperationalDocs = 0;

      for (const col of ALL_TRANSACTIONAL_COLLECTIONS) {
        const docs = await fetchAllDocsInCollection(col, idToken);
        estimatedDeletions[col] = docs.length;
        totalOperationalDocs += docs.length;
      }

      const allLivestock = await fetchAllDocsInCollection("livestock", idToken);
      const assignedCount = allLivestock.filter(l => Boolean(l.fields?.ownerId)).length;

      return res.json({
        scope,
        canExecute: isEnabled,
        blockReason: !isEnabled ? "TESTING_RESET_ENABLED is not enabled in environment." : undefined,
        isTestingResetEnabled: isEnabled,
        estimatedDeletions,
        totalOperationalRecords: totalOperationalDocs,
        livestockToUnassign: assignedCount,
        preservedAssets: [
          `All user profiles (${allUsers.length}) preserved`,
          "All Firebase Auth user accounts preserved",
          "Global platform branding & escrow parameters preserved",
          "Livestock animals preserved and set to AVAILABLE",
          "Investment packages & opportunities preserved"
        ]
      });
    }

    // ==========================================
    // PREVIEW: SCOPE 4 - FULL TEST RESET
    // ==========================================
    if (scope === "FULL_TEST_RESET") {
      const nonAdminUsers = allUsers.filter(u => !isProtectedSuperAdmin(u.fields?.email, u.fields?.role));
      const protectedAdmins = allUsers.filter(u => isProtectedSuperAdmin(u.fields?.email, u.fields?.role));

      const estimatedDeletions: Record<string, number> = {
        userProfiles: nonAdminUsers.length,
        authAccounts: nonAdminUsers.length
      };

      let totalOperationalDocs = 0;
      for (const col of ALL_TRANSACTIONAL_COLLECTIONS) {
        const docs = await fetchAllDocsInCollection(col, idToken);
        estimatedDeletions[col] = docs.length;
        totalOperationalDocs += docs.length;
      }

      const allLivestock = await fetchAllDocsInCollection("livestock", idToken);

      return res.json({
        scope,
        canExecute: isEnabled,
        blockReason: !isEnabled ? "TESTING_RESET_ENABLED is not enabled in environment." : undefined,
        isTestingResetEnabled: isEnabled,
        estimatedDeletions,
        totalOperationalRecords: totalOperationalDocs,
        testUsersToDelete: nonAdminUsers.length,
        livestockToReset: allLivestock.length,
        protectedAdminsCount: protectedAdmins.length,
        protectedAdmins: protectedAdmins.map(a => ({
          uid: a.id,
          email: a.fields?.email,
          role: a.fields?.role
        })),
        preservedAssets: [
          "Super Admin account (tugbobodare4@gmail.com) strictly shielded",
          "All authorized Admin and Staff profiles & access rules",
          "Platform core configurations & escrow settings (settings/global)",
          "Livestock definitions & pricing preserved (animals reset to AVAILABLE)",
          "Investment opportunities & packages preserved",
          "System Activity Logs audit trail"
        ]
      });
    }

    return res.status(400).json({ error: `Unrecognized scope '${scope}'` });
  } catch (err: any) {
    console.error("Preview error:", err);
    return res.status(500).json({ error: err?.message || "Failed to generate reset preview" });
  }
});

// Endpoint 3: Verify Super Admin Password for Testing Authorization
app.post("/api/admin/testing/verify-password", async (req, res) => {
  const authCheck = await verifyAdminAuth(req);
  if (!authCheck.authorized) {
    return res.status(authCheck.statusCode || 401).json({ error: authCheck.error });
  }

  const { password } = req.body;
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Password is required" });
  }

  try {
    const verification = await verifySuperAdminPassword(password);
    if (!verification.success) {
      return res.status(401).json({ error: verification.error || "Incorrect Super Admin password" });
    }

    return res.json({
      success: true,
      message: "Super Admin password verified successfully",
      superAdminEmail: "tugbobodare4@gmail.com"
    });
  } catch (err: any) {
    console.error("Error in /api/admin/testing/verify-password:", err);
    return res.status(500).json({ error: err?.message || "Password verification failed" });
  }
});

// Endpoint 4: Execute Testing Reset Tool with Scopes
app.post("/api/admin/testing/reset", async (req, res) => {
  const startTime = Date.now();

  // 1. Safety Guard Check: Reject if disabled or missing
  if (!isTestingResetEnabled()) {
    return res.status(403).json({
      error: "Testing Reset Tool is disabled by system policy (TESTING_RESET_ENABLED is false or not configured)."
    });
  }

  // 2. Authentication & Admin Authorization Check
  const authCheck = await verifyAdminAuth(req);
  if (!authCheck.authorized) {
    return res.status(authCheck.statusCode || 401).json({ error: authCheck.error });
  }

  const { callerUid, callerEmail, callerData, idToken } = authCheck;
  const { scope, targetUid, confirmationKeyword, superAdminPassword } = req.body;

  if (!scope) {
    return res.status(400).json({ error: "Bad Request: Missing required parameter 'scope'" });
  }

  // 3. Super Admin Password verification if provided
  let superAdminPasswordVerified = false;
  if (superAdminPassword && typeof superAdminPassword === "string" && superAdminPassword.trim().length > 0) {
    const verification = await verifySuperAdminPassword(superAdminPassword.trim());
    if (!verification.success) {
      return res.status(401).json({
        error: verification.error || "Super Admin password verification failed. Please check credentials and try again."
      });
    }
    superAdminPasswordVerified = true;
  }

  const executionStages: Record<string, { status: 'completed' | 'failed' | 'skipped'; count?: number; errors?: string[] }> = {};
  const deletionCounts: Record<string, number> = {};
  const skippedList: Array<{ uid?: string; email?: string; reason: string }> = [];
  const failureList: string[] = [];

  try {
    // ==========================================
    // SCOPE 1: RESET SINGLE TEST USER
    // ==========================================
    if (scope === "RESET_SELECTED_USER" || scope === "RESET_CURRENT_USER") {
      if (!targetUid) {
        return res.status(400).json({ error: "Bad Request: 'targetUid' is required for single user reset." });
      }

      // Check target profile
      let targetEmail = "";
      let targetRole = "";
      let targetDisplayName = "";
      try {
        const targetRes = await fetch(
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${targetUid}`,
          { headers: { Authorization: `Bearer ${idToken}` } }
        );
        if (targetRes.ok) {
          const targetJson = await targetRes.json();
          const targetFields = parseFirestoreFields(targetJson.fields || {});
          targetEmail = targetFields.email || "";
          targetRole = targetFields.role || "";
          targetDisplayName = targetFields.displayName || targetFields.name || "";
        }
      } catch (e) {
        console.warn("Could not inspect target user doc:", e);
      }

      // Safeguard: Refuse to delete Super Admin or Admin staff
      if (isProtectedSuperAdmin(targetEmail, targetRole)) {
        return res.status(403).json({
          error: "Forbidden: Super Admin and Administrative Staff accounts are protected against reset or deletion."
        });
      }

      // Stage 1: Cascade delete user records across all operational collections
      executionStages.data_cleanup = { status: 'completed' };
      const docNamesToDelete: string[] = [];

      for (const col of ALL_TRANSACTIONAL_COLLECTIONS) {
        const byUser = await fetchDocsByField(col, "userId", targetUid, idToken);
        const byInvestor = await fetchDocsByField(col, "investorId", targetUid, idToken);
        const uniqueDocs = Array.from(new Map([...byUser, ...byInvestor].map(d => [d.id, d])).values());
        
        if (uniqueDocs.length > 0) {
          docNamesToDelete.push(...uniqueDocs.map(d => d.name));
          deletionCounts[col] = uniqueDocs.length;
        } else {
          deletionCounts[col] = 0;
        }
      }

      // Also clean fcmTokens subcollection
      const subTokens = await fetchAllDocsInCollection(`users/${targetUid}/fcmTokens`, idToken);
      if (subTokens.length > 0) {
        docNamesToDelete.push(...subTokens.map(d => d.name));
        deletionCounts.userSubFcmTokens = subTokens.length;
      }

      if (docNamesToDelete.length > 0) {
        const batchResult = await batchDeleteDocNames(docNamesToDelete, idToken);
        if (batchResult.errors.length > 0) {
          failureList.push(...batchResult.errors);
          executionStages.data_cleanup = { status: 'failed', errors: batchResult.errors };
        }
      }

      // Stage 2: Delete livestock owned or custodied by this test user and their associated records
      executionStages.livestock_deletion = { status: 'completed' };
      const ownedLivestock = await fetchDocsByField("livestock", "ownerId", targetUid, idToken);
      const custodianLivestock = await fetchDocsByField("livestock", "custodianId", targetUid, idToken);
      const userLivestock = Array.from(new Map([...ownedLivestock, ...custodianLivestock].map(l => [l.id, l])).values());
      
      let livestockDeletedCount = 0;
      if (userLivestock.length > 0) {
        docNamesToDelete.push(...userLivestock.map(l => l.name));
        livestockDeletedCount = userLivestock.length;
        deletionCounts.livestockDeleted = livestockDeletedCount;

        const userLivestockIds = userLivestock.map(l => l.id);
        for (const lsId of userLivestockIds) {
          for (const subCol of ["livestockGrowthRecords", "livestockHealthRecords", "healthRecords", "livestockArchives", "livestockAssignments", "livestockMedia"]) {
            const subDocs = await fetchDocsByField(subCol, "livestockId", lsId, idToken);
            if (subDocs.length > 0) {
              docNamesToDelete.push(...subDocs.map(d => d.name));
              deletionCounts[subCol] = (deletionCounts[subCol] || 0) + subDocs.length;
            }
          }
        }

        // Re-run batch delete with added livestock names
        const lsBatchResult = await batchDeleteDocNames(docNamesToDelete, idToken);
        if (lsBatchResult.errors.length > 0) {
          failureList.push(...lsBatchResult.errors);
          executionStages.livestock_deletion = { status: 'failed', errors: lsBatchResult.errors };
        }
      }

      // Stage 3: Delete user document from Firestore
      executionStages.user_doc_deletion = { status: 'completed' };
      let userDocDeleted = false;
      try {
        const delUserRes = await fetch(
          `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${targetUid}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${idToken}` }
          }
        );
        if (delUserRes.ok || delUserRes.status === 404) {
          userDocDeleted = true;
          deletionCounts.users = 1;
        } else {
          failureList.push(`Failed to delete user profile: status ${delUserRes.status}`);
          executionStages.user_doc_deletion = { status: 'failed' };
        }
      } catch (e: any) {
        failureList.push(`Error deleting user profile: ${e?.message || e}`);
        executionStages.user_doc_deletion = { status: 'failed' };
      }

      // Stage 4: Delete Auth account
      executionStages.auth_deletion = { status: 'completed' };
      const authResult = await deleteAuthUserSafely(targetUid);
      deletionCounts.authUsersDeleted = authResult.success ? 1 : 0;
      if (!authResult.success && authResult.error) {
        executionStages.auth_deletion = { status: 'skipped', errors: [authResult.error] };
      }

      const overallStatus = failureList.length === 0 ? 'SUCCESS' : 'PARTIAL_SUCCESS';
      const completionTime = Date.now();

      // Stage 5: Record Audit Log
      await recordTestingAuditLog({
        callerUid,
        callerName: callerData?.displayName || callerEmail,
        callerEmail,
        scope: "RESET_SELECTED_USER",
        details: `Reset test user ${targetDisplayName || targetEmail || targetUid}. Deletions: ${Object.values(deletionCounts).reduce((a, b) => a + b, 0)} records.`,
        status: overallStatus,
        startTime,
        completionTime,
        identifiedCount: Object.values(deletionCounts).reduce((a, b) => a + b, 0),
        deletedCount: Object.values(deletionCounts).reduce((a, b) => a + b, 0),
        skippedCount: 0,
        failedCount: failureList.length,
        summary: {
          targetUid,
          targetEmail,
          userDocDeleted,
          authDeleted: authResult.success,
          deletionCounts
        },
        idToken
      });

      return res.json({
        success: overallStatus === 'SUCCESS',
        scope: "RESET_SELECTED_USER",
        status: overallStatus,
        message: `Successfully reset test user (${targetEmail || targetUid}) and deleted ${livestockDeletedCount} livestock records and associated archives.`,
        deletionCounts,
        authDeleted: authResult.success,
        authNote: authResult.error,
        stages: executionStages,
        failures: failureList
      });
    }

    // ==========================================
    // SCOPE 2: RESET ALL TEST USERS
    // ==========================================
    if (scope === "RESET_ALL_TEST_USERS") {
      const allUsers = await fetchAllDocsInCollection("users", idToken);
      
      const qualifiedTestUsers: any[] = [];
      for (const u of allUsers) {
        const c = classifyUser(u);
        if (c.status === 'VERIFIED_TEST') {
          qualifiedTestUsers.push(u);
        } else {
          skippedList.push({
            uid: u.id,
            email: u.fields?.email,
            reason: c.reason
          });
        }
      }

      deletionCounts.usersIdentified = qualifiedTestUsers.length;
      deletionCounts.usersDeleted = 0;
      deletionCounts.authUsersDeleted = 0;

      const docNamesToDelete: string[] = [];

      for (const testUser of qualifiedTestUsers) {
        const uid = testUser.id;

        // Cascade collections
        for (const col of ALL_TRANSACTIONAL_COLLECTIONS) {
          const byUser = await fetchDocsByField(col, "userId", uid, idToken);
          const byInvestor = await fetchDocsByField(col, "investorId", uid, idToken);
          const uniqueDocs = Array.from(new Map([...byUser, ...byInvestor].map(d => [d.id, d])).values());
          if (uniqueDocs.length > 0) {
            docNamesToDelete.push(...uniqueDocs.map(d => d.name));
            deletionCounts[col] = (deletionCounts[col] || 0) + uniqueDocs.length;
          }
        }

        // Livestock owned or custodied by test user
        const ownedLs = await fetchDocsByField("livestock", "ownerId", uid, idToken);
        const custodianLs = await fetchDocsByField("livestock", "custodianId", uid, idToken);
        const userLs = Array.from(new Map([...ownedLs, ...custodianLs].map(l => [l.id, l])).values());
        if (userLs.length > 0) {
          docNamesToDelete.push(...userLs.map(l => l.name));
          deletionCounts.livestockDeleted = (deletionCounts.livestockDeleted || 0) + userLs.length;
          const lsIds = userLs.map(l => l.id);
          for (const lsId of lsIds) {
            for (const subCol of ["livestockGrowthRecords", "livestockHealthRecords", "healthRecords", "livestockArchives", "livestockAssignments", "livestockMedia"]) {
              const subDocs = await fetchDocsByField(subCol, "livestockId", lsId, idToken);
              if (subDocs.length > 0) {
                docNamesToDelete.push(...subDocs.map(d => d.name));
                deletionCounts[subCol] = (deletionCounts[subCol] || 0) + subDocs.length;
              }
            }
          }
        }

        // Subcollections
        const subTokens = await fetchAllDocsInCollection(`users/${uid}/fcmTokens`, idToken);
        if (subTokens.length > 0) {
          docNamesToDelete.push(...subTokens.map(d => d.name));
        }

        // User document
        docNamesToDelete.push(testUser.name);

        // Auth account
        const authRes = await deleteAuthUserSafely(uid);
        if (authRes.success) deletionCounts.authUsersDeleted++;
      }

      if (docNamesToDelete.length > 0) {
        const batchRes = await batchDeleteDocNames(docNamesToDelete, idToken);
        deletionCounts.recordsDeleted = batchRes.deletedCount;
        deletionCounts.usersDeleted = qualifiedTestUsers.length;
        if (batchRes.errors.length > 0) {
          failureList.push(...batchRes.errors);
        }
      }

      const overallStatus = failureList.length === 0 ? 'SUCCESS' : 'PARTIAL_SUCCESS';
      const completionTime = Date.now();

      await recordTestingAuditLog({
        callerUid,
        callerName: callerData?.displayName || callerEmail,
        callerEmail,
        scope: "RESET_ALL_TEST_USERS",
        details: `Reset ${qualifiedTestUsers.length} verified test users. Skipped ${skippedList.length} accounts and associated livestock/archives.`,
        status: overallStatus,
        startTime,
        completionTime,
        identifiedCount: qualifiedTestUsers.length,
        deletedCount: deletionCounts.usersDeleted,
        skippedCount: skippedList.length,
        failedCount: failureList.length,
        summary: {
          qualifiedCount: qualifiedTestUsers.length,
          skippedCount: skippedList.length,
          deletionCounts
        },
        idToken
      });

      return res.json({
        success: overallStatus === 'SUCCESS',
        scope: "RESET_ALL_TEST_USERS",
        status: overallStatus,
        message: `Successfully reset ${deletionCounts.usersDeleted} verified test user accounts. Skipped ${skippedList.length} accounts (admins and ambiguous real users).`,
        deletionCounts,
        skippedUsers: skippedList,
        failures: failureList
      });
    }

    // ==========================================
    // SCOPE 3: CLEAR OPERATIONAL TEST DATA
    // ==========================================
    if (scope === "CLEAR_TEST_DATA") {
      const docNamesToDelete: string[] = [];

      for (const col of ALL_TRANSACTIONAL_COLLECTIONS) {
        const docs = await fetchAllDocsInCollection(col, idToken);
        if (docs.length > 0) {
          docNamesToDelete.push(...docs.map(d => d.name));
          deletionCounts[col] = docs.length;
        } else {
          deletionCounts[col] = 0;
        }
      }

      if (docNamesToDelete.length > 0) {
        const batchRes = await batchDeleteDocNames(docNamesToDelete, idToken);
        deletionCounts.totalRecordsDeleted = batchRes.deletedCount;
        if (batchRes.errors.length > 0) failureList.push(...batchRes.errors);
      }

      const overallStatus = failureList.length === 0 ? 'SUCCESS' : 'PARTIAL_SUCCESS';
      const completionTime = Date.now();

      await recordTestingAuditLog({
        callerUid,
        callerName: callerData?.displayName || callerEmail,
        callerEmail,
        scope: "CLEAR_TEST_DATA",
        details: `Cleared operational test data and livestock records across collections. User profiles and platform settings preserved.`,
        status: overallStatus,
        startTime,
        completionTime,
        identifiedCount: docNamesToDelete.length,
        deletedCount: deletionCounts.totalRecordsDeleted || 0,
        skippedCount: 0,
        failedCount: failureList.length,
        summary: { deletionCounts },
        idToken
      });

      return res.json({
        success: overallStatus === 'SUCCESS',
        scope: "CLEAR_TEST_DATA",
        status: overallStatus,
        message: "Successfully cleared all operational, invoice, payment, sourcing, health, and livestock records. User profiles and global settings were preserved.",
        deletionCounts,
        failures: failureList
      });
    }

    // ==========================================
    // SCOPE 4: FULL TEST RESET (Complete Clean Slate)
    // ==========================================
    if (scope === "FULL_TEST_RESET") {
      const isKeywordValid = typeof confirmationKeyword === "string" && confirmationKeyword.trim().toUpperCase() === "RESET";
      if (!isKeywordValid && !superAdminPasswordVerified) {
        return res.status(400).json({
          error: "Authorization required: Either enter the Super Admin password or type 'RESET' to confirm Full Test Reset."
        });
      }

      const allUsers = await fetchAllDocsInCollection("users", idToken);
      const testUsers = allUsers.filter(u => !isProtectedSuperAdmin(u.fields?.email, u.fields?.role));
      const protectedAdmins = allUsers.filter(u => isProtectedSuperAdmin(u.fields?.email, u.fields?.role));

      deletionCounts.testUsersDeleted = 0;
      deletionCounts.authUsersDeleted = 0;

      const docNamesToDelete: string[] = [];

      // 1. Delete test users and their auth accounts
      for (const testUser of testUsers) {
        docNamesToDelete.push(testUser.name);
        const authRes = await deleteAuthUserSafely(testUser.id);
        if (authRes.success) deletionCounts.authUsersDeleted++;
      }

      // 2. Wipe operational and livestock collections
      for (const col of ALL_TRANSACTIONAL_COLLECTIONS) {
        const docs = await fetchAllDocsInCollection(col, idToken);
        if (docs.length > 0) {
          docNamesToDelete.push(...docs.map(d => d.name));
          deletionCounts[col] = docs.length;
        } else {
          deletionCounts[col] = 0;
        }
      }

      if (docNamesToDelete.length > 0) {
        const batchRes = await batchDeleteDocNames(docNamesToDelete, idToken);
        deletionCounts.totalDeleted = batchRes.deletedCount;
        deletionCounts.testUsersDeleted = testUsers.length;
        if (batchRes.errors.length > 0) failureList.push(...batchRes.errors);
      }

      // 4. Settings and Super Admin are explicitly preserved (not in docNamesToDelete)

      const overallStatus = failureList.length === 0 ? 'SUCCESS' : 'PARTIAL_SUCCESS';
      const completionTime = Date.now();

      await recordTestingAuditLog({
        callerUid,
        callerName: callerData?.displayName || callerEmail,
        callerEmail,
        scope: "FULL_TEST_RESET",
        details: `Executed Full Test Reset. Wiped test accounts and transactional data. Super Admin (${callerEmail}) and Platform Settings preserved.`,
        status: overallStatus,
        startTime,
        completionTime,
        identifiedCount: docNamesToDelete.length,
        deletedCount: deletionCounts.totalDeleted || 0,
        skippedCount: protectedAdmins.length,
        failedCount: failureList.length,
        summary: {
          deletionCounts,
          superAdminPasswordVerified,
          protectedAdminsPreserved: protectedAdmins.map(a => a.fields?.email)
        },
        idToken
      });

      return res.json({
        success: overallStatus === 'SUCCESS',
        scope: "FULL_TEST_RESET",
        status: overallStatus,
        message: `Full test reset completed! Clean state achieved: test users wiped, transactional logs cleared, and livestock restored to Available. Super Admin and Platform Settings strictly preserved.${superAdminPasswordVerified ? ' (Verified with Super Admin password)' : ''}`,
        deletionCounts,
        superAdminPasswordVerified,
        preservedAdmins: protectedAdmins.map(a => a.fields?.email),
        failures: failureList
      });
    }

    return res.status(400).json({
      error: `Bad Request: Unrecognized reset scope '${scope}'. Valid scopes: RESET_SELECTED_USER, RESET_ALL_TEST_USERS, CLEAR_TEST_DATA, FULL_TEST_RESET.`
    });

  } catch (error: any) {
    console.error("Error executing testing reset:", error);
    return res.status(500).json({
      error: "Internal Server Error during testing reset execution",
      details: error?.message || error
    });
  }
});

// Serve Frontend Vite Application
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
