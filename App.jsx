import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

// ─── Simulated data engine ────────────────────────────────────────────────────
const CLIENTS = [
  { id: 1, name: "Meridian Logistics",  sector: "Transportation", revenue_tier: "mid",  since: "2019-03" },
  { id: 2, name: "Apex Dynamics",       sector: "Manufacturing",  revenue_tier: "high", since: "2018-07" },
  { id: 3, name: "NovaBuild Group",     sector: "Construction",   revenue_tier: "mid",  since: "2021-01" },
  { id: 4, name: "Clearwater Foods",    sector: "Food & Bev",     revenue_tier: "low",  since: "2022-06" },
  { id: 5, name: "Stratum Capital",     sector: "Finance",        revenue_tier: "high", since: "2017-11" },
  { id: 6, name: "Helix BioMed",        sector: "Healthcare",     revenue_tier: "mid",  since: "2020-04" },
];
const BASE_INFLOW  = { low: 180000, mid: 520000, high: 1400000 };
const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function seededRng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };
}
function genCashflow(clientId, months = 12) {
  const rng  = seededRng(clientId * 42 + 7);
  const base = BASE_INFLOW[CLIENTS.find(c => c.id === clientId).revenue_tier];
  const now  = new Date();
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const inflow  = Math.round(base * (1 + Math.sin((d.getMonth()/12)*2*Math.PI)*0.12 + (rng()-0.5)*0.12 + i*0.008));
    const outflow = Math.round(inflow * (0.68 + rng() * 0.16));
    return { month: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`, inflow, outflow, net: inflow - outflow };
  });
}
function genExpenses(clientId) {
  const rng = seededRng(clientId * 42 + 1007);
  const raw = [["Payroll",0.38+rng()*0.06],["Operations",0.16+rng()*0.06],["Marketing",0.08+rng()*0.06],["R&D",0.06+rng()*0.05],["Admin",0.04+rng()*0.04]];
  const total = raw.reduce((s,[,p])=>s+p,0);
  const r = raw.map(([cat,p])=>({category:cat,percentage:+(p/total*100).toFixed(1)}));
  r.push({category:"Other",percentage:+(100-r.reduce((s,x)=>s+x.percentage,0)).toFixed(1)});
  return r;
}
function deriveKpis(cf) {
  if (!cf.length) return null;
  const latest = cf[cf.length-1], prev = cf[cf.length-2] ?? latest;
  const total_revenue = cf.reduce((s,m)=>s+m.inflow,0);
  const total_expenses= cf.reduce((s,m)=>s+m.outflow,0);
  const net_profit    = total_revenue - total_expenses;
  return {
    total_revenue, total_expenses, net_profit,
    profit_margin:      +((net_profit/total_revenue)*100).toFixed(1),
    revenue_change_pct: +(((latest.inflow-prev.inflow)/Math.max(prev.inflow,1))*100).toFixed(1),
    expense_change_pct: +(((latest.outflow-prev.outflow)/Math.max(prev.outflow,1))*100).toFixed(1),
    burn_rate:          Math.round(latest.outflow/30),
    runway_days:        Math.round(net_profit/(latest.outflow/30||1)),
  };
}
function deriveAlerts(kpis) {
  if (!kpis) return [];
  const a = [];
  if (kpis.profit_margin     <  15) a.push({level:"warning",  msg:`Profit margin at ${kpis.profit_margin}% — below 15% threshold`});
  if (kpis.runway_days       <  90) a.push({level:"critical", msg:`Runway at ${kpis.runway_days} days — review burn rate immediately`});
  if (kpis.expense_change_pct > 8)  a.push({level:"warning",  msg:`Expenses up ${kpis.expense_change_pct}% MoM — investigate drivers`});
  if (kpis.revenue_change_pct > 10) a.push({level:"info",     msg:`Strong revenue growth: +${kpis.revenue_change_pct}% this month`});
  if (!a.length) a.push({level:"info", msg:"All metrics within normal operating ranges"});
  return a;
}

// ─── Manual entry helpers ─────────────────────────────────────────────────────
const EXPENSE_CATS = ["Payroll","Operations","Marketing","R&D","Admin","Other"];
function buildEmptyManual(months = 6) {
  const now = new Date();
  return Array.from({length: months}, (_,i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months-1-i), 1);
    return { month: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`, inflow:"", outflow:"" };
  });
}
function buildEmptyExpenses() {
  return EXPENSE_CATS.map(cat => ({ category: cat, percentage: "" }));
}
// Per-client manual data store (in-memory)
const manualStore = {};
function getManual(clientId) {
  if (!manualStore[clientId]) {
    manualStore[clientId] = { rows: buildEmptyManual(6), expenses: buildEmptyExpenses() };
  }
  return manualStore[clientId];
}

// ─── Formatting ────────────────────────────────────────────────────────────────
const fmt = {
  currency: (n, compact=false) => {
    if (compact) {
      if (Math.abs(n)>=1_000_000) return `$${(n/1_000_000).toFixed(1)}M`;
      if (Math.abs(n)>=1_000)     return `$${(n/1_000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n);
  },
  pct: n => `${n?.toFixed(1)}%`,
};

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = { teal:"#00E5C8", red:"#FF6B6B", yellow:"#FFD93D", purple:"#7B61FF" };
const PIE_COLORS = [C.teal, C.purple, C.yellow, C.red, "#4ECDC4", "#95E1D3"];

// ─── Shared UI components ──────────────────────────────────────────────────────
function KpiCard({ label, value, sub, trend, good=true }) {
  const up = trend > 0;
  const color = (up === good) ? C.teal : C.red;
  return (
    <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"18px 20px",display:"flex",flexDirection:"column",gap:5}}>
      <span style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.35)"}}>{label}</span>
      <span style={{fontSize:24,fontWeight:800,color:"#fff",lineHeight:1.1}}>{value}</span>
      <div style={{display:"flex",alignItems:"center",gap:5}}>
        {trend!==undefined && <span style={{fontSize:12,fontWeight:700,color}}>{up?"▲":"▼"} {Math.abs(trend).toFixed(1)}%</span>}
        {sub && <span style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>{sub}</span>}
      </div>
    </div>
  );
}
function AlertBadge({level,msg}) {
  const cfg={info:{bg:"rgba(0,229,200,0.07)",border:"rgba(0,229,200,0.22)",dot:C.teal,label:"INFO"},warning:{bg:"rgba(255,217,61,0.07)",border:"rgba(255,217,61,0.28)",dot:C.yellow,label:"WARN"},critical:{bg:"rgba(255,107,107,0.09)",border:"rgba(255,107,107,0.35)",dot:C.red,label:"CRIT"}}[level]??{};
  return (
    <div style={{display:"flex",gap:10,padding:"10px 13px",background:cfg.bg,border:`1px solid ${cfg.border}`,borderRadius:10}}>
      <span style={{fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:cfg.dot,background:`${cfg.dot}22`,padding:"2px 5px",borderRadius:4,flexShrink:0,alignSelf:"flex-start",marginTop:1}}>{cfg.label}</span>
      <span style={{fontSize:12,color:"rgba(255,255,255,0.72)",lineHeight:1.5}}>{msg}</span>
    </div>
  );
}
const ChartTip = ({active,payload,label}) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:"#161c2d",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"9px 13px",fontSize:12}}>
      <div style={{color:"rgba(255,255,255,0.4)",marginBottom:5}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color,display:"flex",justifyContent:"space-between",gap:16}}>
          <span style={{textTransform:"capitalize"}}>{p.name}</span>
          <span style={{fontWeight:700}}>{fmt.currency(p.value,true)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Manual Entry Panel ────────────────────────────────────────────────────────
function ManualEntryPanel({ clientId, onApply }) {
  const stored = getManual(clientId);
  const [rows,     setRows]     = useState(() => stored.rows.map(r=>({...r})));
  const [expenses, setExpenses] = useState(() => stored.expenses.map(e=>({...e})));
  const [tab,      setTab]      = useState("cashflow");
  const [saved,    setSaved]    = useState(false);

  // sync when client changes
  useEffect(() => {
    const s = getManual(clientId);
    setRows(s.rows.map(r=>({...r})));
    setExpenses(s.expenses.map(e=>({...e})));
    setSaved(false);
  }, [clientId]);

  function updateRow(i, field, val) {
    setRows(prev => prev.map((r,idx) => idx===i ? {...r, [field]: val} : r));
  }
  function updateExp(i, val) {
    setExpenses(prev => prev.map((e,idx) => idx===i ? {...e, percentage: val} : e));
  }
  function handleApply() {
    const parsed = rows.map(r => ({
      month:   r.month,
      inflow:  parseFloat(r.inflow)  || 0,
      outflow: parseFloat(r.outflow) || 0,
      net:     (parseFloat(r.inflow)||0) - (parseFloat(r.outflow)||0),
    }));
    const parsedExp = expenses.map(e => ({
      category:   e.category,
      percentage: parseFloat(e.percentage) || 0,
    }));
    // persist
    manualStore[clientId] = { rows: rows.map(r=>({...r})), expenses: expenses.map(e=>({...e})) };
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onApply(parsed, parsedExp);
  }

  const inputStyle = {
    background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
    borderRadius:7, padding:"7px 10px", color:"#fff", fontSize:12,
    fontFamily:"inherit", width:"100%", outline:"none",
  };
  const tabBtn = (id, label) => (
    <button onClick={() => setTab(id)} style={{
      padding:"6px 16px", borderRadius:7, border:"none", cursor:"pointer",
      fontFamily:"inherit", fontSize:12, fontWeight:600,
      background: tab===id ? C.teal : "rgba(255,255,255,0.07)",
      color:       tab===id ? "#000" : "rgba(255,255,255,0.5)",
      transition:"all .15s",
    }}>{label}</button>
  );

  return (
    <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid rgba(0,229,200,0.2)`,borderRadius:16,padding:22,display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div>
          <h2 style={{fontSize:15,fontWeight:700,margin:0}}>Manual Data Entry</h2>
          <p style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:3}}>Enter real financials — charts update instantly on Apply</p>
        </div>
        <div style={{display:"flex",gap:7}}>
          {tabBtn("cashflow","Cash Flow")}
          {tabBtn("expenses","Expenses")}
        </div>
      </div>

      {tab === "cashflow" && (
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr>
                {["Month","Revenue (Inflow)","Expenses (Outflow)","Net"].map(h=>(
                  <th key={h} style={{textAlign:"left",padding:"6px 10px",color:"rgba(255,255,255,0.35)",fontWeight:600,letterSpacing:"0.06em",fontSize:10,textTransform:"uppercase",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row,i) => {
                const net = (parseFloat(row.inflow)||0)-(parseFloat(row.outflow)||0);
                return (
                  <tr key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                    <td style={{padding:"8px 10px",color:"rgba(255,255,255,0.6)",whiteSpace:"nowrap"}}>{row.month}</td>
                    <td style={{padding:"6px 10px"}}>
                      <div style={{position:"relative"}}>
                        <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,0.3)",fontSize:11}}>$</span>
                        <input value={row.inflow} onChange={e=>updateRow(i,"inflow",e.target.value)}
                          placeholder="0" style={{...inputStyle, paddingLeft:20}} type="number" min="0"/>
                      </div>
                    </td>
                    <td style={{padding:"6px 10px"}}>
                      <div style={{position:"relative"}}>
                        <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,0.3)",fontSize:11}}>$</span>
                        <input value={row.outflow} onChange={e=>updateRow(i,"outflow",e.target.value)}
                          placeholder="0" style={{...inputStyle, paddingLeft:20}} type="number" min="0"/>
                      </div>
                    </td>
                    <td style={{padding:"8px 10px",fontWeight:700,color:net>=0?C.teal:C.red}}>
                      {row.inflow||row.outflow ? fmt.currency(net,true) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "expenses" && (
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <p style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginBottom:4}}>Enter percentage share for each category (should total ~100%)</p>
          {expenses.map((e,i) => (
            <div key={e.category} style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:8,height:8,borderRadius:2,background:PIE_COLORS[i%PIE_COLORS.length],flexShrink:0}}/>
              <span style={{width:90,fontSize:12,color:"rgba(255,255,255,0.6)"}}>{e.category}</span>
              <div style={{position:"relative",flex:1}}>
                <input value={e.percentage} onChange={ev=>updateExp(i,ev.target.value)}
                  placeholder="0" style={{...inputStyle}} type="number" min="0" max="100"/>
                <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,0.3)",fontSize:11}}>%</span>
              </div>
            </div>
          ))}
          <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:4}}>
            Total: <span style={{
              color: Math.abs(expenses.reduce((s,e)=>s+(parseFloat(e.percentage)||0),0)-100)<1 ? C.teal : C.yellow,
              fontWeight:700
            }}>{expenses.reduce((s,e)=>s+(parseFloat(e.percentage)||0),0).toFixed(1)}%</span>
          </div>
        </div>
      )}

      <div style={{display:"flex",alignItems:"center",gap:10,marginTop:4}}>
        <button onClick={handleApply} style={{
          padding:"9px 24px",borderRadius:9,border:"none",cursor:"pointer",
          background:`linear-gradient(135deg,${C.teal},${C.purple})`,
          color:"#000",fontSize:13,fontWeight:800,fontFamily:"inherit",
        }}>
          Apply to Dashboard
        </button>
        {saved && <span style={{fontSize:12,color:C.teal,fontWeight:600}}>✓ Applied!</span>}
        <span style={{fontSize:11,color:"rgba(255,255,255,0.25)",marginLeft:"auto"}}>
          Data stays in session — not sent anywhere
        </span>
      </div>
    </div>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────
function CashflowChart({ cf, months }) {
  return (
    <div className="panel">
      <div style={{marginBottom:16}}>
        <h2 style={{fontSize:15,fontWeight:700}}>Cash Flow</h2>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:2}}>Last {months} months · Inflow vs Outflow</p>
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <AreaChart data={cf} margin={{top:4,right:4,left:-10,bottom:0}}>
          <defs>
            <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.teal} stopOpacity={0.22}/>
              <stop offset="95%" stopColor={C.teal} stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="go" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.red} stopOpacity={0.18}/>
              <stop offset="95%" stopColor={C.red} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
          <XAxis dataKey="month" tick={{fill:"rgba(255,255,255,0.26)",fontSize:10}} tickFormatter={v=>v.split(" ")[0]} interval={months<=12?1:3}/>
          <YAxis tick={{fill:"rgba(255,255,255,0.26)",fontSize:10}} tickFormatter={v=>fmt.currency(v,true)}/>
          <Tooltip content={<ChartTip/>}/>
          <Legend wrapperStyle={{fontSize:12,color:"rgba(255,255,255,0.36)"}}/>
          <Area type="monotone" dataKey="inflow"  stroke={C.teal} strokeWidth={2} fill="url(#gi)" name="inflow"  dot={false}/>
          <Area type="monotone" dataKey="outflow" stroke={C.red}  strokeWidth={2} fill="url(#go)" name="outflow" dot={false}/>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
function ExpensePie({ expenses }) {
  return (
    <div className="panel">
      <div style={{marginBottom:14}}>
        <h2 style={{fontSize:15,fontWeight:700}}>Expense Mix</h2>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:2}}>By category</p>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <PieChart>
          <Pie data={expenses} dataKey="percentage" nameKey="category" cx="50%" cy="50%" innerRadius={38} outerRadius={60} strokeWidth={0} paddingAngle={2}>
            {expenses.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
          </Pie>
          <Tooltip formatter={v=>`${v}%`} contentStyle={{background:"#161c2d",border:"1px solid rgba(255,255,255,0.09)",borderRadius:8,fontSize:11}}/>
        </PieChart>
      </ResponsiveContainer>
      <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:5}}>
        {expenses.map((e,i)=>(
          <div key={e.category} style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:11}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:6,height:6,borderRadius:2,background:PIE_COLORS[i%PIE_COLORS.length],flexShrink:0}}/>
              <span style={{color:"rgba(255,255,255,0.48)"}}>{e.category}</span>
            </div>
            <span style={{color:"rgba(255,255,255,0.78)",fontWeight:700}}>{e.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function NetProfitBar({ cf, months }) {
  return (
    <div className="panel">
      <div style={{marginBottom:16}}>
        <h2 style={{fontSize:15,fontWeight:700}}>Net Profit Trend</h2>
        <p style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:2}}>Monthly — teal = profitable, red = loss</p>
      </div>
      <ResponsiveContainer width="100%" height={155}>
        <BarChart data={cf} margin={{top:4,right:4,left:-10,bottom:0}}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
          <XAxis dataKey="month" tick={{fill:"rgba(255,255,255,0.26)",fontSize:10}} tickFormatter={v=>v.split(" ")[0]} interval={months<=12?1:3}/>
          <YAxis tick={{fill:"rgba(255,255,255,0.26)",fontSize:10}} tickFormatter={v=>fmt.currency(v,true)}/>
          <Tooltip content={<ChartTip/>}/>
          <Bar dataKey="net" name="net profit" radius={[4,4,0,0]}>
            {cf.map((row,i)=><Cell key={i} fill={row.net>=0?C.teal:C.red} fillOpacity={0.85}/>)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function BizPulse() {
  const [active,     setActive]     = useState(CLIENTS[0]);
  const [months,     setMonths]     = useState(12);
  const [dataSource, setDataSource] = useState("simulated"); // "simulated" | "manual"
  const [cf,         setCf]         = useState([]);
  const [kpis,       setKpis]       = useState(null);
  const [expenses,   setExp]        = useState([]);
  const [alerts,     setAlerts]     = useState([]);
  const [collapsed,  setCollapsed]  = useState(false);

  const loadSimulated = useCallback((client, m) => {
    const cashflow = genCashflow(client.id, m);
    const exps     = genExpenses(client.id);
    const k        = deriveKpis(cashflow);
    setCf(cashflow);
    setExp(exps);
    setKpis(k);
    setAlerts(deriveAlerts(k));
  }, []);

  // Switch data source or client
  useEffect(() => {
    if (dataSource === "simulated") {
      loadSimulated(active, months);
    } else {
      // load whatever was previously applied for this client
      const stored = getManual(active.id);
      const parsed = stored.rows.map(r => ({
        month:   r.month,
        inflow:  parseFloat(r.inflow)  || 0,
        outflow: parseFloat(r.outflow) || 0,
        net:     (parseFloat(r.inflow)||0)-(parseFloat(r.outflow)||0),
      }));
      const parsedExp = stored.expenses.map(e => ({
        category:   e.category,
        percentage: parseFloat(e.percentage)||0,
      }));
      const k = deriveKpis(parsed.some(r=>r.inflow>0) ? parsed : []);
      setCf(parsed);
      setExp(parsedExp);
      setKpis(k);
      setAlerts(deriveAlerts(k));
    }
  }, [active, months, dataSource, loadSimulated]);

  function handleManualApply(parsedCf, parsedExp) {
    const k = deriveKpis(parsedCf);
    setCf(parsedCf);
    setExp(parsedExp);
    setKpis(k);
    setAlerts(deriveAlerts(k));
  }

  const portRevenue = CLIENTS.reduce((s,c)=>s+deriveKpis(genCashflow(c.id)).total_revenue,0);
  const hasManualData = dataSource==="manual" && cf.some(r=>r.inflow>0);

  return (
    <div style={{display:"flex",height:"100vh",background:"#0d1117",color:"#fff",fontFamily:"'DM Sans',system-ui,sans-serif",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px}
        .cbtn{width:100%;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:9px;text-align:left;transition:all .15s;padding:8px 16px;border-left:2px solid transparent}
        .cbtn:hover{background:rgba(255,255,255,0.04)}
        .cbtn.on{background:rgba(0,229,200,0.07);border-left-color:#00E5C8}
        .panel{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:22px}
        input[type=number]::-webkit-inner-spin-button{opacity:0}
        input:focus{border-color:rgba(0,229,200,0.4) !important;box-shadow:0 0 0 2px rgba(0,229,200,0.1)}
      `}</style>

      {/* Sidebar */}
      <aside style={{width:collapsed?56:222,flexShrink:0,borderRight:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",transition:"width .25s ease",overflow:"hidden"}}>
        <div style={{padding:"18px 14px 12px",display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:28,height:28,borderRadius:7,background:`linear-gradient(135deg,${C.teal},${C.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:"#000",flexShrink:0}}>B</div>
          {!collapsed && <span style={{fontSize:14,fontWeight:800,letterSpacing:"-0.02em",whiteSpace:"nowrap"}}>Biz<span style={{color:C.teal}}>Pulse</span></span>}
          <button onClick={()=>setCollapsed(o=>!o)} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.22)",fontSize:11,flexShrink:0}}>
            {collapsed?"▶":"◀"}
          </button>
        </div>

        {!collapsed && (
          <div style={{margin:"0 10px 12px",padding:"11px 13px",background:`linear-gradient(135deg,rgba(0,229,200,0.08),rgba(123,97,255,0.08))`,border:`1px solid rgba(0,229,200,0.17)`,borderRadius:11}}>
            <div style={{fontSize:9,letterSpacing:"0.12em",color:"rgba(255,255,255,0.3)",textTransform:"uppercase",marginBottom:3}}>Portfolio Revenue</div>
            <div style={{fontSize:18,fontWeight:800,color:C.teal}}>{fmt.currency(portRevenue,true)}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.25)",marginTop:2}}>{CLIENTS.length} active clients</div>
          </div>
        )}

        <div style={{flex:1,overflowY:"auto"}}>
          {!collapsed && <div style={{fontSize:9,fontWeight:800,letterSpacing:"0.14em",color:"rgba(255,255,255,0.2)",padding:"0 16px 7px",textTransform:"uppercase"}}>Clients</div>}
          {CLIENTS.map(c => {
            const on = c.id===active.id;
            return (
              <button key={c.id} className={`cbtn${on?" on":""}`} onClick={()=>setActive(c)}
                style={{padding:collapsed?"9px":"8px 16px",justifyContent:collapsed?"center":"flex-start"}}>
                <div style={{width:24,height:24,borderRadius:6,background:on?`${C.teal}22`:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:on?C.teal:"rgba(255,255,255,0.32)",flexShrink:0}}>
                  {c.name.charAt(0)}
                </div>
                {!collapsed && (
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:on?"#fff":"rgba(255,255,255,0.48)",whiteSpace:"nowrap"}}>{c.name}</div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.24)"}}>{c.sector}</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {!collapsed && <div style={{padding:"12px 16px",borderTop:"1px solid rgba(255,255,255,0.05)",fontSize:10,color:"rgba(255,255,255,0.15)"}}>BizPulse v1.0 · 2025</div>}
      </aside>

      {/* Main */}
      <main style={{flex:1,overflowY:"auto",padding:"22px 26px",display:"flex",flexDirection:"column",gap:20}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:800,letterSpacing:"-0.02em"}}>{active.name}</h1>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.36)",marginTop:3}}>
              {active.sector} · Client since {active.since} · Tier: <span style={{color:C.teal,fontWeight:700}}>{active.revenue_tier.toUpperCase()}</span>
            </p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            {/* Data source toggle */}
            <div style={{display:"flex",alignItems:"center",background:"rgba(255,255,255,0.06)",borderRadius:10,padding:3,gap:2}}>
              {[["simulated","Simulated"],["manual","Manual Entry"]].map(([id,label])=>(
                <button key={id} onClick={()=>setDataSource(id)} style={{
                  padding:"5px 13px",borderRadius:8,border:"none",cursor:"pointer",
                  fontFamily:"inherit",fontSize:11,fontWeight:700,transition:"all .15s",
                  background: dataSource===id ? (id==="manual"?`linear-gradient(135deg,${C.teal},${C.purple})`:"rgba(255,255,255,0.12)") : "none",
                  color:       dataSource===id ? (id==="manual"?"#000":"#fff") : "rgba(255,255,255,0.4)",
                }}>{label}</button>
              ))}
            </div>
            {/* Range selector (simulated only) */}
            {dataSource==="simulated" && (
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>Range:</span>
                {[6,12,24].map(m=>(
                  <button key={m} onClick={()=>setMonths(m)} style={{
                    padding:"5px 12px",borderRadius:7,border:"none",cursor:"pointer",
                    fontFamily:"inherit",fontSize:12,fontWeight:700,transition:"all .15s",
                    background:months===m?C.teal:"rgba(255,255,255,0.07)",
                    color:months===m?"#000":"rgba(255,255,255,0.5)",
                  }}>{m}M</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Manual entry mode banner */}
        {dataSource==="manual" && !hasManualData && (
          <div style={{background:"rgba(0,229,200,0.06)",border:"1px solid rgba(0,229,200,0.2)",borderRadius:12,padding:"12px 18px",fontSize:13,color:"rgba(255,255,255,0.6)"}}>
            <span style={{color:C.teal,fontWeight:700}}>Manual Entry mode active.</span> Fill in the form below and click <strong style={{color:"#fff"}}>Apply to Dashboard</strong> — charts and KPIs will update with your real figures.
          </div>
        )}

        {/* Manual entry form */}
        {dataSource==="manual" && (
          <ManualEntryPanel clientId={active.id} onApply={handleManualApply}/>
        )}

        {/* KPIs */}
        {kpis && (dataSource==="simulated" || hasManualData) && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:11}}>
            <KpiCard label="Annual Revenue"  value={fmt.currency(kpis.total_revenue,true)}  trend={kpis.revenue_change_pct}  sub="vs prev month" good={true}/>
            <KpiCard label="Annual Expenses" value={fmt.currency(kpis.total_expenses,true)} trend={kpis.expense_change_pct} sub="vs prev month" good={false}/>
            <KpiCard label="Net Profit"      value={fmt.currency(kpis.net_profit,true)}/>
            <KpiCard label="Profit Margin"   value={fmt.pct(kpis.profit_margin)} sub={kpis.profit_margin>=15?"healthy ✓":"⚠ below target"}/>
            <KpiCard label="Daily Burn"      value={fmt.currency(kpis.burn_rate,true)} sub="/ day"/>
            <KpiCard label="Runway"          value={`${kpis.runway_days}d`} sub={kpis.runway_days>180?"stable":"watch closely"}/>
          </div>
        )}

        {/* Charts — only show when there's data */}
        {(dataSource==="simulated" || hasManualData) && (
          <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 290px",gap:16}}>
              <CashflowChart cf={cf} months={dataSource==="simulated"?months:cf.length}/>
              <ExpensePie expenses={expenses}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 290px",gap:16}}>
              <NetProfitBar cf={cf} months={dataSource==="simulated"?months:cf.length}/>
              <div className="panel" style={{display:"flex",flexDirection:"column"}}>
                <div style={{marginBottom:14}}>
                  <h2 style={{fontSize:15,fontWeight:700}}>Alerts</h2>
                  <p style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:2}}>Auto-generated from current metrics</p>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8,flex:1}}>
                  {alerts.map((a,i)=><AlertBadge key={i} {...a}/>)}
                </div>
              </div>
            </div>
          </>
        )}

        <div style={{textAlign:"center",fontSize:10,color:"rgba(255,255,255,0.12)",paddingBottom:4}}>
          BizPulse · Commercial Client Dashboard 2025 · {dataSource==="manual"?"Manual Entry Mode":"Simulated Data Mode"}
        </div>
      </main>
    </div>
  );
}
