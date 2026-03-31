import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CreditCard, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function NINStep({ onComplete, onSkip }) {
  const [nin, setNin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const verifyNIN = async () => {
    if (!nin || nin.length !== 11) {
      setError('NIN must be 11 digits');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await base44.functions.invoke('verifyNIN', { nin });
      if (!response.data.success) throw new Error(response.data.error || 'NIN verification failed');
      onComplete();
    } catch (err) {
      setError(err.message || 'NIN verification failed. Please check and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-4">
          <CreditCard className="w-7 h-7 text-purple-600" />
        </div>
        <CardTitle>NIN Verification</CardTitle>
        <CardDescription>Enter your 11-digit National Identification Number</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>NIN</Label>
          <Input
            type="text"
            placeholder="12345678901"
            value={nin}
            onChange={(e) => {
              setNin(e.target.value.replace(/\D/g, '').slice(0, 11));
              setError(null);
            }}
            className="mt-1 text-lg tracking-wider"
          />
          <p className="text-xs text-gray-500 mt-1">Dial *346# on your phone to get your NIN</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          className="w-full bg-purple-600 hover:bg-purple-700"
          onClick={verifyNIN}
          disabled={saving}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Verify NIN <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
          onClick={onSkip}
          disabled={saving}
        >
          Continue Without NIN Verification
        </Button>
      </CardContent>
    </Card>
  );
}