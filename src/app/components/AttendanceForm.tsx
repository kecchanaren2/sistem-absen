'use client';

import { useState, useEffect } from 'react';
import fpPromise from '@fingerprintjs/fingerprintjs';
import { MapPin, Fingerprint, Loader2, Download, CheckCircle, AlertCircle } from 'lucide-react';
import Image from 'next/image';

export default function AttendanceForm() {
  const [email, setEmail] = useState('');
  const [namaPeserta, setNamaPeserta] = useState('');
  const [hariAbsen, setHariAbsen] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [eligibleForCertificate, setEligibleForCertificate] = useState(false);
  
  // States for indicators
  const [locationStatus, setLocationStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [fpStatus, setFpStatus] = useState<'pending' | 'success' | 'error'>('pending');

  const [visitorId, setVisitorId] = useState<string | null>(null);

  useEffect(() => {
    // Initialize FingerprintJS
    const getFingerprint = async () => {
      try {
        const fp = await fpPromise.load();
        const result = await fp.get();
        setVisitorId(result.visitorId);
        setFpStatus('success');
      } catch (error) {
        console.error('Failed to get fingerprint', error);
        setFpStatus('error');
      }
    };

    getFingerprint();
  }, []);

  const getLocation = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
      } else {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    setLocationStatus('pending');

    try {
      if (!visitorId) {
        throw new Error('Device identification is still loading or failed. Please refresh.');
      }

      // 1. Get Geolocation
      let position: GeolocationPosition;
      try {
        position = await getLocation();
        setLocationStatus('success');
      } catch (error: any) {
        setLocationStatus('error');
        throw new Error(error.message === 'User denied Geolocation' 
          ? 'Mohon izinkan akses lokasi untuk melakukan absensi.' 
          : 'Gagal mendapatkan lokasi. Pastikan GPS aktif.');
      }

      // 2. Get Local Token
      const localToken = localStorage.getItem('absen_local_token') || '';

      // 3. Submit to API
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          nama_peserta: namaPeserta,
          hari_absen: hariAbsen,
          visitor_id: visitorId,
          local_token: localToken,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Terjadi kesalahan');
      }

      // Save token if new
      if (data.local_token && !localToken) {
        localStorage.setItem('absen_local_token', data.local_token);
      }

      setMessage({ text: data.message, type: 'success' });
      setEligibleForCertificate(data.eligibleForCertificate);
      
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadCertificate = () => {
    window.open(`/api/certificate?nama_peserta=${encodeURIComponent(namaPeserta)}`, '_blank');
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-zinc-900 rounded-2xl shadow-xl overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-10 text-white text-center">
        <h2 className="text-3xl font-bold mb-2">Portal Absensi</h2>
        <p className="text-blue-100">Pastikan Anda berada di lokasi acara</p>
      </div>

      <div className="p-8">
        <div className="flex justify-between mb-8 space-x-4">
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
            {locationStatus === 'pending' ? <MapPin className="text-gray-400" /> : 
             locationStatus === 'success' ? <MapPin className="text-green-500" /> : 
             <AlertCircle className="text-red-500" />}
            <span>Lokasi</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
            {fpStatus === 'pending' ? <Fingerprint className="text-gray-400" /> : 
             fpStatus === 'success' ? <Fingerprint className="text-green-500" /> : 
             <AlertCircle className="text-red-500" />}
            <span>Perangkat</span>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-lg mb-6 flex items-start space-x-3 ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
            <span className="font-medium">{message.text}</span>
          </div>
        )}

        {eligibleForCertificate && (
          <div className="mb-8 p-6 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800 text-center transition-all duration-500">
            <h3 className="text-xl font-bold text-indigo-900 dark:text-indigo-200 mb-2">Selamat! 🎉</h3>
            <p className="text-indigo-700 dark:text-indigo-300 text-sm mb-4">Anda telah menyelesaikan absensi hari ke-2 dan berhak mendapatkan E-Certificate.</p>
            <button
              onClick={handleDownloadCertificate}
              className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-medium transition-colors"
            >
              <Download className="w-5 h-5" />
              <span>Unduh Sertifikat</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Nama Lengkap</label>
            <input
              type="text"
              required
              value={namaPeserta}
              onChange={(e) => setNamaPeserta(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white transition-colors"
              placeholder="Sesuai kartu identitas"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white transition-colors"
              placeholder="email@contoh.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Hari Absensi</label>
            <div className="grid grid-cols-2 gap-4">
              <label className={`cursor-pointer border rounded-lg p-4 text-center font-medium transition-all ${hariAbsen === 1 ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-zinc-800'}`}>
                <input type="radio" name="hari" value={1} checked={hariAbsen === 1} onChange={() => setHariAbsen(1)} className="sr-only" />
                Hari 1
              </label>
              <label className={`cursor-pointer border rounded-lg p-4 text-center font-medium transition-all ${hariAbsen === 2 ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-zinc-800'}`}>
                <input type="radio" name="hari" value={2} checked={hariAbsen === 2} onChange={() => setHariAbsen(2)} className="sr-only" />
                Hari 2
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || fpStatus !== 'success'}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white py-3.5 rounded-lg font-bold text-lg shadow-lg shadow-blue-500/30 transition-all flex justify-center items-center mt-4"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin w-5 h-5 mr-2" />
                Memvalidasi...
              </>
            ) : (
              'Absen Sekarang'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
