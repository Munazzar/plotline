"""Score a command model on train/golden.jsonl: handwritten requests with the JSON the app should get.

It sends the app's exact prompt (read from assistant.js, like gen_dataset.py) with the same JSON schema to any
OpenAI-compatible server: llama-server, Ollama, LM Studio, or the PC's local AI server. Run from the repo root:

    python train/score.py                                   # llama-server on http://127.0.0.1:8080/v1
    python train/score.py --url http://127.0.0.1:11434/v1 --model qwen2.5:0.5b

Prints accuracy per field (kind, item types, titles, time words) and every miss. Run it before shipping a new
model or a prompt change: val.jsonl comes from the same generator as the training data, so it flatters the model.
"""
import argparse, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_dataset import app_prompt  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
FILL = {'a', 'an', 'the', 'my', 'to', 'at', 'on', 'for', 'of', 'and', 'me', 'it', 'i', 'that'}


def words(s):
    return [w for w in re.sub(r"[^a-z0-9: ]", ' ', str(s or '').lower()).split() if w not in FILL]


def close(a, b):
    """same words, near enough: "call mom" ~ "Call Mom", "pills" ~ "take my pills" """
    A, B = set(words(a)), set(words(b))
    if not A and not B:
        return True
    return bool(A and B) and len(A & B) / min(len(A), len(B)) >= .6


def schema(kinds, types):
    item = {'type': 'object', 'properties': {'type': {'enum': types}, 'title': {'type': 'string'}, 'detail': {'type': 'string'},
                                             'when': {'type': 'string'}, 'end': {'type': 'string'}},
            'required': ['type', 'title'], 'additionalProperties': False}
    return {'type': 'object', 'properties': {'kind': {'enum': kinds}, 'items': {'type': 'array', 'maxItems': 6, 'items': item}},
            'required': ['kind'], 'additionalProperties': False}


def ask(url, model, system, user, sch):
    body = {'model': model, 'temperature': 0, 'max_tokens': 240,
            'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
            'response_format': {'type': 'json_schema', 'json_schema': {'name': 'command', 'schema': sch}}}
    import urllib.request
    req = urllib.request.Request(url.rstrip('/') + '/chat/completions', json.dumps(body).encode(), {'Content-Type': 'application/json'})
    out = json.load(urllib.request.urlopen(req, timeout=120))['choices'][0]['message']['content']
    return json.loads(out[out.index('{'):out.rindex('}') + 1])


def grade(want, got):
    """(field, ok) for each field checked"""
    r = [('kind', got.get('kind') == want['kind'])]
    if want['kind'] != 'do':
        return r
    W, G = want['items'], got.get('items') or []
    r.append(('types', sorted(i['type'] for i in W) == sorted(i.get('type') for i in G)))
    for w in W:
        g = next((i for i in G if i.get('type') == w['type']), None) or {}
        r.append(('title', close(w['title'] or w.get('detail'), g.get('title') or g.get('detail') if not w['title'] else g.get('title'))))
        r.append(('when', close(w.get('when'), g.get('when'))))
        if w.get('end'):
            r.append(('end', close(w['end'], g.get('end'))))
    return r


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default='http://127.0.0.1:8080/v1')
    ap.add_argument('--model', default='plot-mini')
    ap.add_argument('--file', default=os.path.join(HERE, 'golden.jsonl'))
    a = ap.parse_args()
    system, user, kinds, types = app_prompt()
    sch = schema(kinds, types)
    cases = [json.loads(l) for l in open(a.file, encoding='utf-8') if l.strip()]
    tot, ok, perfect = {}, {}, 0
    for c in cases:
        try:
            got = ask(a.url, a.model, system, user.replace('${t}', c['say']), sch)
        except Exception as e:
            got = {'error': str(e)}
        g = grade(c, got)
        for f, v in g:
            tot[f] = tot.get(f, 0) + 1
            ok[f] = ok.get(f, 0) + v
        if all(v for _, v in g):
            perfect += 1
        else:
            print(f'MISS  {c["say"]!r}\n      want {json.dumps({"kind": c["kind"], "items": c["items"]})}\n      got  {json.dumps(got)}')
    print(f'\n{perfect}/{len(cases)} requests fully right ({100 * perfect // len(cases)}%)')
    for f in tot:
        print(f'  {f:6} {ok[f]}/{tot[f]}')
