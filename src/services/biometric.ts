export interface BiometricProviderStatus {
  configured: boolean;
  providerName: string;
  endpointConfigured: boolean;
  apiKeyConfigured: boolean;
  requiredEnvVars: string[];
  supportedProviders: string[];
  diagnosticMessage: string;
}

export interface BiometricVerificationInput {
  studentId: number;
  usn: string;
  sessionId: number;
  imageBase64: string;
  livenessFramesCount: number;
  autoApproveThreshold: number;
  manualReviewThreshold: number;
}

export interface BiometricVerificationResult {
  configured: boolean;
  providerName: string;
  outcome:
    | 'verified'
    | 'uncertain_review'
    | 'rejected'
    | 'provider_unconfigured';
  confidenceScore: number | null;
  livenessPassed: boolean | null;
  livenessChecks: Record<string, unknown>;
  failureReason: string | null;
}

export function getBiometricProviderStatus(): BiometricProviderStatus {
  const providerName = process.env.BIOMETRIC_PROVIDER_NAME?.trim() || '';
  const endpoint = process.env.BIOMETRIC_PROVIDER_ENDPOINT?.trim() || '';
  const apiKey = process.env.BIOMETRIC_PROVIDER_API_KEY?.trim() || '';
  const configured = Boolean(endpoint && apiKey);

  return {
    configured,
    providerName: configured
      ? providerName || 'Configured External Biometric Provider'
      : 'Unconfigured (External Provider Required)',
    endpointConfigured: Boolean(endpoint),
    apiKeyConfigured: Boolean(apiKey),
    requiredEnvVars: [
      'BIOMETRIC_PROVIDER_NAME',
      'BIOMETRIC_PROVIDER_ENDPOINT',
      'BIOMETRIC_PROVIDER_API_KEY',
    ],
    supportedProviders: [
      'AWS Rekognition Face Liveness + CompareFaces',
      'Azure AI Face API (Liveness Detection + Verify)',
      'Custom On-Premise Institutional Face Service',
    ],
    diagnosticMessage: configured
      ? `Connected to ${providerName || 'External Biometric API'}. Live liveness and identity scoring active.`
      : 'No external biometric face recognition or anti-spoofing provider credentials are configured on the server. Live biometric attendance cannot auto-verify faces until BIOMETRIC_PROVIDER_ENDPOINT and BIOMETRIC_PROVIDER_API_KEY are set. Use Dynamic QR or Faculty Manual attendance.',
  };
}

export async function verifyFaceWithExternalProvider(
  input: BiometricVerificationInput
): Promise<BiometricVerificationResult> {
  const status = getBiometricProviderStatus();

  if (!status.configured) {
    return {
      configured: false,
      providerName: status.providerName,
      outcome: 'provider_unconfigured',
      confidenceScore: null,
      livenessPassed: null,
      livenessChecks: {
        providerConfigured: false,
        framesReceived: input.livenessFramesCount,
      },
      failureReason:
        'External biometric provider credentials (BIOMETRIC_PROVIDER_ENDPOINT, BIOMETRIC_PROVIDER_API_KEY) are not configured. Refusing to fabricate face verification.',
    };
  }

  const endpoint = process.env.BIOMETRIC_PROVIDER_ENDPOINT!.trim();
  const apiKey = process.env.BIOMETRIC_PROVIDER_API_KEY!.trim();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      studentId: input.studentId,
      usn: input.usn,
      sessionId: input.sessionId,
      imageBase64: input.imageBase64,
      livenessFramesCount: input.livenessFramesCount,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Biometric provider returned HTTP ${response.status}: ${response.statusText}`
    );
  }

  const payload = (await response.json()) as {
    confidenceScore: number;
    livenessPassed: boolean;
    livenessChecks?: Record<string, unknown>;
  };

  const score = Number(payload.confidenceScore ?? 0);
  const livenessPassed = Boolean(payload.livenessPassed);

  if (!livenessPassed) {
    return {
      configured: true,
      providerName: status.providerName,
      outcome: 'rejected',
      confidenceScore: score,
      livenessPassed: false,
      livenessChecks: payload.livenessChecks || { antiSpoofing: 'failed' },
      failureReason: 'Liveness / anti-spoofing check failed.',
    };
  }

  if (score >= input.autoApproveThreshold) {
    return {
      configured: true,
      providerName: status.providerName,
      outcome: 'verified',
      confidenceScore: score,
      livenessPassed: true,
      livenessChecks: payload.livenessChecks || { antiSpoofing: 'passed' },
      failureReason: null,
    };
  }

  if (score >= input.manualReviewThreshold) {
    return {
      configured: true,
      providerName: status.providerName,
      outcome: 'uncertain_review',
      confidenceScore: score,
      livenessPassed: true,
      livenessChecks: payload.livenessChecks || { antiSpoofing: 'passed' },
      failureReason: `Confidence score ${score.toFixed(2)} below auto-approve threshold (${input.autoApproveThreshold.toFixed(2)}); routed to faculty review.`,
    };
  }

  return {
    configured: true,
    providerName: status.providerName,
    outcome: 'rejected',
    confidenceScore: score,
    livenessPassed: true,
    livenessChecks: payload.livenessChecks || { antiSpoofing: 'passed' },
    failureReason: `Confidence score ${score.toFixed(2)} below minimum review threshold (${input.manualReviewThreshold.toFixed(2)}).`,
  };
}

export function evaluateBiometricPolicyScore(
  confidenceScore: number,
  livenessPassed: boolean,
  autoApproveThreshold: number,
  manualReviewThreshold: number
): 'verified' | 'uncertain_review' | 'rejected' {
  if (!livenessPassed) return 'rejected';
  if (confidenceScore >= autoApproveThreshold) return 'verified';
  if (confidenceScore >= manualReviewThreshold) return 'uncertain_review';
  return 'rejected';
}
