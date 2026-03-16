import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Upload, Send, Users, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export default function AdminBulkSMS() {
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [manualInput, setManualInput] = useState('');
  const [message, setMessage] = useState('');
  const [sender, setSender] = useState('Creditze');
  const [provider, setProvider] = useState('smartsms');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState('');

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split(/[\r\n,]+/).map(l => l.trim()).filter(l => l.length > 0);
      // Extract only digit-looking values
      const numbers = lines.filter(l => /^[\d\s+()-]+$/.test(l));
      setPhoneNumbers(numbers);
    };
    reader.readAsText(file);
  };

  const handleManualAdd = () => {
    const lines = manualInput.split(/[\r\n,]+/).map(l => l.trim()).filter(l => l.length > 0);
    setPhoneNumbers(prev => [...new Set([...prev, ...lines])]);
    setManualInput('');
  };

  const removeNumber = (idx) => {
    setPhoneNumbers(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSend = async () => {
    if (phoneNumbers.length === 0) return setError('Please add at least one phone number.');
    if (!message.trim()) return setError('Please enter a message.');
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const resp = await base44.functions.invoke('sendBulkSMS', {
        phone_numbers: phoneNumbers,
        message: message.trim(),
        sender: sender.trim() || 'Creditze',
        provider
      });
      setResult(resp.data);
    } catch (err) {
      setError(err.message || 'Failed to send SMS');
    } finally {
      setLoading(false);
    }
  };

  const charCount = message.length;
  const smsPages = Math.ceil(charCount / 160) || 1;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link to={createPageUrl('AdminDashboard')}>
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bulk SMS</h1>
            <p className="text-gray-500 text-sm">Upload CSV or paste numbers, then broadcast a message</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 grid md:grid-cols-2 gap-6">
        {/* Left: Recipients */}
        <div className="space-y-4">
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="w-4 h-4" /> Upload CSV
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-500">CSV should have one phone number per row (or comma-separated). Numbers in any Nigerian format are accepted.</p>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-emerald-400 transition">
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">{fileName || 'Click to upload .csv file'}</span>
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCSVUpload} />
              </label>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Manual Entry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Enter phone numbers, one per line or comma-separated"
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                rows={4}
              />
              <Button variant="outline" className="w-full" onClick={handleManualAdd}>Add Numbers</Button>
            </CardContent>
          </Card>

          {/* Phone list preview */}
          {phoneNumbers.length > 0 && (
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Recipients</span>
                  <Badge className="bg-emerald-100 text-emerald-700">{phoneNumbers.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {phoneNumbers.map((num, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5">
                      <span className="text-sm font-mono text-gray-700">{num}</span>
                      <button onClick={() => removeNumber(idx)} className="text-gray-400 hover:text-red-500">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => { setPhoneNumbers([]); setFileName(''); }}
                  className="text-xs text-red-500 hover:underline mt-2"
                >
                  Clear all
                </button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Message & Settings */}
        <div className="space-y-4">
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Sender ID</Label>
                <Input
                  value={sender}
                  onChange={e => setSender(e.target.value)}
                  maxLength={11}
                  placeholder="e.g. Creditze"
                  className="mt-1"
                />
                <p className="text-xs text-gray-400 mt-1">Max 11 characters</p>
              </div>

              <div>
                <Label>Provider</Label>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => setProvider('smartsms')}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${provider === 'smartsms' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-300'}`}
                  >
                    SmartSMS
                  </button>
                  <button
                    onClick={() => setProvider('termii')}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${provider === 'termii' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-300'}`}
                  >
                    Termii
                  </button>
                </div>
              </div>

              <div>
                <Label>Message Body</Label>
                <Textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Type your SMS message here..."
                  rows={6}
                  className="mt-1"
                />
                <p className="text-xs text-gray-400 mt-1">{charCount} characters · {smsPages} SMS page{smsPages > 1 ? 's' : ''}</p>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {result && (
                <div className={`flex items-start gap-2 rounded-lg p-3 border ${result.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  {result.success
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    : <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  }
                  <div className="text-sm">
                    {result.success ? (
                      <>
                        <p className="font-semibold text-emerald-700">Sent successfully via {result.provider}</p>
                        <p className="text-emerald-600">✓ {result.sent} sent · {result.failed} failed · {result.invalid} invalid numbers</p>
                      </>
                    ) : (
                      <p className="text-red-700">{result.error}</p>
                    )}
                  </div>
                </div>
              )}

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={handleSend}
                disabled={loading || phoneNumbers.length === 0 || !message.trim()}
              >
                {loading ? (
                  <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending...</span>
                ) : (
                  <span className="flex items-center gap-2"><Send className="w-4 h-4" /> Send to {phoneNumbers.length} recipient{phoneNumbers.length !== 1 ? 's' : ''}</span>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}