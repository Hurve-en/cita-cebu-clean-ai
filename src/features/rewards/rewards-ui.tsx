import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Text,View} from 'react-native';
import {useIsFocused} from 'expo-router';
import {useAuth} from '../auth/auth-state';
import {Button,Card,Copy,Heading,Message,Page,Section,ui} from '../resident/resident-ui';
import {createRewardsService} from './rewards-service';
import {rewardsStorage} from './rewards-local';
import {dateLabel,type Cursor} from '../resident/live-model';
import type {Cleanup,RewardTable,Rows} from './rewards-model';
export function ResidentRewards(){const {state}=useAuth();return state.user?<RewardsContent key={state.user.id}/>:null;}
function RewardsContent(){
 const auth=useAuth(),owner=auth.state.user!.id,focused=useIsFocused(),ready=auth.state.phase==='ready';
 const service=useMemo(()=>createRewardsService(auth.client!,rewardsStorage),[auth.client]);
 const [balance,setBalance]=useState<number|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const [info,setInfo]=useState<{enabled:boolean;awards:number;points:number;eventPoints:number;claimLimit:number}|null>(null);
 const generation=useRef(0);
 const invalidate=useCallback(()=>{++generation.current;},[]);
 const refresh=useCallback(async()=>{const n=++generation.current;setLoading(true);setError('');try{const [b,r,c]=await Promise.all([service.balance(owner),service.rules(owner),service.earningInfo(owner)]);if(n===generation.current){setBalance(b);setInfo({...c,eventPoints:r.cleanup_points,claimLimit:r.daily_claim_limit});}}catch(e){if(n===generation.current)setError(e instanceof Error?e.message:'Points could not be loaded.');}finally{if(n===generation.current)setLoading(false);}},[service,owner]);
 useEffect(()=>{let active=true;const run=()=>{if(active&&ready&&focused)void refresh();};if(ready&&focused)void Promise.resolve().then(run);const timer=ready&&focused?setInterval(run,30000):undefined;return()=>{active=false;if(timer)clearInterval(timer);invalidate();};},[ready,focused,refresh,invalidate]);
 return <View style={{flex:1,display:ready?'flex':'none'}}><Page title="Rewards" subtitle="Your current points" badge="Resident account">
  <View style={ui.hero}><Text style={[ui.eyebrow,{color:'#DEEDB8'}]}>AVAILABLE POINTS</Text><Text style={[ui.points,{color:'white'}]}>{balance??'—'}<Text style={{fontSize:18}}> pts</Text></Text></View>
  <Message error text={error}/>
  <Card><Heading>Two ways to earn</Heading>
   <View style={{gap:6,paddingVertical:8}}><Text style={{fontWeight:'700',color:'#245A38',fontSize:17}}>Independent action · 10 points</Text><Copy>Submit your saved photo from the scanner or History Reports. The backend awards points after automatic evidence checks pass.</Copy></View>
   <View style={{height:1,backgroundColor:'#DCE5DC'}}/>
   <View style={{gap:6,paddingVertical:8}}><Text style={{fontWeight:'700',color:'#245A38',fontSize:17}}>Barangay cleanup · larger rewards</Text><Copy>{info?`The default is ${info.eventPoints} points. Check your event for its exact reward.`:'Each event shows its reward.'} Points follow officer-confirmed participation, once per event.</Copy></View>
  </Card>
  <Card><Heading>How it works</Heading><Copy>1. Scan an item and save its photo.</Copy><Copy>2. Choose independent action or a joined event, then submit your details.</Copy><Copy>3. Check History Reports for the result. Your balance updates after points are awarded.</Copy></Card>
  <Copy>{info?`Independent actions: ${info.claimLimit} submissions per Philippine day, including rejected attempts. Up to ${info.awards} awards and ${info.points} points. `:''}Up to 10 new photo uploads per day. Reusing a photo does not earn more points. Saving a photo alone earns no points.</Copy>
  {info&&!info.enabled&&<Message text="Automatic verification is currently paused. Independent submissions stay pending until checks resume."/>}
  <Copy>AI screens visible evidence and obvious reuse. It cannot prove that a photo was never online or that a real-world disposal action occurred.</Copy>
  <Button secondary disabled={loading} label={loading?'Refreshing…':'Refresh points'} onPress={()=>{void refresh();}}/>
 </Page></View>;
}
type Service = ReturnType<typeof createRewardsService>;
function useRows<T extends RewardTable>(service: Service, owner: string, table: T) {
    const [rows, setRows] = useState<Rows[T][]>([]), [more, setMore] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState('');
    const sequence = useRef(0), rowsRef = useRef<Rows[T][]>([]), flight = useRef(false);
    const load = useCallback(async (append = false) => {
        if (flight.current)
            return;
        flight.current = true;
        const n = sequence.current;
        setLoading(true);
        setError('');
        try {
            const result = await service.list(owner, table, append ? rowsRef.current.at(-1) as Cursor : undefined);
            if (n !== sequence.current)
                return;
            const previous = append ? rowsRef.current : [], ids = new Set(previous.map(r => r.id));
            const next = [...previous, ...result.rows.filter(r => !ids.has(r.id))];
            rowsRef.current = next;
            setRows(next);
            setMore(result.more);
        }
        catch (e) {
            if (n === sequence.current)
                setError(e instanceof Error ? e.message : 'Could not load rewards.');
        }
        finally {
            flight.current = false;
            if (n === sequence.current)
                setLoading(false);
        }
    }, [service, owner, table]);
    const invalidate = useCallback(() => { ++sequence.current; }, []);
    useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active)
        return load(); }); return () => { active = false; invalidate(); rowsRef.current = []; }; }, [load, invalidate]);
    return { rows, error, loading, more, load };
}
function ListControls({ data }: {
    data: {
        error: string;
        loading: boolean;
        more: boolean;
        load: (more?: boolean) => Promise<void>;
    };
}) { return <><Message error text={data.error}/>{data.loading && <Copy>Loading…</Copy>}{data.more && <Button secondary disabled={data.loading} label="Load more" onPress={() => { void data.load(true); }}/>}<Button secondary disabled={data.loading} label="Refresh list" onPress={() => { void data.load(); }}/></>; }
export function CleanupList({ service, owner, busy, join }: {
    service: Service;
    owner: string;
    busy: boolean;
    join: (id: string) => Promise<boolean>;
}) {
    const data = useRows(service, owner, 'cleanup_events');
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
    return <><Section title="Community cleanups"/><Copy>Events follow your selected barangay. Registration alone does not earn points. Check your participation status in history.</Copy>
 {data.rows.map((e: Cleanup) => <Card key={e.id}><Heading>{e.title}</Heading><Text style={ui.badge}>{e.points} points after completion is verified</Text><Copy>{e.location}</Copy><Copy>{dateLabel(e.starts_at)} – {dateLabel(e.ends_at)}</Copy><Copy>{e.instructions}</Copy><Button disabled={busy || e.status !== 'published' || Date.parse(e.starts_at) <= now} label={e.status === 'cancelled' ? 'Cancelled' : Date.parse(e.starts_at) <= now ? 'Registration closed' : 'Join / confirm registration'} onPress={() => { void join(e.id); }}/></Card>)}
 {!data.loading && !data.error && !data.rows.length && <Copy>No cleanups are published for your community yet.</Copy>}<ListControls data={data}/></>;
}
