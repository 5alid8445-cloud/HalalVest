import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, useWindowDimensions, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { fetchHistory, YahooRange } from './src/lib/data';
import { funds, describeFund } from './src/lib/etfs';
import { FundKey, Portfolio } from './src/types';
import { computeCAGR, computeSMA, computeATR, latestClose } from './src/lib/indicators';
import { allocatePortfolio, RiskProfile } from './src/lib/allocate';
import { loadPortfolio, placeOrder, setCash, portfolioMetrics } from './src/lib/portfolio';
import { LinearGradient } from 'expo-linear-gradient';
import { ColorsLight as Colors, Radius, Shadow } from './src/ui/theme';
import { formatUSD, formatPct } from './src/lib/format';
import { Ionicons } from '@expo/vector-icons';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: '800' }}>حدث خطأ في الواجهة</Text>
          <Text style={{ color: '#e5e7eb', marginTop: 8, textAlign: 'center' }}>{String(this.state.error?.message || this.state.error)}</Text>
        </SafeAreaView>
      );
    }
    return this.props.children as any;
  }
}

export default function App() {
  const [amount, setAmount] = useState<string>('10000');
  const [loading, setLoading] = useState<boolean>(false);
  const [range, setRange] = useState<YahooRange>('5y');
  const [series, setSeries] = useState<Record<FundKey, number[]>>({} as Record<FundKey, number[]>);
  const [closes, setCloses] = useState<Record<FundKey, number>>({} as Record<FundKey, number>);
  const [cagrs, setCagrs] = useState<Record<FundKey, number>>({} as Record<FundKey, number>);
  const [sma200, setSma200] = useState<Record<FundKey, number>>({} as Record<FundKey, number>);
  const [atr14, setAtr14] = useState<Record<FundKey, number>>({} as Record<FundKey, number>);
  const [error, setError] = useState<string | null>(null);
  const [showAllocator, setShowAllocator] = useState<boolean>(false);
  const [profile, setProfile] = useState<RiskProfile>('balanced');
  const [selected, setSelected] = useState<FundKey | null>(null);
  const [showPortfolio, setShowPortfolio] = useState<boolean>(false);
  const [portfolio, setPortfolio] = useState<Portfolio>(loadPortfolio());
  const { width } = useWindowDimensions();
  const desktop = width >= 1000;

  const keys: FundKey[] = useMemo(() => Object.keys(funds) as FundKey[], []);
  const miniOrder: FundKey[] = ['UMMA', 'SPTE', 'HLAL', 'SPUS'];
  const cardOrder: FundKey[] = ['HLAL', 'SPUS', 'UMMA', 'SPTE'];

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data: Record<FundKey, number[]> = {} as any;
      const lc: Record<FundKey, number> = {} as any;
      const cagrMap: Record<FundKey, number> = {} as any;
      const smaMap: Record<FundKey, number> = {} as any;
      const atrMap: Record<FundKey, number> = {} as any;
      for (const k of keys) {
        const h = await fetchHistory(funds[k].ticker, range);
        data[k] = h.close;
        lc[k] = latestClose(h.close);
        cagrMap[k] = computeCAGR(h.close, h.timestamps);
        smaMap[k] = computeSMA(h.close, 200);
        atrMap[k] = computeATR(h.high, h.low, h.close, 14);
      }
      setSeries(data);
      setCloses(lc);
      setCagrs(cagrMap);
      setSma200(smaMap);
      setAtr14(atrMap);
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ أثناء جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new Event('app-mounted'));
      } catch {}
    }
    try {
      const handler = () => setPortfolio(loadPortfolio());
      if (typeof window !== 'undefined') window.addEventListener('storage', handler);
    } catch {}
  }, []);

  const allocation = useMemo(() => {
    const amt = parseFloat(amount || '0');
    if (!amt || !Object.keys(closes).length) return null;
    return allocatePortfolio(funds, closes, cagrs, sma200, amt, 'balanced', atr14);
  }, [amount, closes, cagrs, sma200, atr14]);

  const dailyChange = (k: FundKey) => {
    const s = series[k] || [];
    if (s.length < 2) return 0;
    const prev = s[s.length - 2];
    const last = s[s.length - 1];
    if (!isFinite(prev) || !isFinite(last) || prev === 0) return 0;
    return (last - prev) / prev;
  };

  return (
    <ErrorBoundary>
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        <LinearGradient colors={[Colors.grad1, Colors.grad2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 92, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
          <View style={{ width: '100%', maxWidth: 1120, alignSelf: 'center', alignItems: 'flex-end' }}>
            <View style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.42)', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.12)' }}>
              <Text style={{ color: 'white', fontWeight: '700' }}>استثمار متوافق مع الشريعة الإسلامية</Text>
            </View>
            <Text style={{ color: 'white', marginTop: 10, fontSize: desktop ? 72 : 52, fontWeight: '900', textAlign: 'right', lineHeight: desktop ? 76 : 54, fontFamily: 'IBM Plex Sans Arabic' }}>الصناديق</Text>
            <Text style={{ color: 'white', marginTop: -8, fontSize: desktop ? 72 : 52, fontWeight: '900', textAlign: 'right', lineHeight: desktop ? 76 : 54, fontFamily: 'IBM Plex Sans Arabic' }}>الاستثمارية الحلال</Text>
            <Text style={{ color: '#bff7ec', marginTop: 8, fontSize: 21, textAlign: 'right' }}>تحليل شامل لأربعة صناديق ETF متوافقة مع الشريعة مع توزيع ذكي</Text>
            <Text style={{ color: '#bff7ec', fontSize: 21, textAlign: 'right' }}>لرأس المال</Text>
            <View style={{ flexDirection: 'row-reverse', marginTop: 24 }}>
              <Pressable onPress={() => setShowPortfolio((v) => { const nv = !v; if (nv) setShowAllocator(false); return nv; })} style={({ pressed }) => [{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#c7f0e7', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 22, flexDirection: 'row-reverse', alignItems: 'center', marginStart: 10, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
                <Ionicons name="briefcase-outline" size={18} color="#065f63" />
                <Text style={{ color: '#065f63', fontWeight: '800', fontSize: 15, marginEnd: 8 }}>المحفظة الافتراضية</Text>
              </Pressable>
              <Pressable onPress={() => setShowAllocator((v) => { const nv = !v; if (nv) setShowPortfolio(false); return nv; })} style={({ pressed }) => [{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#c7f0e7', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 22, flexDirection: 'row-reverse', alignItems: 'center', marginStart: 10, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
                <Ionicons name="wallet-outline" size={18} color="#065f63" />
                <Text style={{ color: '#065f63', fontWeight: '800', fontSize: 15, marginEnd: 8 }}>حاسبة التوزيع الذكي</Text>
              </Pressable>
              <Pressable onPress={load} style={({ pressed }) => [{ backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 22, flexDirection: 'row-reverse', alignItems: 'center', opacity: loading ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
                <Ionicons name="refresh" size={18} color="#f0fffa" />
                <Text style={{ color: '#f0fffa', fontWeight: '800', fontSize: 15, marginEnd: 8 }}>{loading ? 'تحديث البيانات...' : 'تحديث البيانات'}</Text>
              </Pressable>
            </View>
          </View>
        </LinearGradient>

        <View style={{ width: '100%', maxWidth: 1120, alignSelf: 'center', marginTop: -44, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          {miniOrder.map((k) => {
            const price = closes[k];
            const ch = dailyChange(k);
            return (
              <View key={k} style={[{ width: desktop ? '23.6%' : '48.5%', marginBottom: 10, backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#e8eff1', paddingVertical: 16, alignItems: 'center', shadowOpacity: 0.08, shadowRadius: 18 }, Shadow.card]}>
                <Text style={{ color: '#b0b8c8', fontWeight: '700', fontSize: 14 }}>{funds[k].ticker}</Text>
                <Text style={{ color: '#0f172a', fontSize: desktop ? 42 : 34, fontWeight: '900', marginTop: 2 }}>{formatUSD(price)}</Text>
                <Text style={{ color: ch >= 0 ? '#00a874' : Colors.danger, marginTop: 2, fontWeight: '700' }}>{(ch * 100).toFixed(2)}% {ch >= 0 ? '▲' : '▼'}</Text>
              </View>
            );
          })}
        </View>

        <View style={{ width: '100%', maxWidth: 1120, alignSelf: 'center', marginTop: 8 }}>
          <Text style={{ color: '#f59e0b', textAlign: 'right', fontSize: 18 }}>{loading ? 'تجري الآن قراءة البيانات...' : error ? error : 'تعذر جلب البيانات، جاري عرض البيانات المحفوظة.'}</Text>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginTop: 8 }}>
            <Text style={{ color: '#0f172a', fontSize: 46, fontWeight: '900' }}>الصناديق الاستثمارية</Text>
            <Ionicons name="stats-chart" size={22} color="#0fbf9f" style={{ marginStart: 10 }} />
          </View>
        </View>

        <View style={{ width: '100%', maxWidth: 1120, alignSelf: 'center', marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {!loading &&
            cardOrder.map((k) => {
              const f = funds[k];
              const price = closes[k];
              const cagr = cagrs[k];
              const day = dailyChange(k);
              return (
                <Pressable key={k} onPress={() => setSelected(k)} style={({ pressed }) => [{ width: desktop ? '49.2%' : '100%', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e8eff1', borderRadius: 20, marginTop: 14, padding: 16, borderTopWidth: 4, borderTopColor: Colors.primary, transform: [{ scale: pressed ? 0.99 : 1 }] }, Shadow.card]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Ionicons name="chevron-back" size={20} color="#cbd5e1" />
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                      <View style={{ borderWidth: 1, borderColor: '#9be7c0', backgroundColor: '#eafff2', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 2, flexDirection: 'row-reverse', alignItems: 'center', marginStart: 8 }}>
                        <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                        <Text style={{ color: '#047857', marginHorizontal: 4, fontWeight: '700' }}>حلال</Text>
                      </View>
                      <Text style={{ color: '#0f172a', fontSize: 18, fontWeight: '900' }}>{f.ticker}</Text>
                    </View>
                  </View>
                  <Text style={{ color: '#8e9ab3', textAlign: 'right', marginTop: 6, lineHeight: 22 }}>{f.name}</Text>
                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 14 }}>
                    <View style={{ width: '31%', backgroundColor: '#f8fafc', borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}>
                      <Text style={{ color: '#98a2b3' }}>السعر الحالي</Text>
                      <Text style={{ color: '#0f172a', fontSize: 16, fontWeight: '900', marginTop: 4 }}>{formatUSD(price)}</Text>
                    </View>
                    <View style={{ width: '31%', backgroundColor: '#ecfdf5', borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}>
                      <Text style={{ color: '#98a2b3' }}>اليوم</Text>
                      <Text style={{ color: '#059669', fontSize: 16, fontWeight: '900', marginTop: 4 }}>{(day * 100).toFixed(2)}% ↗</Text>
                    </View>
                    <View style={{ width: '31%', backgroundColor: '#fffbeb', borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}>
                      <Text style={{ color: '#98a2b3' }}>العائد السنوي</Text>
                      <Text style={{ color: '#c2410c', fontSize: 16, fontWeight: '900', marginTop: 4 }}>{isFinite(cagr) ? formatPct(cagr) : '—'}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
        </View>

        {showAllocator && (
          <AllocatorPanel
            amount={amount}
            setAmount={setAmount}
            profile={profile}
            setProfile={setProfile}
            prices={closes}
            cagrs={cagrs}
            sma200={sma200}
            atr14={atr14}
            onClose={() => setShowAllocator(false)}
          />
        )}
        {showPortfolio && (
          <PortfolioPanel
            prices={closes}
            p={portfolio}
            onRefresh={() => setPortfolio(loadPortfolio())}
            onOrder={(type, key, qty, price) => {
              const np = placeOrder(type, key, qty, price);
              setPortfolio(np);
            }}
            onSetCash={(v) => setPortfolio(setCash(v))}
            onClose={() => setShowPortfolio(false)}
          />
        )}

        {loading && (
          <View style={{ marginTop: 14 }}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        )}

        <View style={{ width: '100%', maxWidth: 1120, alignSelf: 'center', marginTop: 16, backgroundColor: '#fffdf5', borderWidth: 1, borderColor: '#f2e8c9', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 }}>
          <Text style={{ color: '#d97706', textAlign: 'center', fontSize: 16 }}>⚠️ هذا التطبيق لأغراض تعليمية فقط وليس نصيحة مالية، يُرجى استشارة مستشار مالي متخصص قبل اتخاذ أي قرارات استثمارية.</Text>
        </View>
        </ScrollView>
        {selected && (
          <DetailSheet
            key={`sheet-${selected}`}
            k={selected}
            onClose={() => setSelected(null)}
            price={closes[selected]}
            series={series[selected] || []}
            cagr={cagrs[selected]}
            sma200={sma200[selected]}
            atr={atr14[selected]}
          />
        )}
      </SafeAreaView>
    </ErrorBoundary>
  );
}

function DetailSheet({
  k,
  onClose,
  price,
  series,
  cagr,
  sma200,
  atr,
}: {
  k: FundKey;
  onClose: () => void;
  price?: number;
  series: number[];
  cagr?: number;
  sma200?: number;
  atr?: number;
}) {
  const meta = funds[k];
  const info = describeFund(k);
  const last = price ?? (series?.length ? series[series.length - 1] : undefined);
  const prev = series?.length > 1 ? series[series.length - 2] : undefined;
  const day = prev && last ? (last - prev) / prev : 0;
  const entryLow = sma200 ? sma200 * 0.9 : undefined;
  const stop = entryLow && atr ? Math.max(entryLow - 2 * atr, sma200 ? sma200 * 0.82 : entryLow * 0.9) : undefined;
  const target = sma200 ? sma200 * 1.05 : undefined;
  const status =
    last && sma200
      ? last < sma200
        ? 'يُفضّل الانتظار'
        : last < sma200 * 1.02
        ? 'إشارة حيادية'
        : 'فرصة استثمارية معتدلة'
      : '—';
  const { width } = useWindowDimensions();
  const detailDesktop = width >= 980;
  const facts: Record<FundKey, { founded: string; risk: string }> = {
    SPUS: { founded: '2019-12-17', risk: 'متوسط' },
    HLAL: { founded: '2019-07-16', risk: 'متوسط' },
    SPTE: { founded: '2023-12-13', risk: 'مرتفع' },
    UMMA: { founded: '2021-12-22', risk: 'متوسط' },
  };
  const fact = facts[k];
  const sectors = meta.sectors || [];
  const sectorColors = ['#0ea5a5', '#10b981', '#f59e0b', '#6366f1', '#ef4444', '#14b8a6', '#3b82f6', '#f97316'];
  const totalSectorWeight = sectors.reduce((acc, s) => acc + s.weight, 0);
  let sectorAcc = 0;
  const donutStops = sectors
    .map((s, idx) => {
      const pct = totalSectorWeight ? (s.weight / totalSectorWeight) * 100 : 0;
      const start = sectorAcc;
      sectorAcc += pct;
      return `${sectorColors[idx % sectorColors.length]} ${start}% ${sectorAcc}%`;
    })
    .join(', ');
  const donutSize = detailDesktop ? 190 : 170;
  const donutHole = detailDesktop ? 110 : 96;
  const supportsConic =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    (window as any).CSS &&
    typeof (window as any).CSS.supports === 'function' &&
    (window as any).CSS.supports('background-image', 'conic-gradient(#000 0% 100%)');
  const donutStyle =
    Platform.OS === 'web' && donutStops && supportsConic ? ({ backgroundImage: `conic-gradient(${donutStops})` } as any) : {};
  const topHoldings = (meta.holdings || []).slice(0, 10);
  const holdingsColors = ['#0ea5a5', '#10b981', '#f59e0b', '#6366f1', '#ef4444', '#14b8a6', '#3b82f6', '#f97316', '#22c55e', '#a855f7'];
  const totalHoldingsWeight = topHoldings.reduce((acc, h) => acc + h.weight, 0) || 100;
  let holdAcc = 0;
  const holdingsStops = topHoldings
    .map((h, idx) => {
      const pct = totalHoldingsWeight ? (h.weight / totalHoldingsWeight) * 100 : 0;
      const start = holdAcc;
      holdAcc += pct;
      return `${holdingsColors[idx % holdingsColors.length]} ${start}% ${holdAcc}%`;
    })
    .join(', ');
  const holdingsDonutStyle =
    Platform.OS === 'web' && holdingsStops && supportsConic ? ({ backgroundImage: `conic-gradient(${holdingsStops})` } as any) : {};

  const Bar = ({ v }: { v: number }) => (
    <View style={{ height: 6, backgroundColor: '#e2e8f0', borderRadius: 999, overflow: 'hidden', width: '100%' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, v))}%`, backgroundColor: '#10b981', height: 6 }} />
    </View>
  );

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#f3f7fb' }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <LinearGradient colors={['#059a9b', '#04726f']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 34, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }}>
          <View style={{ width: '100%', maxWidth: 1120, alignSelf: 'center' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Pressable onPress={onClose} style={{ paddingVertical: 8, flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="arrow-forward" size={20} color="#dffdfa" />
                <Text style={{ color: '#dffdfa', marginStart: 6, fontWeight: '700' }}>العودة للرئيسية</Text>
              </Pressable>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                <View style={{ borderWidth: 1, borderColor: '#9be7c0', backgroundColor: '#eafff2', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row-reverse', alignItems: 'center', marginStart: 8 }}>
                  <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                  <Text style={{ color: '#047857', marginHorizontal: 6, fontWeight: '800' }}>حلال</Text>
                </View>
                <Text style={{ color: 'white', fontWeight: '900', fontSize: 44 }}>{meta.ticker}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 }}>
              <View>
                <Text style={{ color: 'white', fontWeight: '900', fontSize: 58 }}>{formatUSD(last)}</Text>
                <Text style={{ color: day >= 0 ? '#bbf7d0' : '#fecaca', fontSize: 18, fontWeight: '700' }}>اليوم {((day || 0) * 100).toFixed(2)}% {day >= 0 ? '▲' : '▼'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', maxWidth: '64%' }}>
                <Text style={{ color: '#d2fff5', fontSize: 26, fontWeight: '900', textAlign: 'right' }}>{meta.name}</Text>
                <Text style={{ color: '#bdf7e9', fontSize: 16, textAlign: 'right', marginTop: 4 }}>{info.summary}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={{ width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 14 }}>
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 12 }}>
            {[
              { t: 'سعر الدخول المقترح', v: entryLow && sma200 ? `${formatUSD(entryLow)} - ${formatUSD(sma200)}` : '—', c: '#059669', ic: 'locate-outline' as const },
              { t: 'وقف الخسارة', v: stop ? formatUSD(stop) : '—', c: '#dc2626', ic: 'alert-circle-outline' as const },
              { t: 'السعر المستهدف', v: target ? formatUSD(target) : '—', c: '#0f766e', ic: 'flag-outline' as const },
              { t: 'العائد السنوي المتوقع', v: isFinite(cagr || NaN) ? formatPct(cagr!) : '—', c: '#b45309', ic: 'stats-chart-outline' as const },
            ].map((x, i) => (
              <View key={i} style={{ width: detailDesktop ? '24.2%' : '49%', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e8eff1', borderRadius: 14, marginTop: 10, paddingVertical: 12, paddingHorizontal: 12, shadowOpacity: 0.05, shadowRadius: 10 }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Ionicons name={x.ic} size={17} color={x.c} />
                  <Text style={{ color: '#98a2b3', textAlign: 'right' }}>{x.t}</Text>
                </View>
                <Text style={{ color: x.c, fontWeight: '900', fontSize: 34, textAlign: 'right', marginTop: 4 }}>{x.v}</Text>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 12, backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 14 }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                <Ionicons name="hourglass-outline" size={18} color="#b45309" />
                <Text style={{ color: '#b45309', fontSize: 26, fontWeight: '900', marginEnd: 8 }}>{status === 'يُفضّل الانتظار' ? 'يفضل الانتظار' : status}</Text>
              </View>
              <Ionicons name="warning-outline" size={22} color="#b45309" />
            </View>
            <Text style={{ color: '#b45309', marginTop: 8, textAlign: 'right', fontSize: 18 }}>
              {sma200 && last && last < sma200 ? 'المؤشرات الفنية الحالية تشير إلى استمرار اتجاه هابط، مما يستدعي الانتظار حتى تظهر إشارات انعكاس صعودي.' : 'المؤشرات الفنية الحالية داعمة لاتجاه صاعد نسبيًا، مع ضرورة الالتزام بإدارة المخاطر.'}
            </Text>
          </View>

          <View style={{ marginTop: 12, backgroundColor: '#ffffff', borderColor: '#e8eff1', borderWidth: 1, borderRadius: 14, padding: 14 }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
              <Ionicons name="analytics-outline" size={20} color="#0f766e" />
              <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 24, marginEnd: 8 }}>التحليل الفني</Text>
            </View>
            <Text style={{ color: '#334155', textAlign: 'right', marginTop: 8, fontSize: 16 }}>
              تظهر المؤشرات الفنية تباينًا في الزخم، حيث يعتمد القرار على علاقة السعر بمتوسط 200 يوم ونطاق التذبذب.
            </Text>
            <View style={{ flexDirection: detailDesktop ? 'row-reverse' : 'column', justifyContent: 'space-between', marginTop: 10 }}>
              <View style={{ width: detailDesktop ? '49%' : '100%', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 10, marginTop: detailDesktop ? 0 : 8 }}>
                <Text style={{ color: '#0f172a', textAlign: 'right', fontWeight: '800' }}>المخاطرة/العائد</Text>
                <Text style={{ color: '#0f172a', textAlign: 'right', marginTop: 4 }}>نسبة العائد لكل وحدة مخاطرة تقارب 1:{day >= 0 ? '2' : '1.2'} وتشير إلى فرصة معتدلة.</Text>
              </View>
              <View style={{ width: detailDesktop ? '49%' : '100%', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 10, marginTop: detailDesktop ? 0 : 8 }}>
                <Text style={{ color: '#0f172a', textAlign: 'right', fontWeight: '800' }}>نظرة الاتجاه الحالي</Text>
                <Text style={{ color: '#0f172a', textAlign: 'right', marginTop: 4 }}>{sma200 && last && last < sma200 ? 'هابط، ننصح بالانتظار قبل الشراء.' : 'محايد إلى صاعد مع مراقبة وقف الخسارة.'}</Text>
              </View>
            </View>
          </View>

          <View style={{ marginTop: 12, backgroundColor: '#ffffff', borderColor: '#e8eff1', borderWidth: 1, borderRadius: 14, padding: 14 }}>
            <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 24, textAlign: 'right' }}>عن الصندوق</Text>
            <Text style={{ color: '#334155', marginTop: 8, textAlign: 'right', fontSize: 18 }}>{info.summary}</Text>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 10 }}>
              <View style={{ width: detailDesktop ? '24%' : '49%', backgroundColor: '#f8fafc', borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginTop: 8 }}>
                <Text style={{ color: '#94a3b8' }}>التصنيف</Text>
                <Text style={{ color: '#0f172a', fontWeight: '800', marginTop: 4, textAlign: 'center' }}>{meta.category}</Text>
              </View>
              <View style={{ width: detailDesktop ? '24%' : '49%', backgroundColor: '#f8fafc', borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginTop: 8 }}>
                <Text style={{ color: '#94a3b8' }}>مستوى المخاطرة</Text>
                <Text style={{ color: '#92400e', fontWeight: '900', marginTop: 4 }}>{fact.risk}</Text>
              </View>
              <View style={{ width: detailDesktop ? '24%' : '49%', backgroundColor: '#f8fafc', borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginTop: 8 }}>
                <Text style={{ color: '#94a3b8' }}>تاريخ التأسيس</Text>
                <Text style={{ color: '#0f172a', fontWeight: '800', marginTop: 4 }}>{fact.founded}</Text>
              </View>
              <View style={{ width: detailDesktop ? '24%' : '49%', backgroundColor: '#f8fafc', borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginTop: 8 }}>
                <Text style={{ color: '#94a3b8' }}>الجهة المديرة</Text>
                <Text style={{ color: '#0f172a', fontWeight: '800', marginTop: 4 }}>{meta.ticker.startsWith('SP') ? 'SP Funds' : 'Wahed'}</Text>
              </View>
            </View>
          </View>

          {sectors.length > 0 && (
            <View style={{ marginTop: 12, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e8eff1', borderRadius: 14, padding: 14 }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                <Ionicons name="pie-chart-outline" size={20} color="#0f766e" />
                <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 24, marginEnd: 8 }}>توزيع القطاعات</Text>
              </View>
              <View style={{ flexDirection: detailDesktop ? 'row-reverse' : 'column', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <View style={{ width: detailDesktop ? '38%' : '100%', alignItems: 'center', justifyContent: 'center', marginTop: detailDesktop ? 0 : 4 }}>
                  <View style={[{ width: donutSize, height: donutSize, borderRadius: 999, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }, donutStyle]}>
                    <View style={{ width: donutHole, height: donutHole, borderRadius: 999, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e8eff1' }}>
                      <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 18 }}>التوزيع</Text>
                      <Text style={{ color: '#64748b', fontSize: 12 }}>القطاعي</Text>
                    </View>
                  </View>
                  <Text style={{ color: '#94a3b8', marginTop: 8 }}>أكبر القطاعات حسب الوزن</Text>
                </View>
                <View style={{ width: detailDesktop ? '58%' : '100%', marginTop: detailDesktop ? 0 : 12 }}>
                  {sectors.map((s: { name: string; weight: number }, idx: number) => {
                    const color = sectorColors[idx % sectorColors.length];
                    const pct = totalSectorWeight ? (s.weight / totalSectorWeight) * 100 : 0;
                    return (
                      <View key={idx} style={{ marginTop: 10 }}>
                        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                            <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: color, marginStart: 8 }} />
                            <Text style={{ color: '#0f172a', fontWeight: '700' }}>{s.name}</Text>
                          </View>
                          <Text style={{ color: '#0f172a', fontWeight: '800' }}>{s.weight.toFixed(2)}%</Text>
                        </View>
                        <View style={{ height: 7, backgroundColor: '#e2e8f0', borderRadius: 999, overflow: 'hidden', marginTop: 6 }}>
                          <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color, height: 7, borderRadius: 999 }} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {topHoldings.length > 0 && (
            <View style={{ marginTop: 12, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e8eff1', borderRadius: 14, padding: 14 }}>
              <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 24, textAlign: 'right' }}>أكبر 10 مكونات</Text>
              <View style={{ flexDirection: detailDesktop ? 'row-reverse' : 'column', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <View style={{ width: detailDesktop ? '38%' : '100%', alignItems: 'center', justifyContent: 'center' }}>
                  <View style={[{ width: donutSize, height: donutSize, borderRadius: 999, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }, holdingsDonutStyle]}>
                    <View style={{ width: donutHole, height: donutHole, borderRadius: 999, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e8eff1' }}>
                      <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 16 }}>المكونات</Text>
                      <Text style={{ color: '#64748b', fontSize: 12 }}>Top 10</Text>
                    </View>
                  </View>
                </View>
                <View style={{ width: detailDesktop ? '58%' : '100%', marginTop: detailDesktop ? 0 : 12 }}>
                  {topHoldings.map((h: { symbol: string; name: string; weight: number }, idx: number) => {
                    const color = holdingsColors[idx % holdingsColors.length];
                    const pct = totalHoldingsWeight ? (h.weight / totalHoldingsWeight) * 100 : 0;
                    return (
                      <View key={idx} style={{ paddingVertical: 9, borderBottomWidth: idx === topHoldings.length - 1 ? 0 : 1, borderColor: '#eef2f7' }}>
                        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', width: '34%' }}>
                            <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: color, marginStart: 8 }} />
                            <Text style={{ color: '#0f172a', textAlign: 'right' }}>{h.name}</Text>
                          </View>
                          <Text style={{ color: '#0f172a', width: '16%', textAlign: 'center', fontWeight: '700' }}>{h.symbol}</Text>
                          <View style={{ width: '36%' }}>
                            <View style={{ height: 7, backgroundColor: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                              <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color, height: 7, borderRadius: 999 }} />
                            </View>
                          </View>
                          <Text style={{ color: '#0f172a', width: '12%', textAlign: 'left', fontWeight: '800' }}>{h.weight.toFixed(2)}%</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function AllocatorPanel({
  amount,
  setAmount,
  profile,
  setProfile,
  prices,
  cagrs,
  sma200,
  atr14,
  onClose,
}: {
  amount: string;
  setAmount: (v: string) => void;
  profile: RiskProfile;
  setProfile: (v: RiskProfile) => void;
  prices: Record<FundKey, number>;
  cagrs: Record<FundKey, number>;
  sma200: Record<FundKey, number>;
  atr14: Record<FundKey, number>;
  onClose: () => void;
}) {
  const amt = parseFloat(amount || '0') || 0;
  const { width } = useWindowDimensions();
  const allocatorDesktop = width >= 980;
  const fundColors: Record<FundKey, string> = {
    SPUS: '#3b82f6',
    HLAL: '#10b981',
    SPTE: '#f59e0b',
    UMMA: '#0ea5a5',
  };
  const allocation = useMemo(() => {
    if (!amt || !Object.keys(prices).length) return null;
    return allocatePortfolio(funds, prices, cagrs, sma200, amt, profile, atr14);
  }, [amt, prices, cagrs, sma200, profile, atr14]);

  const avgVol =
    Object.keys(prices).length &&
    (Object.keys(prices) as FundKey[]).reduce((acc, k) => {
      const p = prices[k] || 1;
      const v = atr14[k] ? atr14[k] / p : 0.02;
      return acc + v;
    }, 0) / (Object.keys(prices).length || 1);
  const riskNote =
    profile === 'aggressive'
      ? 'المخاطرة مرتفعة نسبيًا مع تفضيل الزخم، يوصى بوقف خسارة أكثر تشددًا.'
      : 'المخاطرة متوازنة مع تخفيض أثر التذبذب، يوصى بالالتزام بوقف الخسارة.';

  return (
    <View style={{ width: '100%', maxWidth: 1120, alignSelf: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e8eff1', borderRadius: 16, marginTop: 16, padding: 16 }}>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 22, textAlign: 'right' }}>حاسبة التوزيع الذكي</Text>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
          <Pressable onPress={onClose} style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, marginStart: 8, flexDirection: 'row-reverse', alignItems: 'center' }}>
            <Ionicons name="close" size={16} color="#991b1b" />
            <Text style={{ color: '#991b1b', fontWeight: '800', marginEnd: 6 }}>إغلاق</Text>
          </Pressable>
          <View style={{ backgroundColor: '#ecfeff', borderColor: '#99f6e4', borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 }}>
            <Text style={{ color: '#0f766e', fontWeight: '800' }}>توزيع آلي</Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row-reverse', marginTop: 12 }}>
        <Pressable onPress={() => setProfile('balanced')} style={{ backgroundColor: profile === 'balanced' ? '#ecfdf5' : '#f8fafc', borderColor: profile === 'balanced' ? '#10b981' : '#e2e8f0', borderWidth: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16, marginStart: 8 }}>
          <Text style={{ color: '#0f172a', fontWeight: '800' }}>متوازن</Text>
        </Pressable>
        <Pressable onPress={() => setProfile('aggressive')} style={{ backgroundColor: profile === 'aggressive' ? '#fff7ed' : '#f8fafc', borderColor: profile === 'aggressive' ? '#fb923c' : '#e2e8f0', borderWidth: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16 }}>
          <Text style={{ color: '#0f172a', fontWeight: '800' }}>مغامر</Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 12 }}>
        <Text style={{ color: '#334155', marginBottom: 8, textAlign: 'right', fontWeight: '700' }}>المبلغ للاستثمار (USD)</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="ادخل المبلغ"
          placeholderTextColor={Colors.muted}
          style={{ backgroundColor: '#f8fafc', color: Colors.text, paddingHorizontal: 12, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, textAlign: 'right' }}
        />
      </View>

      {allocation && (
        <>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 14 }}>
            <View style={{ width: allocatorDesktop ? '32%' : '100%', backgroundColor: '#ecfdf5', borderRadius: 14, padding: 12, marginTop: allocatorDesktop ? 0 : 8 }}>
              <Text style={{ color: '#065f46', fontWeight: '800' }}>العائد السنوي المتوقع</Text>
              <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 18, marginTop: 6 }}>{formatPct(allocation.expectedAnnualReturn)}</Text>
            </View>
            <View style={{ width: allocatorDesktop ? '32%' : '100%', backgroundColor: '#e0f2fe', borderRadius: 14, padding: 12, marginTop: allocatorDesktop ? 0 : 8 }}>
              <Text style={{ color: '#075985', fontWeight: '800' }}>العائد المتوقع بالدولار</Text>
              <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 18, marginTop: 6 }}>{formatUSD(allocation.expectedAnnualReturn * amt)}</Text>
            </View>
            <View style={{ width: allocatorDesktop ? '32%' : '100%', backgroundColor: '#fff7ed', borderRadius: 14, padding: 12, marginTop: allocatorDesktop ? 0 : 8 }}>
              <Text style={{ color: '#9a3412', fontWeight: '800' }}>تقييم المخاطر</Text>
              <Text style={{ color: '#7c2d12', marginTop: 6 }}>{riskNote}</Text>
            </View>
          </View>

          <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 18, textAlign: 'right', marginTop: 16 }}>التوزيع المقترح</Text>
          <View style={{ marginTop: 10 }}>
            {(() => {
              const itemsSorted = allocation.items.slice().sort((a, b) => b.weight - a.weight);
              const totalW = itemsSorted.reduce((s, it) => s + (isFinite(it.weight) ? it.weight : 0), 0) || 100;
              let acc = 0;
              const stops = itemsSorted
                .map((it) => {
                  const pct = (isFinite(it.weight) ? it.weight : 0) / totalW * 100;
                  const start = acc;
                  acc += pct;
                  const color = fundColors[it.key];
                  return `${color} ${start}% ${acc}%`;
                })
                .join(', ');
              const supportsConic =
                Platform.OS === 'web' &&
                typeof window !== 'undefined' &&
                (window as any).CSS &&
                typeof (window as any).CSS.supports === 'function' &&
                (window as any).CSS.supports('background-image', 'conic-gradient(#000 0% 100%)');
              const donutSize = allocatorDesktop ? 190 : 170;
              const donutHole = allocatorDesktop ? 110 : 96;
              const donutStyle = Platform.OS === 'web' && supportsConic && stops ? ({ backgroundImage: `conic-gradient(${stops})` } as any) : {};
              return (
                <View style={{ flexDirection: allocatorDesktop ? 'row-reverse' : 'column', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ width: allocatorDesktop ? '36%' : '100%', alignItems: 'center', justifyContent: 'center', marginBottom: allocatorDesktop ? 0 : 10 }}>
                    <View style={[{ width: donutSize, height: donutSize, borderRadius: 999, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }, donutStyle]}>
                      <View style={{ width: donutHole, height: donutHole, borderRadius: 999, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e8eff1' }}>
                        <Text style={{ color: '#0f172a', fontWeight: '900' }}>التوزيع</Text>
                        <Text style={{ color: '#64748b', fontSize: 12 }}>على الصناديق</Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ width: allocatorDesktop ? '60%' : '100%' }}>
                    {itemsSorted.map((it, idx) => {
                      const color = fundColors[it.key];
                      return (
                        <View key={it.key} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: idx === 0 ? 0 : 8 }}>
                          <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                            <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: color, marginStart: 8 }} />
                            <Text style={{ color: '#0f172a', fontWeight: '800' }}>{funds[it.key].ticker}</Text>
                          </View>
                          <View style={{ width: '62%' }}>
                            <View style={{ height: 7, backgroundColor: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                              <View style={{ width: `${Math.max(0, Math.min(100, it.weight))}%`, backgroundColor: color, height: 7, borderRadius: 999 }} />
                            </View>
                          </View>
                          <Text style={{ color: '#0f172a', fontWeight: '900', width: 60, textAlign: 'left' }}>{it.weight.toFixed(2)}%</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })()}
          </View>
          <View style={{ marginTop: 10 }}>
            {allocation.items.slice().sort((a, b) => b.weight - a.weight)
              .map((it) => {
                const s200 = sma200[it.key];
                const atr = atr14[it.key];
                const entryLow = s200 ? s200 * 0.9 : undefined;
                const stop = entryLow && atr ? Math.max(entryLow - 2 * atr, s200 ? s200 * 0.82 : entryLow * 0.9) : undefined;
                return (
                  <View key={it.key} style={{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e8eff1', borderRadius: 14, padding: 12, marginTop: 10 }}>
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                        <View style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: `${fundColors[it.key]}22`, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: fundColors[it.key] }}>
                          <Text style={{ color: fundColors[it.key], fontWeight: '900', fontSize: 13 }}>{it.weight.toFixed(0)}%</Text>
                        </View>
                        <View style={{ marginEnd: 10, alignItems: 'flex-end' }}>
                          <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 22 }}>{funds[it.key].ticker}</Text>
                          <Text style={{ color: '#64748b', fontSize: 13 }}>{funds[it.key].name}</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-start' }}>
                        <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 20 }}>{formatUSD(it.amount)}</Text>
                        <Text style={{ color: '#64748b', fontSize: 12 }}>قيمة التخصيص</Text>
                      </View>
                    </View>
                    <View style={{ marginTop: 10, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: '#0f172a', fontWeight: '800' }}>نسبة التوزيع</Text>
                      <Text style={{ color: '#0f766e', fontWeight: '900' }}>{it.weight.toFixed(2)}%</Text>
                    </View>
                    <View style={{ height: 9, backgroundColor: '#e2e8f0', borderRadius: 999, overflow: 'hidden', marginTop: 8 }}>
                      <View style={{ width: `${Math.max(0, Math.min(100, it.weight))}%`, backgroundColor: '#10b981', height: 9, borderRadius: 999 }} />
                    </View>
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap' }}>
                      <View style={{ backgroundColor: '#f8fafc', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginTop: 6 }}>
                        <Text style={{ color: '#64748b' }}>سعر الدخول</Text>
                        <Text style={{ color: '#0f172a', fontWeight: '700', marginTop: 2 }}>{entryLow && s200 ? `${formatUSD(entryLow)} - ${formatUSD(s200)}` : '—'}</Text>
                      </View>
                      <View style={{ backgroundColor: '#f8fafc', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginTop: 6 }}>
                        <Text style={{ color: '#64748b' }}>وقف الخسارة</Text>
                        <Text style={{ color: '#0f172a', fontWeight: '700', marginTop: 2 }}>{stop ? formatUSD(stop) : '—'}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
          </View>
        </>
      )}
    </View>
  );
}

function PortfolioPanel({
  prices,
  p,
  onRefresh,
  onOrder,
  onSetCash,
  onClose,
}: {
  prices: Record<FundKey, number>;
  p: Portfolio;
  onRefresh: () => void;
  onOrder: (type: 'buy' | 'sell', key: FundKey, qty: number, price: number) => void;
  onSetCash: (v: number) => void;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const desktop = width >= 980;
  const [qty, setQty] = useState<string>('10');
  const [sel, setSel] = useState<FundKey>('HLAL');
  const price = prices[sel] || 0;
  const m = portfolioMetrics(p, prices);
  return (
    <View style={{ width: '100%', maxWidth: 1120, alignSelf: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e8eff1', borderRadius: 16, marginTop: 16, padding: 16 }}>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 22 }}>المحفظة الافتراضية</Text>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
          <Pressable onPress={onClose} style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, marginStart: 8, flexDirection: 'row-reverse', alignItems: 'center' }}>
            <Ionicons name="close" size={16} color="#991b1b" />
            <Text style={{ color: '#991b1b', fontWeight: '800', marginEnd: 6 }}>إغلاق</Text>
          </Pressable>
          <Pressable onPress={onRefresh} style={{ backgroundColor: '#ecfeff', borderColor: '#99f6e4', borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, flexDirection: 'row-reverse', alignItems: 'center' }}>
            <Ionicons name="refresh" size={16} color="#0f766e" />
            <Text style={{ color: '#0f766e', fontWeight: '800', marginEnd: 6 }}>تحديث</Text>
          </Pressable>
        </View>
      </View>
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 12 }}>
        <View style={{ width: desktop ? '24%' : '49%', backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginTop: 8 }}>
          <Text style={{ color: '#64748b' }}>النقد</Text>
          <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 20, marginTop: 4 }}>{formatUSD(p.cash)}</Text>
        </View>
        <View style={{ width: desktop ? '24%' : '49%', backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginTop: 8 }}>
          <Text style={{ color: '#64748b' }}>قيمة المراكز</Text>
          <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 20, marginTop: 4 }}>{formatUSD(m.positionsValue)}</Text>
        </View>
        <View style={{ width: desktop ? '24%' : '49%', backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginTop: 8 }}>
          <Text style={{ color: '#64748b' }}>القيمة الإجمالية</Text>
          <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 20, marginTop: 4 }}>{formatUSD(m.total)}</Text>
        </View>
        <View style={{ width: desktop ? '24%' : '49%', backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginTop: 8 }}>
          <Text style={{ color: '#64748b' }}>الأرباح/الخسائر</Text>
          <Text style={{ color: m.pnl >= 0 ? '#059669' : '#dc2626', fontWeight: '900', fontSize: 20, marginTop: 4 }}>{formatUSD(m.pnl)}</Text>
        </View>
      </View>
      <View style={{ marginTop: 12 }}>
        <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 18, textAlign: 'right' }}>المراكز</Text>
        <View style={{ marginTop: 8 }}>
          {p.positions.length === 0 && <Text style={{ color: '#64748b', textAlign: 'right' }}>لا توجد مراكز مفتوحة</Text>}
          {p.positions.map((pos) => {
            const lp = prices[pos.key] || 0;
            const value = lp * pos.qty;
            const pnl = (lp - pos.avg) * pos.qty;
            return (
              <View key={pos.key} style={{ borderWidth: 1, borderColor: '#e8eff1', borderRadius: 12, padding: 12, backgroundColor: '#ffffff', marginTop: 8 }}>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#0f172a', fontWeight: '900' }}>{funds[pos.key].ticker}</Text>
                  <Text style={{ color: '#0f172a' }}>{formatUSD(value)}</Text>
                </View>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={{ color: '#64748b' }}>الكمية: {pos.qty}</Text>
                  <Text style={{ color: '#64748b' }}>متوسط التكلفة: {formatUSD(pos.avg)}</Text>
                  <Text style={{ color: '#64748b' }}>السعر الحالي: {formatUSD(lp)}</Text>
                  <Text style={{ color: pnl >= 0 ? '#059669' : '#dc2626', fontWeight: '800' }}>{formatUSD(pnl)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
      <View style={{ marginTop: 14 }}>
        <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 18, textAlign: 'right' }}>أمر فوري</Text>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          {(['HLAL', 'SPUS', 'UMMA', 'SPTE'] as FundKey[]).map((k) => (
            <Pressable key={k} onPress={() => setSel(k)} style={{ backgroundColor: sel === k ? '#ecfdf5' : '#f8fafc', borderColor: sel === k ? '#10b981' : '#e2e8f0', borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, marginStart: 8, marginTop: 8 }}>
              <Text style={{ color: '#0f172a', fontWeight: '800' }}>{funds[k].ticker}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
          <TextInput value={qty} onChangeText={setQty} keyboardType="numeric" placeholder="الكمية" placeholderTextColor="#94a3b8" style={{ backgroundColor: '#f8fafc', color: '#0f172a', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', minWidth: 120, textAlign: 'right', marginStart: 8, marginTop: 8 }} />
          <View style={{ backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#99f6e4', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginStart: 8, marginTop: 8 }}>
            <Text style={{ color: '#0f766e', fontWeight: '700' }}>السعر السوقي: {formatUSD(price)}</Text>
          </View>
          <Pressable onPress={() => onOrder('buy', sel, parseFloat(qty || '0'), price)} style={({ pressed }) => [{ backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#10b981', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, marginStart: 8, marginTop: 8, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
            <Text style={{ color: '#065f46', fontWeight: '900' }}>شراء</Text>
          </Pressable>
          <Pressable onPress={() => onOrder('sell', sel, parseFloat(qty || '0'), price)} style={({ pressed }) => [{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, marginStart: 8, marginTop: 8, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
            <Text style={{ color: '#991b1b', fontWeight: '900' }}>بيع</Text>
          </Pressable>
        </View>
      </View>
      <View style={{ marginTop: 14 }}>
        <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 18, textAlign: 'right' }}>إدارة النقد</Text>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginTop: 8 }}>
          <TextInput defaultValue={String(p.cash)} keyboardType="numeric" onSubmitEditing={(e: any) => onSetCash(parseFloat(e?.nativeEvent?.text || '0') || 0)} style={{ backgroundColor: '#f8fafc', color: '#0f172a', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', minWidth: 160, textAlign: 'right' }} />
          <Text style={{ color: '#64748b', marginEnd: 10 }}>أدخل الرصيد واضغط Enter</Text>
        </View>
      </View>
      <View style={{ marginTop: 14 }}>
        <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 18, textAlign: 'right' }}>السجل</Text>
        <View style={{ marginTop: 8 }}>
          {p.trades.length === 0 && <Text style={{ color: '#64748b', textAlign: 'right' }}>لا توجد عمليات</Text>}
          {p.trades.slice(0, 10).map((t) => {
            const color = t.type === 'buy' ? '#059669' : '#dc2626';
            const rt = t.realized || 0;
            return (
              <View key={t.id} style={{ borderWidth: 1, borderColor: '#e8eff1', borderRadius: 12, padding: 10, backgroundColor: '#ffffff', marginTop: 8, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: '#0f172a' }}>{funds[t.key].ticker}</Text>
                <Text style={{ color }}> {t.type === 'buy' ? 'شراء' : 'بيع'} </Text>
                <Text style={{ color: '#0f172a' }}>كمية {t.qty}</Text>
                <Text style={{ color: '#0f172a' }}>{formatUSD(t.price)}</Text>
                <Text style={{ color: rt >= 0 ? '#059669' : '#dc2626' }}>{t.type === 'sell' ? formatUSD(rt) : ''}</Text>
                <Text style={{ color: '#64748b' }}>{new Date(t.ts).toLocaleString()}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
