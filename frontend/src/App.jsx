import { useEffect, useState } from "react";
import { api } from "./api";

const INTERESTS = ["food", "sightseeing", "culture", "adventure", "nature", "nightlife", "shopping", "relaxation"];
const TYPE_LABEL = { attraction: "Sight", dining: "Eat", experience: "Do", transport: "Move", rest: "Rest" };

const money = (n, cur) => new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "USD", maximumFractionDigits: 0 }).format(n || 0);
const dayCost = (d) => d.activities.reduce((s, a) => s + (Number(a.cost) || 0), 0);
function tripCost(it) {
  const nights = Math.max(0, it.days.length - 1);
  return it.days.reduce((s, d) => s + dayCost(d), 0) + nights * (Number(it.accommodation?.cost_per_night) || 0);
}

export default function App() {
  const [view, setView] = useState(() => (location.hash.startsWith("#trip=") ? "trip" : "dashboard"));
  const [tripId, setTripId] = useState(() => location.hash.replace("#trip=", "") || null);

  const go = (v, id = null) => {
    setView(v);
    setTripId(id);
    location.hash = id ? `trip=${id}` : "";
  };

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">Wayfinder</div>
        <nav>
          <button className={view === "dashboard" ? "on" : ""} onClick={() => go("dashboard")}>My trips</button>
          <button className={view === "new" ? "on" : ""} onClick={() => go("new")}>Plan a trip</button>
        </nav>
      </aside>
      <main className="main">
        {view === "dashboard" && <Dashboard onOpen={(id) => go("trip", id)} onNew={() => go("new")} />}
        {view === "new" && <Builder onDone={(id) => go("trip", id)} />}
        {view === "trip" && <Trip id={tripId} onBack={() => go("dashboard")} />}
      </main>
    </div>
  );
}

function Dashboard({ onOpen, onNew }) {
  const [trips, setTrips] = useState(null);
  const [err, setErr] = useState("");
  const load = () => api.list().then(setTrips).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  if (err) return <p className="error">Could not load trips: {err}. Is the backend running on port 8000?</p>;
  if (!trips) return <p className="muted">Loading your trips…</p>;

  return (
    <>
      <header className="head">
        <h1>My trips</h1>
        <button className="primary" onClick={onNew}>Plan a trip</button>
      </header>
      {trips.length === 0 ? (
        <div className="empty">
          <h2>No trips yet</h2>
          <p>Tell us where you’re going and what you like. You’ll get a day-by-day plan in seconds.</p>
          <button className="primary" onClick={onNew}>Plan your first trip</button>
        </div>
      ) : (
        <div className="grid">
          {trips.map((t) => (
            <article key={t.id} className="trip-card" onClick={() => onOpen(t.id)}>
              <h3>{t.request.destination}</h3>
              <p className="muted">{t.request.start_date} to {t.request.end_date}</p>
              <p>{t.itinerary.days.length} days · {t.request.travelers} traveler{t.request.travelers > 1 ? "s" : ""}</p>
              <p className="cost">Est. {money(tripCost(t.itinerary), t.request.currency)} of {money(t.request.budget, t.request.currency)}</p>
              <button className="link danger" onClick={(e) => { e.stopPropagation(); if (confirm("Delete this trip?")) api.remove(t.id).then(load); }}>Delete</button>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function Builder({ onDone }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({
    destination: "", start_date: today, end_date: today, budget: 1000, currency: "USD", travelers: 1,
    trip_type: "solo", pace: "balanced", accommodation_level: "mid-range", interests: ["food", "sightseeing"], notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggle = (i) => set("interests", f.interests.includes(i) ? f.interests.filter((x) => x !== i) : [...f.interests, i]);
  const setType = (t) => setF((p) => ({ ...p, trip_type: t, travelers: t === "solo" ? 1 : t === "couple" ? 2 : Math.max(3, p.travelers) }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const trip = await api.generate({ ...f, budget: Number(f.budget), travelers: Number(f.travelers) });
      onDone(trip.id);
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }

  return (
    <>
      <header className="head"><h1>Plan a trip</h1></header>
      <form className="builder" onSubmit={submit}>
        <label className="wide">Destination
          <input required placeholder="Lisbon, Portugal" value={f.destination} onChange={(e) => set("destination", e.target.value)} />
        </label>
        <label>Start date<input type="date" required value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></label>
        <label>End date<input type="date" required min={f.start_date} value={f.end_date} onChange={(e) => set("end_date", e.target.value)} /></label>
        <label>Total budget
          <div className="row">
            <input type="number" min="1" required value={f.budget} onChange={(e) => set("budget", e.target.value)} />
            <select value={f.currency} onChange={(e) => set("currency", e.target.value)}>{["USD", "EUR", "GBP", "INR", "JPY", "AUD"].map((c) => <option key={c}>{c}</option>)}</select>
          </div>
        </label>
        <label>Travelers<input type="number" min="1" max="30" value={f.travelers} onChange={(e) => set("travelers", e.target.value)} /></label>

        <fieldset className="wide"><legend>Who is going</legend>
          <div className="seg">{[["solo", "Solo"], ["couple", "Couple"], ["group", "Friends or family"]].map(([v, l]) =>
            <button type="button" key={v} className={f.trip_type === v ? "on" : ""} onClick={() => setType(v)}>{l}</button>)}</div>
        </fieldset>
        <fieldset><legend>Pace</legend>
          <div className="seg">{["relaxed", "balanced", "packed"].map((v) =>
            <button type="button" key={v} className={f.pace === v ? "on" : ""} onClick={() => set("pace", v)}>{v}</button>)}</div>
        </fieldset>
        <fieldset><legend>Stay</legend>
          <div className="seg">{["budget", "mid-range", "premium"].map((v) =>
            <button type="button" key={v} className={f.accommodation_level === v ? "on" : ""} onClick={() => set("accommodation_level", v)}>{v}</button>)}</div>
        </fieldset>
        <fieldset className="wide"><legend>Interests</legend>
          <div className="chips">{INTERESTS.map((i) =>
            <button type="button" key={i} className={f.interests.includes(i) ? "chip on" : "chip"} onClick={() => toggle(i)}>{i}</button>)}</div>
        </fieldset>
        <label className="wide">Anything else?
          <textarea rows="3" placeholder="Vegetarian, travelling with a toddler, want a sunrise hike…" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </label>
        {err && <p className="error wide">{err}</p>}
        <div className="wide"><button className="primary" disabled={busy}>{busy ? "Building your itinerary…" : "Generate itinerary"}</button></div>
      </form>
    </>
  );
}

function Trip({ id, onBack }) {
  const [trip, setTrip] = useState(null);
  const [active, setActive] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => { api.get(id).then(setTrip).catch((e) => setMsg(e.message)); }, [id]);
  if (!trip) return <p className={msg ? "error" : "muted"}>{msg || "Loading trip…"}</p>;

  const it = trip.itinerary, cur = trip.request.currency;
  const day = it.days.find((d) => d.day === active) || it.days[0];
  const total = tripCost(it), over = total > trip.request.budget;

  const edit = (fn) => { const next = structuredClone(it); fn(next.days.find((d) => d.day === day.day)); setTrip({ ...trip, itinerary: next }); setDirty(true); };
  const setAct = (i, k, v) => edit((d) => { d.activities[i][k] = k === "cost" ? Number(v) : v; });

  async function save() {
    setBusy("save");
    try { const t = await api.save(trip.id, trip.itinerary, trip.title); setTrip(t); setDirty(false); setMsg("Saved"); }
    catch (e) { setMsg(e.message); } finally { setBusy(""); }
  }
  async function regen() {
    const feedback = prompt(`What should change on day ${day.day}? (optional)`, "");
    if (feedback === null) return;
    setBusy("regen");
    try { setTrip(await api.regenDay(trip.id, day.day, feedback)); setDirty(false); setMsg(`Day ${day.day} regenerated`); }
    catch (e) { setMsg(e.message); } finally { setBusy(""); }
  }
  function share() {
    navigator.clipboard.writeText(`${location.origin}${location.pathname}#trip=${trip.id}`);
    setMsg("Link copied. Anyone with it can view and edit this trip.");
  }

  return (
    <>
      <button className="link" onClick={onBack}>Back to my trips</button>
      <header className="head">
        <div>
          <h1>{trip.request.destination}</h1>
          <p className="muted">{trip.request.start_date} to {trip.request.end_date} · {trip.request.travelers} traveler{trip.request.travelers > 1 ? "s" : ""}</p>
        </div>
        <div className="row">
          <button onClick={share}>Copy share link</button>
          <button className="primary" disabled={!dirty || busy} onClick={save}>{busy === "save" ? "Saving…" : "Save changes"}</button>
        </div>
      </header>
      {msg && <p className="notice" role="status">{msg}</p>}
      <p className="summary">{it.summary}</p>

      <section className="stats">
        <div><span className="muted">Estimated total</span><strong className={over ? "over" : ""}>{money(total, cur)}</strong></div>
        <div><span className="muted">Budget</span><strong>{money(trip.request.budget, cur)}</strong></div>
        <div><span className="muted">Stay</span><strong>{it.accommodation?.name}</strong><small>{money(it.accommodation?.cost_per_night, cur)} per night</small></div>
      </section>
      {over && <p className="error">This plan is {money(total - trip.request.budget, cur)} over budget. Edit costs or regenerate a day.</p>}

      <div className="tabs" role="tablist">
        {it.days.map((d) => <button key={d.day} role="tab" aria-selected={d.day === day.day} className={d.day === day.day ? "on" : ""} onClick={() => setActive(d.day)}>Day {d.day}</button>)}
      </div>

      <section className="day">
        <div className="day-head">
          <div><h2>{day.theme}</h2><p className="muted">{day.date} · {money(dayCost(day), cur)}</p></div>
          <button disabled={!!busy} onClick={regen}>{busy === "regen" ? "Regenerating…" : "Regenerate this day"}</button>
        </div>
        <ol className="timeline">
          {day.activities.map((a, i) => (
            <li key={i} className={`act t-${a.type}`}>
              <input className="time" value={a.time} onChange={(e) => setAct(i, "time", e.target.value)} aria-label="Time" />
              <div className="body">
                <div className="row between">
                  <input className="title" value={a.title} onChange={(e) => setAct(i, "title", e.target.value)} aria-label="Title" />
                  <span className="tag">{TYPE_LABEL[a.type] || a.type}</span>
                </div>
                <p>{a.description}</p>
                <p className="muted">{a.location} · {a.duration}</p>
              </div>
              <div className="side-col">
                <input className="cost" type="number" min="0" value={a.cost} onChange={(e) => setAct(i, "cost", e.target.value)} aria-label="Cost" />
                <button className="link danger" onClick={() => edit((d) => d.activities.splice(i, 1))}>Remove</button>
              </div>
            </li>
          ))}
        </ol>
        <button onClick={() => edit((d) => d.activities.push({ time: "12:00", title: "New activity", type: "experience", description: "Add details", location: "", duration: "1h", cost: 0 }))}>Add activity</button>
      </section>

      {it.transport_tips?.length > 0 && (
        <section className="tips"><h3>Getting around</h3><ul>{it.transport_tips.map((t, i) => <li key={i}>{t}</li>)}</ul></section>
      )}
    </>
  );
}
