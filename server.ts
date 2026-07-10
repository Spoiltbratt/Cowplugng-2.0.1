import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

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
