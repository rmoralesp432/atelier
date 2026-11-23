"""Read-only aggregate of recorded campaign evidence; raw scores are never rewritten."""
import json, pathlib, statistics, collections
root=pathlib.Path('.cloud/workshop-campaign'); docs=pathlib.Path('docs/evaluations/workshop-campaign')
ledger=json.loads((root/'ledger.json').read_text()); rows=json.loads((docs/'campaign-boundaries.json').read_text())

def latency(xs):
    xs=sorted(xs)
    return {'n':len(xs),'medianSeconds':round(statistics.median(xs)/1000,2),'maxSeconds':round(max(xs)/1000,2)} if xs else {'n':0}

calls=ledger['calls']; counts=collections.Counter(r['status'] for r in rows)
s={
 'at':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
 'applicationChanged':False,'merged':False,'deployed':False,
 'calls':len(calls),'estimatedUSD':round(sum(c.get('estimatedUsd',0) for c in calls),6),
 'conservativeAccountedUSD':round(sum(c.get('accountedUsd',c['reservedUsd']) for c in calls),6),
 'inputTokens':sum(c.get('inputTokens',0) for c in calls),'outputTokens':sum(c.get('outputTokens',0) for c in calls),
 'unknownReservations':[dict(id=c['id'],caseId=c['caseId'],reservedUsd=c['reservedUsd'],outcome=c['outcome']) for c in calls if c['outcome']!='usage-reconciled'],
 'pricingBasis':'Estimated $2/M input and $10/M output, no cached-token discount. Secondary LiteLLM snapshot, not account invoice. Reservations use $4/$15 plus 25%. User authorized estimates. Auto-recharge not enabled or changed; its account setting cannot be independently read.',
 'rawStatusCounts':dict(counts),
 'rawScoringCaution':'Raw flags include retained evaluator interruptions, Float32 volume false flags, a sensible height-label update and a 0.5 mm placement difference. Do not interpret all COMMITTED_INCORRECT rows as material false acceptance. See README and individual facts.',
 'segments':{},'versions':{}
}
for key in sorted(set(c['caseId'].split('-baseline-')[0].split('-workshop-')[0].split('-verifier-')[0] for c in calls)):
    cs=[c for c in calls if c['caseId'].startswith(key+'-')]
    s['segments'][key]={'calls':len(cs),'estimatedUSD':round(sum(c.get('estimatedUsd',0) for c in cs),6)}
for version in ['baseline','workshop','verifier']:
    cs=[c for c in calls if c['version']==version]
    rs=[r for r in rows if r['version']==version]
    s['versions'][version]={'calls':len(cs),'estimatedUSD':round(sum(c.get('estimatedUsd',0) for c in cs),6),
      'reviewerLatency':latency([c['elapsedMs'] for c in cs if c['role']=='reviewer' and c.get('elapsedMs')]),
      'executorLatency':latency([c['elapsedMs'] for c in cs if c['role']=='executor' and c.get('elapsedMs')]),
      'completedTurnLatency':latency([r['elapsedMs'] for r in rs if r.get('elapsedMs') and r['status'] not in ['RUNNING','INTERRUPTED_OR_HARNESS_FAILURE']]),
      'committedRows':sum(bool(r.get('committed')) for r in rs),
      'committedHostUnverifiedRows':sum(bool(r.get('committed')) and r.get('hostStatus')=='unverified' for r in rs),
      'persistenceFailures':[r['id'] for r in rs if r.get('committed') and r.get('transaction') and not all(r['transaction'].values())],
      'inspectionCalls':sum(len(r['explicitSceneInspections']) for r in rs),
      'zeroMatchInspectionCalls':sum(i.get('resultRecorded',False) and i.get('matched')==0 for r in rs for i in r['explicitSceneInspections'])}
(docs/'SUMMARY.json').write_text(json.dumps(s,indent=2)+'\n')
print(json.dumps(s,indent=2))
