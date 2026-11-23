"""Read-only analysis of frozen campaign outputs; never supplies inputs to AI."""
import json
import pathlib
import sys

root = pathlib.Path('.cloud/workshop-campaign')
docs = pathlib.Path('docs/evaluations/workshop-campaign')
ledger = json.loads((root / 'ledger.json').read_text())
rows = []
for path in sorted(root.glob('*/results.json')):
    if path.parent.name.startswith('preflight'):
        continue
    for r in json.loads(path.read_text()):
        calls = [c for c in ledger['calls'] if c['caseId'] == r['id']]
        inspections, tool_names, calculations = [], [], []
        for c in calls:
            response_path = root / 'calls' / (c['id'] + '-response.json')
            if not response_path.exists():
                continue
            response = json.loads(response_path.read_text())
            for output in response.get('output', []):
                if output.get('type') != 'function_call':
                    continue
                tool_names.append(output['name'])
                if output['name'] == 'inspect_scene':
                    inspections.append({'call': c['id'], 'arguments': json.loads(output['arguments'])})
        for e in r.get('events', []):
            if e['kind'] == 'reviewer':
                for check in (e.get('response') or {}).get('checks', []):
                    if check.get('calculation'):
                        calculations.append({'requirement': check.get('requirement'), 'calculation': check['calculation']})
        repairs = [e['input'].get('validationFeedback') for e in r.get('events', [])
                   if e['kind'] == 'executor' and e['input'].get('validationFeedback', {}).get('verification')]
        row = {k: r.get(k) for k in ['id', 'version', 'task', 'edit', 'diagnostic', 'negative', 'status', 'committed', 'componentCount', 'changedIds', 'preservedIds', 'transaction', 'elapsedMs', 'error']}
        row.update({
            'explicitSceneInspections': inspections,
            'toolNames': tool_names,
            'repairFeedback': repairs,
            'independentCalculations': calculations,
            'hostStatus': r.get('hostReplay', {}).get('status'),
            'hostCanCommit': r.get('hostReplay', {}).get('canCommit'),
            'externalFailedChecks': [f for f in r.get('facts', []) if f['status'] != 'verified'],
            'externalVerifiedCheckCount': sum(f['status'] == 'verified' for f in r.get('facts', [])),
            'calls': len(calls),
            'estimatedUSD': sum(c.get('estimatedUsd', 0) for c in calls),
            'reviewerMs': sum(c.get('elapsedMs', 0) for c in calls if c['role'] == 'reviewer'),
            'executorMs': sum(c.get('elapsedMs', 0) for c in calls if c['role'] == 'executor'),
            'usage': {'input': sum(c.get('inputTokens', 0) for c in calls), 'output': sum(c.get('outputTokens', 0) for c in calls)},
        })
        rows.append(row)
(docs / 'campaign-boundaries.json').write_text(json.dumps(rows, indent=2))
print(json.dumps({'rows': [{k:r.get(k) for k in ['id','status','calls','estimatedUSD']} for r in rows],
                  'totalCalls': len(ledger['calls']), 'estimatedUSD': sum(c.get('estimatedUsd', 0) for c in ledger['calls']),
                  'unresolved': [dict(id=c['id'],case=c['caseId'],reservation=c['reservedUsd'],outcome=c['outcome']) for c in ledger['calls'] if c['outcome'] != 'usage-reconciled']}, indent=2))
