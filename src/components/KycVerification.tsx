import React, { useState } from 'react';
import {
  ShieldCheck,
  Upload,
  FileText,
  MapPin,
  User,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { auth, db, logActivity, notifyAdmins } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { VerificationStatus, UserProfile } from '../types';
import { Card, Button, Input, Badge } from './UI';
import { LoadingButton } from './LoadingButton';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface KycVerificationProps {
  userProfile: UserProfile;
  onVerificationSubmitted?: () => void;
}

/**
 * Cloudflare Worker responsible for securely signing Cloudinary uploads.
 *
 * IMPORTANT:
 * - Do not put the Cloudinary API secret in this React application.
 * - The API secret remains inside Cloudflare Worker secrets.
 */
const CLOUDINARY_SIGNING_URL =
  'https://cowplugng-cloudinary-sign.tugbobodare4.workers.dev';

const CLOUDINARY_UPLOAD_PRESET = 'cowplugng_documents';

interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

/**
 * Upload a document to Cloudinary using a signature generated
 * by our Cloudflare Worker.
 */
async function uploadToCloudinary(
  file: File,
  userId: string,
  side: 'front' | 'back'
): Promise<CloudinaryUploadResult> {
  const signingResponse = await fetch(CLOUDINARY_SIGNING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      side,
    }),
  });

  if (!signingResponse.ok) {
    let message = 'Unable to connect to the secure upload service.';

    try {
      const errorData = await signingResponse.json();
      if (errorData?.error) {
        message = errorData.error;
      }
    } catch {
      // Keep default error message.
    }

    throw new Error(message);
  }

  const signingData = await signingResponse.json();

  if (
    !signingData.signature ||
    !signingData.timestamp ||
    !signingData.apiKey ||
    !signingData.cloudName
  ) {
    throw new Error('The secure upload service returned an invalid response.');
  }

  const uploadData = new FormData();

  uploadData.append('file', file);
  uploadData.append('api_key', signingData.apiKey);
  uploadData.append('timestamp', String(signingData.timestamp));
  uploadData.append('signature', signingData.signature);
  uploadData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${signingData.cloudName}/image/upload`,
    {
      method: 'POST',
      body: uploadData,
    }
  );

  let result: any = {};

  try {
    result = await uploadResponse.json();
  } catch {
    throw new Error('Cloudinary returned an invalid response.');
  }

  if (!uploadResponse.ok) {
    throw new Error(
      result?.error?.message || 'Cloudinary document upload failed.'
    );
  }

  if (!result.secure_url || !result.public_id) {
    throw new Error('Cloudinary upload completed without a valid file reference.');
  }

  console.log(`${side} NIN document uploaded successfully.`);

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

export const KycVerification: React.FC<KycVerificationProps> = ({
  userProfile,
  onVerificationSubmitted,
}) => {
  const [formData, setFormData] = useState({
    verifiedName: userProfile.verifiedName || '',
    ninNumber: '',
    ninLocation: userProfile.ninLocation || '',
  });

  const [files, setFiles] = useState<{
    front: File | null;
    back: File | null;
  }>({
    front: null,
    back: null,
  });

  const [previews, setPreviews] = useState<{
    front: string | null;
    back: string | null;
  }>({
    front: null,
    back: null,
  });

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionDate, setSubmissionDate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (
    side: 'front' | 'back',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds the 5MB limit.');
      return;
    }

    setFiles((prev) => ({
      ...prev,
      [side]: file,
    }));

    const reader = new FileReader();

    reader.onloadend = () => {
      setPreviews((prev) => ({
        ...prev,
        [side]: reader.result as string,
      }));
    };

    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !files.front ||
      !files.back ||
      !formData.ninNumber ||
      !formData.verifiedName ||
      !formData.ninLocation
    ) {
      setError('Please provide all required information and documents.');
      return;
    }

    if (formData.ninNumber.length !== 11) {
      setError('NIN number must contain exactly 11 digits.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Starting CowPlugNG KYC submission...');

      const user = auth.currentUser;

      if (!user) {
        throw new Error(
          'You must be signed in to submit your verification.'
        );
      }

      /*
       * 1. Upload NIN FRONT to Cloudinary
       */
      console.log('Uploading NIN front document...');

      const frontUpload = await uploadToCloudinary(
        files.front,
        user.uid,
        'front'
      );

      /*
       * 2. Upload NIN BACK to Cloudinary
       */
      console.log('Uploading NIN back document...');

      const backUpload = await uploadToCloudinary(
        files.back,
        user.uid,
        'back'
      );

      /*
       * 3. Update Firestore
       *
       * Firebase Auth + Firestore remain exactly as before.
       * Only the file storage provider has changed.
       */
      console.log('Updating Firestore verification record...');

      const now = Date.now();

      await updateDoc(doc(db, 'users', user.uid), {
        verifiedName: formData.verifiedName,
        ninNumber: formData.ninNumber,
        ninLocation: formData.ninLocation,

        ninFrontUrl: frontUpload.url,
        ninBackUrl: backUpload.url,

        ninFrontPublicId: frontUpload.publicId,
        ninBackPublicId: backUpload.publicId,

        verificationStatus: VerificationStatus.UNDER_REVIEW,
        verificationSubmittedAt: now,
        isVerified: false,
      });

      console.log('Firestore verification record updated.');

      setSubmissionDate(now);

      /*
       * 4. Activity logging
       *
       * These remain non-blocking so they cannot leave
       * the verification button spinning indefinitely.
       */
      logActivity(
        user.uid,
        userProfile.displayName || user.email || 'User',
        'KYC_SUBMITTED',
        'AUTH',
        user.uid,
        'User submitted identity verification documents for review.'
      ).catch((activityError) => {
        console.warn('Activity log failed:', activityError);
      });

      /*
       * 5. Admin notification
       *
       * Also non-blocking.
       */
      notifyAdmins(
        'New Identity Verification',
        `${userProfile.displayName || user.email} has submitted identity verification for review.`,
        'KYC Requests',
        'INFO',
        '/admin/kyc',
        'Review Now'
      ).catch((notificationError) => {
        console.warn('Admin notification failed:', notificationError);
      });

      /*
       * 6. SUCCESS
       */
      console.log('KYC submission completed successfully.');

      setIsSubmitted(true);

      if (onVerificationSubmitted) {
        onVerificationSubmitted();
      }
    } catch (err: any) {
      console.error('KYC Submission Error:', err);

      setError(
        err?.message ||
          'We could not complete your verification. Please check your connection and try again.'
      );
    } finally {
      /*
       * CRITICAL:
       * This guarantees the loading spinner stops,
       * whether submission succeeds or fails.
       */
      setLoading(false);
    }
  };

  /*
   * SUCCESS / UNDER REVIEW SCREEN
   */
  if (
    isSubmitted ||
    userProfile.verificationStatus === VerificationStatus.SUBMITTED ||
    userProfile.verificationStatus === VerificationStatus.UNDER_REVIEW
  ) {
    const displayDate =
      submissionDate ||
      userProfile.verificationSubmittedAt ||
      Date.now();

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className="p-8 text-center space-y-6 shadow-2xl border-slate-200">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900">
                Verification Submitted
              </h2>

              <p className="text-slate-500 text-sm leading-relaxed px-4">
                Your identity information has been submitted successfully.
                Our team will review your information before your account is
                activated.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl text-left space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400">
                  Status
                </span>

                <Badge
                  variant="info"
                  className="bg-amber-100 text-amber-800 border-amber-200"
                >
                  Under Review
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400">
                  Submitted
                </span>

                <span className="text-xs font-bold text-slate-700">
                  {new Date(displayDate).toLocaleString()}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex gap-3">
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />

                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                  Your verification is now with our team for review. You'll be
                  notified when your account status changes.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full h-12 border-slate-200 text-slate-600 font-black uppercase tracking-widest text-[10px]"
              onClick={() => auth.signOut()}
            >
              Sign Out Securely
            </Button>
          </Card>
        </motion.div>
      </div>
    );
  }

  /*
   * VERIFICATION FORM
   */
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full"
      >
        <div className="text-center mb-8 space-y-2">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3">
            <ShieldCheck className="w-8 h-8 text-emerald-600" />
          </div>

          <h1 className="text-3xl font-black text-slate-900">
            Verify Your Identity
          </h1>

          <p className="text-slate-500 max-w-sm mx-auto text-sm">
            Before you can use CowPlugNG, we need to verify your identity.
            Please provide the information exactly as it appears on your NIN.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="p-6 sm:p-8 space-y-8 shadow-xl border-slate-200">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {userProfile.verificationStatus ===
              VerificationStatus.REJECTED &&
              userProfile.rejectionReason && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Verification Rejected
                  </div>

                  <p className="text-xs text-amber-800 italic">
                    Reason: {userProfile.rejectionReason}
                  </p>

                  <p className="text-[10px] text-amber-700">
                    Please review the requested changes and resubmit your
                    details.
                  </p>
                </div>
              )}

            <div className="space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <User className="w-4 h-4" />
                Personal Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">
                    Full Name (as on NIN)
                  </label>

                  <Input
                    placeholder="Enter your full legal name"
                    value={formData.verifiedName}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        verifiedName: e.target.value,
                      }))
                    }
                    className="h-11"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">
                    NIN Number
                  </label>

                  <Input
                    placeholder="11-digit NIN Number"
                    value={formData.ninNumber}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        ninNumber: e.target.value
                          .replace(/\D/g, '')
                          .slice(0, 11),
                      }))
                    }
                    className="h-11"
                    inputMode="numeric"
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold text-slate-700">
                    Location (as on NIN)
                  </label>

                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

                    <Input
                      placeholder="e.g., Lagos, Nigeria"
                      value={formData.ninLocation}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          ninLocation: e.target.value,
                        }))
                      }
                      className="h-11 pl-10"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                NIN Documents
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* FRONT */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-700">
                    NIN Front View
                  </p>

                  <div
                    className={cn(
                      'relative border-2 border-dashed rounded-2xl transition-all h-40 overflow-hidden flex flex-col items-center justify-center gap-2 group',
                      previews.front
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/50'
                    )}
                  >
                    {previews.front ? (
                      <div className="relative w-full h-full group">
                        <img
                          src={previews.front}
                          alt="Front preview"
                          className="w-full h-full object-cover"
                        />

                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-white border-white hover:bg-white/20"
                            onClick={() =>
                              setPreviews((prev) => ({
                                ...prev,
                                front: null,
                              }))
                            }
                          >
                            Replace
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors">
                          <Upload className="w-5 h-5" />
                        </div>

                        <p className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-600">
                          Click to upload Front
                        </p>

                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) =>
                            handleFileChange('front', e)
                          }
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* BACK */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-700">
                    NIN Back View
                  </p>

                  <div
                    className={cn(
                      'relative border-2 border-dashed rounded-2xl transition-all h-40 overflow-hidden flex flex-col items-center justify-center gap-2 group',
                      previews.back
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/50'
                    )}
                  >
                    {previews.back ? (
                      <div className="relative w-full h-full group">
                        <img
                          src={previews.back}
                          alt="Back preview"
                          className="w-full h-full object-cover"
                        />

                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-white border-white hover:bg-white/20"
                            onClick={() =>
                              setPreviews((prev) => ({
                                ...prev,
                                back: null,
                              }))
                            }
                          >
                            Replace
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors">
                          <Upload className="w-5 h-5" />
                        </div>

                        <p className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-600">
                          Click to upload Back
                        </p>

                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) =>
                            handleFileChange('back', e)
                          }
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-col gap-4">
              <LoadingButton
                type="submit"
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-lg shadow-emerald-600/20"
                isLoading={loading}
                loadingText="Submitting Verification..."
              >
                Submit Verification
              </LoadingButton>

              <Button
                type="button"
                variant="ghost"
                className="text-slate-400 hover:text-slate-600 text-xs"
                onClick={() => auth.signOut()}
                disabled={loading}
              >
                Sign Out & Cancel
              </Button>
            </div>
          </Card>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-widest font-black">
            Securely processed by CowPlugNG Security
          </p>
        </div>
      </motion.div>
    </div>
  );
};