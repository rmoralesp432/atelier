"""Publish immutable raw evaluation artifacts and cost summaries, without altering scores."""
import json, pathlib, sys, statistics, tarfile, re, os
root=pathlib.Path('/workspace/atelier-campaign/.cloud/workshop-campaign')
batch=sys.argv[1];out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
rows=json.loads((root/batch/'results.json').read_text());assert all(r['status']!='RUNNING' for r in rows)
ledger=json.loads((root/'ledger.json').read_text());calls=[c for c in ledger['calls']if c['caseId'].startswith(batch+'-')]
summary={'batch':batch,'results':[{k:r.get(k)for k in ['id','commit','status','diagnostic','committed','componentCount','elapsedMs','transaction']}for r in rows], 'calls':len(calls),'estimatedUSD':sum(c.get('estimatedUsd',0)for c in calls),'conservativeAccountedUSD':sum(c.get('accountedUsd',c['reservedUsd'])for c in calls),'unknownReservations':[{k:c.get(k)for k in ['id','caseId','outcome','reservedUsd']}for c in calls if c['outcome']!='usage-reconciled'],'pricing':'Approved estimates, not invoice; see pricing.json. Actual provider token usage retained.'}
for role in ['executor','reviewer']:
 times=[c['elapsedMs']for c in calls if c['role']==role and c.get('elapsedMs')is not None]
 summary[role]={'calls':len(times),'medianMs':statistics.median(times)if times else None,'maxMs':max(times)if times else None}
(out/(batch+'-summary.json')).write_text(json.dumps(summary,indent=2)+'\n')
(out/(batch+'-ledger.json')).write_text(json.dumps(ledger,indent=2)+'\n')
files=list((root/batch).glob('*'))+[root/'calls'/(c['id']+suffix)for c in calls for suffix in ['-request.json','-response.json']if (root/'calls'/(c['id']+suffix)).exists()]
keys=[os.environ[k]for k in ['ATELIER_OPENAI_API_KEY','ATELIER_RENDER_API_KEY']if len(os.environ.get(k,''))>12]
for p in files:
 if p.suffix=='.json':
  text=p.read_text();assert all(k not in text for k in keys),'Credential in artifact'
  assert not re.search(r'(?<![A-Za-z0-9_-])sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}',text),'Credential-like field requires inspection'
with tarfile.open(out/(batch+'-evidence.tar.gz'),'w:gz')as tar:
 for p in files:tar.add(p,arcname=str(p.relative_to(root)))
print(json.dumps({k:v for k,v in summary.items()if k!='results'},indent=2))
