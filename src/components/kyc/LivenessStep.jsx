import React, { useState, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Camera, ArrowRight, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function LivenessStep({ onComplete, onSkip }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [stage, setStage] = useState('intro'); // intro | camera | captured | verifying | done
  const [capturedImage, setCapturedImage] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStage('camera');
    } catch (err) {
      setError('Camera access denied. Please allow camera access and try again.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    // Mirror the image (selfie mode)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
    stopCamera();
    setStage('captured');
  }, [stopCamera]);

  const retake = useCallback(() => {
    setCapturedImage(null);
    setError(null);
    startCamera();
  }, [startCamera]);

  const submitLiveness = async () => {
    if (!capturedImage) return;
    setSaving(true);
    setError(null);
    try {
      const response = await base44.functions.invoke('verifyLiveness', { photoBase64: capturedImage });
      if (!response.data.success) throw new Error(response.data.error || 'Liveness check failed');
      setStage('done');
      setTimeout(() => onComplete(), 1500);
    } catch (err) {
      setError(err.message || 'Liveness check failed. Please retake your selfie.');
      setStage('captured');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
          <Camera className="w-7 h-7 text-blue-600" />
        </div>
        <CardTitle>Liveness Check</CardTitle>
        <CardDescription>Take a selfie to verify your identity against your NIN photo</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stage === 'intro' && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-blue-900">Tips for a successful selfie:</p>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Face the camera directly</li>
                <li>Good lighting — avoid backlighting</li>
                <li>Remove glasses or hat if possible</li>
                <li>Keep a neutral expression</li>
              </ul>
            </div>
            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={startCamera}>
              <Camera className="w-4 h-4 mr-2" />
              Open Camera
            </Button>
            <Button variant="outline" className="w-full border-amber-300 text-amber-700 hover:bg-amber-50" onClick={onSkip}>
              Continue Without Liveness Check
            </Button>
          </>
        )}

        {stage === 'camera' && (
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
              {/* Oval face guide */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-44 h-56 border-4 border-white/70 rounded-full opacity-60" />
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <p className="text-center text-sm text-gray-500">Position your face in the oval and tap Capture</p>
            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={capturePhoto}>
              <Camera className="w-4 h-4 mr-2" />
              Capture Selfie
            </Button>
          </div>
        )}

        {stage === 'captured' && capturedImage && (
          <div className="space-y-4">
            <div className="rounded-xl overflow-hidden aspect-[4/3]">
              <img src={capturedImage} alt="Captured selfie" className="w-full h-full object-cover" />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={retake} disabled={saving}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retake
              </Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={submitLiveness} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                {saving ? 'Verifying...' : 'Verify'}
              </Button>
            </div>
          </div>
        )}

        {stage === 'done' && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Liveness Check Passed!</h3>
            <p className="text-sm text-gray-500">Your identity has been verified.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}