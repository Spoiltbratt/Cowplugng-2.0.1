import { db, sendNotification } from './firebase';
import { 
  collection, query, where, getDocs, doc, updateDoc, 
  addDoc, deleteDoc, writeBatch, orderBy, limit, getDoc, setDoc 
} from 'firebase/firestore';
import { Livestock } from '../types';

export const HEALTH_COLLECTION = 'livestockHealthRecords';

export function normalizeHealthRecord(docId: string, data: any) {
  return {
    examinations: [], medications: [], vaccinations: [],
    medicalDocuments: [], medicalExpenses: [], timeline: [], growthRecords: [],
    ...data,
    id: docId, // LAST, so the real doc ID always wins
  };
}


// saveHealthRecord already defined below (line 87)


export async function ensureHealthRecord(livestockId: string, animal: any) {
  const ref = doc(db, HEALTH_COLLECTION, livestockId);
  const snap = await getDoc(ref);
  if (snap.exists()) return normalizeHealthRecord(snap.id, snap.data());
  const base = normalizeHealthRecord(livestockId, {
    livestockId, tagNumber: animal?.tagNumber || '',
    healthStatus: animal?.healthStatus || 'GOOD', createdAt: Date.now(),
    timeline: [{ id: `tl_${Date.now()}`, date: Date.now(), title: 'Health record created', type: 'system' }],
  });
  await saveHealthRecord(livestockId, base);
  return base;
}

export interface RecordWeightParams {
  livestockId: string;
  tagNumber: string;
  weightKg: number;
  measurementDate?: number;
  observations?: string;
  feedingNotes?: string;
  media?: Array<{
    url: string;
    publicId?: string;
    type: 'image' | 'video';
    caption?: string;
  }>;
  status?: 'draft' | 'published';
  authorId: string;
  authorName: string;
  isCorrection?: boolean;
  correctionReason?: string;
  targetRecordId?: string; // If correcting a specific historical measurement
}

/**
 * Strips undefined properties recursively to prevent Firestore write rejections.
 */
export function removeUndefinedFields<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedFields) as any;
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefinedFields(value);
      }
    }
    return cleaned;
  }
  return obj;
}

/**
 * Canonical authoritative save function for livestockHealthRecords.
 * Enforces:
 * 1. Document ID is strictly livestockId.
 * 2. 'id' property is stripped from stored document.
 * 3. All undefined properties are stripped.
 * 4. Safe merging with existing health record documents.
 */
export async function saveHealthRecord(
  livestockId: string,
  dataToSave: any,
  options?: {
    notifyOwner?: boolean;
    notifyTitle?: string;
    notifyMsg?: string;
    ownerId?: string;
  }
): Promise<void> {
  const { id: _, ...cleanData } = dataToSave;
  cleanData.livestockId = livestockId;
  cleanData.updatedAt = cleanData.updatedAt || Date.now();

  const payload = removeUndefinedFields(cleanData);
  const healthDocRef = doc(db, 'livestockHealthRecords', livestockId);
  await setDoc(healthDocRef, payload, { merge: true });

  if (options?.notifyOwner && options.ownerId && options.notifyMsg) {
    await sendNotification(
      options.ownerId,
      options.notifyTitle || 'Health Record Update',
      options.notifyMsg,
      'Investment Updates'
    );
  }
}

/**
 * Re-computes and sets livestock.weight strictly to the growth record with the latest measurementDate
 */
export async function syncLivestockWeightFromLatestGrowth(livestockId: string): Promise<number> {
  const allGrowthQ = query(
    collection(db, 'livestockGrowthRecords'),
    where('livestockId', '==', livestockId)
  );
  const snap = await getDocs(allGrowthQ);
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  
  // Sort: newest date first, then newest createdAt
  all.sort((a, b) => {
    const dateDiff = (b.measurementDate || 0) - (a.measurementDate || 0);
    if (dateDiff !== 0) return dateDiff;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  
  if (all.length === 0) return 0; // Return 0 or handle as needed to indicate no weight

  const latestWeight = all[0].weightKg;
  const latestDate = all[0].measurementDate;
  
  await updateDoc(doc(db, 'livestock', livestockId), {
    weight: `${latestWeight}kg`,
    lastWeightMeasurementDate: latestDate,
    lastUpdated: Date.now()
  });
  return latestWeight;
}

/**
 * Authoritative Synchronizer for Livestock Weight & Health Records.
 *
 * Ensures:
 * 1. Health Records & Growth Records are the authoritative source of truth.
 * 2. Any new weight measurement or correction updates:
 *    - `livestockGrowthRecords` (historical entry or correction)
 *    - `livestock` primary document (`weight: "${weightKg}kg"`, `lastUpdated`)
 *    - `livestockHealthRecords` timeline event
 * 3. Atomic batch or dual-safe writes ensure consistent state across all collections.
 * 4. Automatic gain calculation is based purely on the target animal's previous valid measurement.
 */
export async function recordAuthoritativeWeight(params: RecordWeightParams): Promise<{
  growthRecordId: string;
  weightGain: number;
  previousWeightKg: number;
}> {
  const {
    livestockId,
    tagNumber,
    weightKg,
    measurementDate = Date.now(),
    observations = 'Standard optimal body condition',
    feedingNotes = 'Standard ration formulated for growth phase.',
    media = [],
    status = 'published',
    authorId,
    authorName,
    isCorrection = false,
    correctionReason,
    targetRecordId
  } = params;

  if (typeof weightKg !== 'number' || isNaN(weightKg) || weightKg <= 0) {
    throw new Error('Weight must be a valid positive number in kilograms.');
  }

  // 1. Fetch previous historical measurements for this specific animal to get authoritative previous weight
  const growthQ = query(
    collection(db, 'livestockGrowthRecords'),
    where('livestockId', '==', livestockId)
  );
  const growthSnap = await getDocs(growthQ);
  const allGrowth = growthSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  
  // Sort: newest date first, then newest createdAt
  allGrowth.sort((a, b) => {
    const dateDiff = (b.measurementDate || 0) - (a.measurementDate || 0);
    if (dateDiff !== 0) return dateDiff;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  let previousWeightKg = 0;
  if (isCorrection && targetRecordId) {
    // If correcting an existing record, the previous weight is the one recorded before targetRecord
    const targetIdx = allGrowth.findIndex(r => r.id === targetRecordId);
    if (targetIdx !== -1 && allGrowth[targetIdx + 1]) {
      previousWeightKg = allGrowth[targetIdx + 1].weightKg || 0;
    } else {
      previousWeightKg = allGrowth[0]?.weightKg || weightKg;
    }
  } else {
    // Normal new measurement: previous weight is the latest existing record's weight
    if (allGrowth.length > 0) {
      previousWeightKg = Number(allGrowth[0].weightKg) || 0;
    }
  }

  const weightGain = previousWeightKg > 0 ? (weightKg - previousWeightKg) : 0;
  const now = Date.now();
  
  // Ensure measurementDate for today stores as now()
  const finalMeasurementDate = new Date(measurementDate).toDateString() === new Date().toDateString() 
    ? now 
    : measurementDate;

  let growthRecordId = targetRecordId || '';

  // 2. Write or Update livestockGrowthRecords
  if (isCorrection && targetRecordId) {
    const targetRef = doc(db, 'livestockGrowthRecords', targetRecordId);
    await updateDoc(targetRef, {
      weightKg,
      previousWeightKg,
      weightGain,
      measurementDate: finalMeasurementDate,
      bodyCondition: observations,
      feedingNotes,
      media,
      isCorrected: true,
      correctionReason: correctionReason || 'Administrative correction',
      correctedBy: authorName,
      correctedAt: now,
      updatedAt: now
    });
  } else {
    const newRecordPayload = {
      livestockId,
      tagNumber,
      measurementDate: finalMeasurementDate,
      weightKg,
      previousWeightKg,
      weightGain,
      bodyCondition: observations,
      feedingNotes,
      media,
      status,
      publishedAt: status === 'published' ? now : null,
      authorId,
      authorName,
      createdAt: now,
      updatedAt: now
    };
    const addedDoc = await addDoc(collection(db, 'livestockGrowthRecords'), newRecordPayload);
    growthRecordId = addedDoc.id;
  }

  // 3. Update the master livestock document to match the growth record with the LATEST measurementDate
  const allGrowthQ = query(
    collection(db, 'livestockGrowthRecords'),
    where('livestockId', '==', livestockId)
  );
  const allGrowthSnap = await getDocs(allGrowthQ);
  const allGrowthList = allGrowthSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  
  // Re-sort to get truly latest
  allGrowthList.sort((a, b) => {
    const dateDiff = (b.measurementDate || 0) - (a.measurementDate || 0);
    if (dateDiff !== 0) return dateDiff;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  const latestRecord = allGrowthList[0];
  const authoritativeLatestWeightKg = latestRecord?.weightKg ?? weightKg;
  const authoritativeLatestMeasurementDate = latestRecord?.measurementDate ?? finalMeasurementDate;
  const formattedWeightString = `${authoritativeLatestWeightKg}kg`;

  const livestockRef = doc(db, 'livestock', livestockId);
  await updateDoc(livestockRef, {
    weight: formattedWeightString,
    lastWeightMeasurementDate: authoritativeLatestMeasurementDate,
    lastUpdated: now
  });

  // 4. Update the Health Record system growthRecords array, timeline & synchronization using deterministic document ID
  const healthDocRef = doc(db, 'livestockHealthRecords', livestockId);
  const healthDocSnap = await getDoc(healthDocRef);

  const growthEntryForHealth = {
    id: growthRecordId,
    measurementDate: finalMeasurementDate,
    weightKg,
    previousWeightKg,
    weightGain,
    bodyCondition: observations,
    feedingNotes,
    media,
    status,
    authorId,
    authorName,
    createdAt: now,
    updatedAt: now
  };

  const timelineEntry = {
    id: `growth_${now}`,
    date: measurementDate,
    title: isCorrection 
      ? `Weight Corrected: ${weightKg} kg` 
      : `Weight Recorded: ${weightKg} kg (${weightGain >= 0 ? '+' : ''}${weightGain} kg)`,
    type: 'update',
    description: isCorrection 
      ? `Correction note: ${correctionReason || 'Revised by administration'}.` 
      : `Condition: ${observations}. Notes: ${feedingNotes}.`,
    author: authorName
  };

  let currentTimeline: any[] = [];
  let currentGrowthRecords: any[] = [];
  let existingHealthData: any = {};

  if (healthDocSnap.exists()) {
    existingHealthData = healthDocSnap.data();
    currentTimeline = Array.isArray(existingHealthData.timeline) ? existingHealthData.timeline : [];
    currentGrowthRecords = Array.isArray(existingHealthData.growthRecords) ? existingHealthData.growthRecords : [];
  } else {
    // Check query fallback if legacy doc exists with random ID
    const healthQ = query(
      collection(db, 'livestockHealthRecords'),
      where('livestockId', '==', livestockId)
    );
    const healthSnap = await getDocs(healthQ);
    if (!healthSnap.empty) {
      const hData = healthSnap.docs[0].data();
      currentTimeline = Array.isArray(hData.timeline) ? hData.timeline : [];
      currentGrowthRecords = Array.isArray(hData.growthRecords) ? hData.growthRecords : [];
      existingHealthData = hData;
    }
  }

  const updatedGrowthRecords = isCorrection && targetRecordId
    ? currentGrowthRecords.map((r: any) => r.id === targetRecordId ? growthEntryForHealth : r)
    : [growthEntryForHealth, ...currentGrowthRecords.filter((r: any) => r.id !== growthRecordId)];

  const { id: _, ...cleanExistingHealthData } = existingHealthData;

  const payloadToSave = removeUndefinedFields({
    ...cleanExistingHealthData,
    livestockId,
    tagNumber,
    healthStatus: existingHealthData.healthStatus || 'GOOD',
    examinations: cleanExistingHealthData.examinations || [],
    medications: cleanExistingHealthData.medications || [],
    vaccinations: cleanExistingHealthData.vaccinations || [],
    medicalDocuments: cleanExistingHealthData.medicalDocuments || [],
    medicalExpenses: cleanExistingHealthData.medicalExpenses || [],
    growthRecords: updatedGrowthRecords,
    timeline: [timelineEntry, ...currentTimeline],
    updatedAt: now
  });

  await saveHealthRecord(livestockId, payloadToSave);

  return {
    growthRecordId,
    weightGain,
    previousWeightKg
  };
}

/**
 * Synchronize Health Status across Health Records & Master Livestock document
 */
export async function syncHealthStatus(
  livestockId: string, 
  healthStatus: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR',
  authorName: string,
  clinicalNotes?: string,
  tagNumber?: string
): Promise<void> {
  const now = Date.now();

  // 1. Update Master Livestock document
  await updateDoc(doc(db, 'livestock', livestockId), {
    healthStatus,
    lastUpdated: now
  });

  // 2. Ensure health record & update
  const record = await ensureHealthRecord(livestockId, { tagNumber });
  
  const timelineEntry = {
    id: `health_${now}`,
    date: now,
    title: `Health Status Audit: ${healthStatus}`,
    type: 'update',
    description: clinicalNotes || `Health rating confirmed as ${healthStatus}.`,
    author: authorName
  };

  record.timeline.unshift(timelineEntry);
  record.healthStatus = healthStatus;

  await saveHealthRecord(livestockId, record);
}

export async function logLivestockTimelineEvent(
  livestockId: string,
  tagNumber: string,
  title: string,
  description: string,
  authorName: string
): Promise<void> {
  const now = Date.now();
  const healthDocRef = doc(db, 'livestockHealthRecords', livestockId);
  const healthDocSnap = await getDoc(healthDocRef);

  let existingData: any = {};
  if (healthDocSnap.exists()) {
    existingData = healthDocSnap.data();
  } else {
    const q = query(collection(db, 'livestockHealthRecords'), where('livestockId', '==', livestockId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      existingData = snap.docs[0].data();
    }
  }

  const { id: _, ...cleanExisting } = existingData;
  const currentTimeline = Array.isArray(cleanExisting.timeline) ? cleanExisting.timeline : [];

  const timelineEntry = {
    id: `audit_${now}_${Math.random().toString(36).substring(2, 7)}`,
    date: now,
    title,
    type: 'update',
    description,
    author: authorName
  };

  const payloadToSave = removeUndefinedFields({
    ...cleanExisting,
    livestockId,
    tagNumber: tagNumber || cleanExisting.tagNumber || '',
    healthStatus: cleanExisting.healthStatus || 'GOOD',
    examinations: cleanExisting.examinations || [],
    medications: cleanExisting.medications || [],
    vaccinations: cleanExisting.vaccinations || [],
    medicalDocuments: cleanExisting.medicalDocuments || [],
    medicalExpenses: cleanExisting.medicalExpenses || [],
    growthRecords: cleanExisting.growthRecords || [],
    timeline: [timelineEntry, ...currentTimeline],
    updatedAt: now
  });

  await saveHealthRecord(livestockId, payloadToSave);
}
export async function repairHealthRecords(): Promise<{
  created: number;
  merged: number;
  duplicatesDeleted: number;
  idFieldsCleaned: number;
  skipped: number;
  errors: Array<{ id: string; code: string; message: string }>;
}> {
  let created = 0;
  let merged = 0;
  let duplicatesDeleted = 0;
  let idFieldsCleaned = 0;
  let skipped = 0;
  const errors: Array<{ id: string; code: string; message: string }> = [];

  try {
    const allLivestockSnap = await getDocs(collection(db, 'livestock'));
    const allHealthSnap = await getDocs(collection(db, 'livestockHealthRecords'));
    const allHealthDocs = allHealthSnap.docs.map(d => ({ id: d.id, data: d.data() }));

    for (const lDoc of allLivestockSnap.docs) {
      const livestockId = lDoc.id;
      const livestockData = lDoc.data() as any;
      try {
        const primaryRef = doc(db, 'livestockHealthRecords', livestockId);
        const primarySnap = await getDoc(primaryRef);

        let primaryData: any = {};
        if (!primarySnap.exists()) {
          primaryData = {
            livestockId,
            tagNumber: livestockData.tagNumber || '',
            healthStatus: livestockData.healthStatus || 'GOOD',
            examinations: [],
            medications: [],
            vaccinations: [],
            medicalDocuments: [],
            medicalExpenses: [],
            timeline: [{ id: `tl_${Date.now()}`, date: Date.now(), title: 'Health record created via repair', type: 'system' }],
            growthRecords: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          await setDoc(primaryRef, removeUndefinedFields(primaryData));
          created++;
        } else {
          primaryData = primarySnap.data();
        }

        const strayDocs = allHealthDocs.filter(h => h.id !== livestockId && (h.data.livestockId === livestockId || h.id === livestockId));

        if (strayDocs.length > 0) {
          const mergeArrays = (key: string) => {
            const combined = [...(primaryData[key] || []), ...strayDocs.flatMap(s => s.data[key] || [])];
            return Array.from(new Map(combined.map((item: any) => [item.id || JSON.stringify(item), item])).values());
          };

          primaryData.examinations = mergeArrays('examinations');
          primaryData.medications = mergeArrays('medications');
          primaryData.vaccinations = mergeArrays('vaccinations');
          primaryData.medicalDocuments = mergeArrays('medicalDocuments');
          primaryData.medicalExpenses = mergeArrays('medicalExpenses');
          primaryData.timeline = mergeArrays('timeline');
          primaryData.growthRecords = mergeArrays('growthRecords');

          merged++;

          for (const stray of strayDocs) {
            try {
              await deleteDoc(doc(db, 'livestockHealthRecords', stray.id));
              duplicatesDeleted++;
            } catch (err: any) {
              errors.push({ id: stray.id, code: err.code || 'delete_error', message: err.message });
              skipped++;
            }
          }
        }

        if ('id' in primaryData) {
          delete primaryData.id;
          idFieldsCleaned++;
        }

        primaryData.updatedAt = Date.now();
        await setDoc(primaryRef, removeUndefinedFields(primaryData), { merge: true });

      } catch (err: any) {
        errors.push({ id: livestockId, code: err.code || 'repair_error', message: err.message });
        skipped++;
      }
    }
  } catch (err: any) {
    errors.push({ id: 'global', code: err.code || 'global_error', message: err.message });
    skipped++;
  }

  return {
    created,
    merged,
    duplicatesDeleted,
    idFieldsCleaned,
    skipped,
    errors
  };
}
