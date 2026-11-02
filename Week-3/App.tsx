
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform as RNPlatform,
  Pressable,
  StatusBar,
  Text,
  View,
} from 'react-native';

import ChecklistScreen, { Result } from './src/ChecklistScreen';
import HistoryScreen from './src/HistoryScreen';
import HomeScreen from './src/HomeScreen';
import LoginScreen from './src/LoginScreen';
import ReportsScreen from './src/ReportsScreen';
import { RoomDetail, RoomsScreen } from './src/RoomsScreen';
import SecurityTestingModal from './src/SecurityTestingModal';
import { clearAllSession, getUserSession } from './src/authStorage';

import {
  C,
  HIST0,
  Inspection,
  REPORTS0,
  Report,
  Room,
  ROOMS,
  RoomStatus,
  s,
} from './src/shared';

type Tab = 'home' | 'rooms' | 'reports' | 'history';

const TABS: [Tab, string][] = [
  ['home', 'Beranda'],
  ['rooms', 'Kamar'],
  ['reports', 'Laporan'],
  ['history', 'Riwayat'],
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [showSecTest, setShowSecTest] = useState(false);

  const [tab, setTab] = useState<Tab>('home');
  const [rooms, setRooms] = useState<Room[]>(ROOMS);
  const [reports, setReports] = useState<Report[]>(REPORTS0);
  const [history, setHistory] = useState<Inspection[]>(HIST0);
  const [detail, setDetail] = useState<Room | null>(null);
  const [checking, setChecking] = useState<Room | null>(null);

  // Memeriksa sesi pengguna saat aplikasi dimulai
  useEffect(() => {
    async function checkAuth() {
      try {
        const user = await getUserSession();

        if (user) {
          setCurrentUser(user);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Gagal memeriksa sesi:', error);
        setIsAuthenticated(false);
      }
    }

    checkAuth();
  }, []);

  // Proses logout
  const handleLogout = async () => {
    try {
      await clearAllSession();
      setIsAuthenticated(false);
      setCurrentUser(null);
      setShowSecTest(false);
      setChecking(null);
      setDetail(null);
      setTab('home');
    } catch (error) {
      Alert.alert('Error', 'Gagal menghapus sesi pengguna.');
    }
  };

  // Menyimpan hasil pemeriksaan kamar
  const save = (res: Result) => {
    if (!checking) return;

    const now = new Date();
    const date = now.toLocaleString('id-ID');

    const bad = Object.entries(res.states)
      .filter(([, value]) => value === 'Rusak')
      .map(([key]) => key);

    const warn = Object.entries(res.states)
      .filter(([, value]) => value !== 'Baik').length;

    let status: RoomStatus = checking.status;

    if (bad.length) {
      status = 'Rusak';
    } else if (res.states['Kebersihan'] !== 'Baik') {
      status = 'Perlu Dibersihkan';
    } else if (res.type === 'Check-out') {
      status = 'Kosong';
    } else if (res.type === 'Check-in') {
      status = 'Terisi';
    }

    setRooms((prevRooms) =>
      prevRooms.map((room) =>
        room.id === checking.id ? { ...room, status } : room
      )
    );

    setHistory((prevHistory) => [
      {
        id: String(now.getTime()),
        roomNo: checking.no,
        type: res.type,
        date,
        note:
          res.note ||
          (warn ? `${warn} item perlu perhatian` : 'Semua item baik'),
      },
      ...prevHistory,
    ]);

    setReports((prevReports) => [
      ...bad.map(
        (item, index): Report => ({
          id: `${now.getTime()}${index}`,
          roomNo: checking.no,
          desc: `${item} rusak (dari inspeksi)`,
          priority: 'Sedang',
          status: 'Baru',
          date: now.toLocaleDateString('id-ID'),
        })
      ),
      ...prevReports,
    ]);

    setChecking(null);
    setDetail(null);
    setTab('history');
  };

  // Tampilan loading saat memeriksa autentikasi
  if (isAuthenticated === null) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: C.bg,
        }}
      >
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={[s.p, { marginTop: 12 }]}>
          Memeriksa sesi pengguna...
        </Text>
      </View>
    );
  }

  // Jika belum login, tampilkan halaman login
  if (!isAuthenticated) {
    return (
      <LoginScreen
        onLoginSuccess={(email) => {
          setCurrentUser(email);
          setIsAuthenticated(true);
        }}
      />
    );
  }

  // Menentukan halaman yang ditampilkan
  let body: React.ReactNode;

  if (checking) {
    body = (
      <ChecklistScreen
        room={checking}
        onCancel={() => setChecking(null)}
        onSave={save}
      />
    );
  } else if (detail) {
    body = (
      <RoomDetail
        room={rooms.find((room) => room.id === detail.id) ?? detail}
        history={history}
        onBack={() => setDetail(null)}
        onStart={() => setChecking(detail)}
      />
    );
  } else if (tab === 'home') {
    body = (
      <HomeScreen
        rooms={rooms}
        history={history}
        go={(selectedTab) => setTab(selectedTab)}
        onScan={() =>
          Alert.alert(
            'Scan QR',
            'Pemindai QR (expo-camera) akan ditambahkan di tahap berikutnya.'
          )
        }
      />
    );
  } else if (tab === 'rooms') {
    body = <RoomsScreen rooms={rooms} onOpen={setDetail} />;
  } else if (tab === 'reports') {
    body = (
      <ReportsScreen
        reports={reports}
        rooms={rooms}
        onAdd={(report) => setReports((prev) => [report, ...prev])}
      />
    );
  } else {
    body = <HistoryScreen history={history} />;
  }

  // Tampilan utama aplikasi
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.bg,
        paddingTop:
          RNPlatform.OS === 'android'
            ? (StatusBar.currentHeight ?? 24)
            : 50,
      }}
    >
      <StatusBar barStyle="dark-content" />

      {/* Header: Status akun dan tombol logout */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: C.line,
        }}
      >
        <View>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: '#16A34A',
            }}
          >
            🔒 Sesi Terproteksi
          </Text>

          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: C.text,
            }}
          >
            {currentUser ?? 'Pengguna'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => setShowSecTest(true)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 8,
              backgroundColor: '#EFF6FF',
              borderWidth: 1,
              borderColor: '#BFDBFE',
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: C.primary,
              }}
            >
              Uji Keamanan
            </Text>
          </Pressable>

          <Pressable
            onPress={handleLogout}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 8,
              backgroundColor: '#FEE2E2',
              borderWidth: 1,
              borderColor: '#FECACA',
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: '#DC2626',
              }}
            >
              Keluar
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Konten halaman */}
      <View style={{ flex: 1 }}>
        {body}
      </View>

      {/* Navigasi bawah */}
      {!checking && (
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderColor: C.line,
          }}
        >
          {TABS.map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => {
                setTab(key);
                setDetail(null);
              }}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{
                selected: tab === key,
              }}
              style={{
                flex: 1,
                minHeight: 56,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontWeight: tab === key ? '800' : '500',
                  color: tab === key ? C.primary : C.muted,
                  fontSize: 14,
                }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Modal pengujian keamanan */}
      <SecurityTestingModal
        visible={showSecTest}
        onClose={() => setShowSecTest(false)}
        onForceLogout={handleLogout}
      />
    </View>
  );
}
