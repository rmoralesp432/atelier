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
        tool_outputs = {}
        for c in calls:
            request_path = root / 'calls' / (c['id'] + '-request.json')
            if not request_path.exists():
                continue
            for item in json.loads(request_path.read_text()).get('input', []):
                if isinstance(item, dict) and item.get('type') == 'function_call_output':
                    try:
                        tool_outputs[item['call_id']] = json.loads(item['output'])
                    except (ValueError, TypeError):
                        pass
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
                    result = tool_outputs.get(output.get('call_id'), {})
                    inspections.append({'call': c['id'], 'arguments': json.loads(output['arguments']),
                        'resultRecorded': bool(result), 'available': result.get('available'),
                        'matched': result.get('matched', len(result.get('objects', []))),
                        'missingIds': result.get('missingIds', []), 'source': result.get('source'),
                        'returnedObjectIds': [o.get('id') for o in result.get('objects', [])]})
        for e in r.get('events', []):
            if e['kind'] == 'reviewer':
                for check in (e.get('response') or {}).get('checks', []):
                    if check.get('calculation'):
                        calculations.append({'requirement': check.get('requirement'), 'calculation': check['calculation']})
        repairs = [e['input'].get('validationFeedback') for e in r.get('events', [])
                   if e['kind'] == 'executor' and e['input'].get('validationFeedback', {}).get('verification')]
        row = {k: r.get(k) for k in ['id', 'version', 'task', 'edit', 'diagnostic', 'negative', 'status', 'committed', 'componentCount', 'changedIds', 'preservedIds', 'transaction', 'elapsedMs', 'error', 'originalPreserved']}
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
changes = []
for r in rows:
    if not r.get('edit') or not r.get('committed'):
        continue
    marker = '-baseline-' if '-baseline-' in r['id'] else '-workshop-' if '-workshop-' in r['id'] else '-verifier-'
    folder = root / r['id'].split(marker)[0]
    before = json.loads((folder / (r['id'] + '-before.json')).read_text())['project']['volumes']
    after = json.loads((folder / (r['id'] + '-after.json')).read_text())['project']['volumes']
    old, new = {v['id']: v for v in before}, {v['id']: v for v in after}
    changes.append({'case': r['id'], 'rawStatus': r['status'], 'diagnostic': r['diagnostic'],
        'changed': [{'id': i, 'beforeName': old[i].get('name'), 'afterName': new[i].get('name'),
                     'changedFields': [k for k in sorted(set(old[i]) | set(new[i])) if old[i].get(k) != new[i].get(k)]}
                    for i in sorted(old.keys() & new.keys()) if old[i] != new[i]],
        'preserved': [{'id': i, 'name': v.get('name')} for i, v in old.items() if new.get(i) == v],
        'newIds': sorted(new.keys() - old.keys()), 'removedIds': sorted(old.keys() - new.keys()), 'transaction': r['transaction']})
(docs / 'component-changes.json').write_text(json.dumps(changes, indent=2) + '\n')

print(json.dumps({'rows': [{k:r.get(k) for k in ['id','status','calls','estimatedUSD']} for r in rows],
                  'totalCalls': len(ledger['calls']), 'estimatedUSD': sum(c.get('estimatedUsd', 0) for c in ledger['calls']),
                  'unresolved': [dict(id=c['id'],case=c['caseId'],reservation=c['reservedUsd'],outcome=c['outcome']) for c in ledger['calls'] if c['outcome'] != 'usage-reconciled']}, indent=2))
