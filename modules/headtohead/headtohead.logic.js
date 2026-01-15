
export function computeHeadToHead(results, filters, riders) {
  const VALID_RUNS = ['FINAL A', 'EINDKLASSEMENT', 'OVERALL'];

  const filtered = results.filter(r =>
    riders.includes(r.Naam) &&
    VALID_RUNS.includes(String(r.Run).toUpperCase()) &&
    filters.tournaments.includes(r.Wedstrijd) &&
    filters.distances.includes(r.Afstand) &&
    filters.seasons.includes(r.Seizoen)
  );

  const byRider = {};
  riders.forEach(r => {
    byRider[r] = filtered.filter(x => x.Naam === r);
  });

  const podium = {};
  riders.forEach(r => {
    podium[r] = { goud: 0, zilver: 0, brons: 0 };
    byRider[r].forEach(x => {
      if (x.Pos === 1) podium[r].goud++;
      if (x.Pos === 2) podium[r].zilver++;
      if (x.Pos === 3) podium[r].brons++;
    });
  });

  const wins = {};
  riders.forEach(r => wins[r] = 0);
  let sharedCount = 0;

  const grouped = {};
  filtered.forEach(x => {
    const key = `${x.Wedstrijd}-${x.Seizoen}-${x.Afstand}-${x.Run}`;
    grouped[key] = grouped[key] || [];
    grouped[key].push(x);
  });

  Object.values(grouped).forEach(group => {
    if (group.length >= 2) {
      sharedCount++;
      const sorted = [...group].sort((a,b) => a.Pos - b.Pos);
      wins[sorted[0].Naam]++;
    }
  });

  return { podium, wins, sharedCount };
}
