"""Synthetic training data for Plot Mini: Plotlines requests -> one JSON command ({"kind", "items"}).

The prompt and the kinds and item types are read from assistant.js (llmIntent), so a model trained on this file answers
the exact prompt the app sends, and the app needs no changes to use it. Run from the repo root:

    python train/gen_dataset.py            # writes train/data/train.jsonl and val.jsonl (6000 + 300 examples)
    python train/gen_dataset.py -n 20000   # more

Each line is {"messages":[system, user, assistant]} with the assistant turn being the JSON the app parses.
Time words are copied as said into "when"/"end"; the app turns them into dates itself (small models get dates wrong).
"""
import argparse, json, os, random, re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'assistant.js')


def app_prompt():
    """System prompt, user prompt template, the kinds and the item types, straight from llmIntent in assistant.js."""
    s = open(SRC, encoding='utf-8').read()
    fn = s[s.index('async function llmIntent'):]
    fn = fn[:fn.index('/* ----')]
    enum = lambda k: [a.strip().strip("'") for a in re.search(k + r":\{enum:\[([^\]]+)\]", fn).group(1).split(',')]
    system = re.search(r"\{role:'system',content:'(.*?)'\},\{role:'user'", fn).group(1)
    user = re.search(r"\{role:'user',content:`(.*?)`\}\]", fn).group(1)
    assert '${t}' in user
    return system.replace("\\'", "'"), user.replace(chr(92) + "n", chr(10)), enum('kind'), enum('type')


# ---------- what people say ----------
LISTS = ['groceries', 'shopping', 'packing', 'to-do', 'hardware store', 'costco', 'birthday party', 'books to read', 'gift ideas', 'movies']
ITEMS = ['milk', 'eggs', 'bread', 'bananas', 'coffee', 'olive oil', 'rice', 'dish soap', 'batteries', 'chicken', 'spinach', 'yogurt',
         'passport', 'phone charger', 'sunscreen', 'socks', 'toothbrush', 'light bulbs', 'tape', 'apples', 'pasta', 'cheese']
NOTES = ['car', 'car maintenance', 'house', 'job search', 'garden', 'health', 'apartment hunt', 'visa', 'side project', 'taxes', 'wedding']
UPDATES = ['changed the oil today', 'called the landlord about the leak', 'sent two applications', 'planted the tomatoes',
           'blood test came back fine', 'saw a place on Elm Street', 'submitted the form', 'fixed the login bug',
           'got the quote for new tires', 'paid the first installment']
JOURNAL = ['had a great workout this morning', 'felt tired all day', 'went for a long walk with Sam', 'finished the book',
           'work was stressful but I got through it', 'cooked dinner for the family', 'I ran 5k in 28 minutes',
           'meditated for ten minutes and felt calm', 'grateful for a quiet evening', 'slept badly again']
REMIND = ['call mom', 'take my pills', 'pay the rent', 'water the plants', 'stretch', 'book the dentist', 'pick up the kids',
          'send the report', 'buy flowers', 'charge the car', 'check the oven']
WHEN = ['at 5pm', 'tomorrow morning', 'in 20 minutes', 'tonight', 'on Friday at 9', 'in an hour', 'tomorrow at 7am',
        'next Monday', 'at noon', 'this evening', 'in 2 hours', 'every 2 hours', 'every day at 8am', 'on the 15th at 10am',
        'tomorrow at 6:30pm', 'at 4']
EVENTS = [('dentist appointment', 'tomorrow at 3', '4pm'), ('team meeting', 'on Monday at 10am', '11am'), ('deep work', 'today at 2', '5pm'),
          ('gym', 'tomorrow at 7am', '8am'), ('lunch with Ana', 'on Friday at noon', '1:30pm'), ('study session', 'tonight at 8', '10pm')]
GOALS = ['read 20 pages', 'go for a run', 'clean the kitchen', 'reply to Ana', 'finish the slides', 'drink more water', 'call the bank']
BIG = ['run a marathon', 'learn Spanish', 'save 5000 dollars', 'lose 5 kilos', 'get a new job', 'write a book', 'learn to swim']
TIMES = ['at 4', 'at 6pm', 'at 9am', 'tonight at 8', 'at noon', 'at 7:30pm', 'in 2 hours']
HABITS = ['reading', 'meditation', 'workout', 'journaling', 'flossing', 'walk', 'stretching', 'vitamins', 'piano practice']
AGENT = ['every morning summarise my emails', 'each Friday look at my calendar and plan the weekend',
         'keep an eye on replies from my landlord', 'every evening tell me what is due tomorrow', 'every Monday check my goals']
AGENT_NOW = ['check if Sam replied', 'put lunch with Ana on my calendar Friday', 'what meetings do I have tomorrow',
             'find the lease in my Drive', 'did the bank email me', 'what is the weather this afternoon']
QUESTIONS = ['what should I focus on this week', 'why do I keep skipping my workouts', 'how am I doing on my goals',
             'what is the capital of Portugal', 'give me a tip to sleep better', 'what did I do last weekend',
             'how was my mood this week', 'tell me a joke', 'explain compound interest', 'how many steps did I walk yesterday']

PRE = ['', '', '', 'hey plot ', 'ok plot, ', 'can you ', 'could you please ', 'please ', 'i want you to ', 'go ahead and ']
TYPO = {'journal': ['jounel', 'journel', 'general', 'jornal'], 'list': ['liost', 'lsit', 'lst'], 'note': ['nite', 'noet'],
        'reminder': ['remider', 'reminer'], 'remind': ['remine', 'remaind'], 'habit': ['habbit', 'habid'], 'goal': ['gole', 'goel']}
C = random.choice


def typo(s, rate=.12):
    for w, alts in TYPO.items():
        if w in s and random.random() < rate:
            s = s.replace(w, C(alts), 1)
    return s


def items_text(xs):
    return xs[0] if len(xs) == 1 else ', '.join(xs[:-1]) + ' and ' + xs[-1]


def it(type, title='', detail='', when='', end=''):
    return {k: v for k, v in dict(type=type, title=title, detail=detail, when=when, end=end).items() if v or k in ('type', 'title')}


def one():
    """(spoken request, json answer)"""
    k = random.choices(['journal', 'note', 'note_update', 'reminder', 'event', 'list', 'list_add', 'today', 'today_t', 'goal',
                        'habit', 'habit_done', 'combo', 'agent_task', 'agent_now', 'question'],
                       [10, 6, 8, 14, 5, 6, 10, 6, 6, 4, 5, 6, 5, 4, 4, 10])[0]
    kind, items = 'do', []
    if k == 'journal':
        x = C(JOURNAL)
        say = C([f'add {x} to my journal', f'make a journal entry that says {x}', f'new journal entry: {x}',
                 f'write in my diary that {x}', f'journal {x}', f'{x}, put that in my journal', f'note in my journal {x}'])
        items = [it('journal', '', x)]
    elif k == 'note':
        n = C(NOTES)
        if random.random() < .5:
            x = C(UPDATES)
            say = C([f'start a note called {n} and write {x}', f'new note {n}: {x}', f'make a {n} note saying {x}'])
            items = [it('thread', n, x)]
        else:
            say = C([f'start a note called {n}', f'new note {n}', f'create a note for my {n}', f'make a {n} note'])
            items = [it('thread', n)]
    elif k == 'note_update':
        x, n = C(UPDATES), C(NOTES)
        say = C([f'add {x} to my {n} note', f'update the {n} note: {x}', f'in my {n} note write that {x}', f'{n} note update, {x}'])
        items = [it('thread_update', n, x)]
    elif k == 'reminder':
        x, w = C(REMIND), C(WHEN)
        say = C([f'remind me to {x} {w}', f'set a reminder {w} to {x}', f'{w} remind me to {x}', f"don't let me forget to {x} {w}",
                 f'add a reminder to {x} {w}', f'ping me {w} to {x}'])
        items = [it('reminder', x, when=w)]
    elif k == 'event':
        x, w, e = C(EVENTS)
        say = C([f'{x} {w} until {e}', f'block {w} to {e} for {x}', f'put {x} {w} to {e} in my calendar', f'schedule {x} {w} till {e}'])
        items = [it('reminder', x, when=w, end=e)]
    elif k == 'list':
        n, its = C(LISTS), random.sample(ITEMS, random.randint(0, 3))
        say = C([f'make a {n} list' + (f' with {items_text(its)}' if its else ''),
                 f'create a new list called {n}' + (f': {", ".join(its)}' if its else ''),
                 f'start a {n} list' + (f' with {items_text(its)}' if its else '')])
        items = [it('list', n, ', '.join(its))]
    elif k == 'list_add':
        n, its = C(LISTS), random.sample(ITEMS, random.randint(1, 3))
        say = C([f'add {items_text(its)} to my {n} list', f'put {items_text(its)} on the {n} list', f'{n} list: {", ".join(its)}',
                 f'throw {items_text(its)} on my {n} list'])
        items = [it('list_add', n, ', '.join(its))]
    elif k == 'today':
        x = C(GOALS)
        say = C([f'add a goal for today to {x}', f'today I want to {x}', f"today's goal is to {x}", f'set a task for today: {x}'])
        items = [it('today', x)]
    elif k == 'today_t':
        x, w = C(GOALS), C(TIMES)
        say = C([f"today's goal {x} and remind me {w}", f'add a goal for today to {x} with a reminder {w}',
                 f'today I want to {x}, remind me {w}', f'set a task for today to {x} {w}'])
        items = [it('today', x, when=w)]
    elif k == 'goal':
        x = C(BIG)
        if random.random() < .4:
            w = C(['every Sunday at 6pm', 'tomorrow at 9am', 'on Monday at 8'])
            say = C([f'new goal: {x}, remind me {w}', f'set a goal to {x} and remind me {w}'])
            items = [it('goal', x, when=w)]
        else:
            say = C([f'set a goal to {x}', f'new goal: {x}', f'my goal is to {x}', f'add a goal {x}', f'i want to {x} this year'])
            items = [it('goal', x)]
    elif k == 'habit':
        x = C(HABITS)
        if random.random() < .5:
            w = C(['at 9pm', 'at 7am', 'at 6:30am', 'every night at 10pm', 'every morning at 8am'])
            say = C([f'start a {x} habit {w}', f'new habit {x}, remind me {w}', f'add a habit of {x} {w}'])
            items = [it('habit', x, when=w)]
        else:
            say = C([f'start a {x} habit', f'new habit: {x}', f'add a habit of {x}', f'i want to build a {x} habit'])
            items = [it('habit', x)]
    elif k == 'habit_done':
        x = C(HABITS)
        say = C([f'mark {x} done', f'i did my {x}', f'check off {x}', f'log {x} as done for today', f'finished my {x}'])
        items = [it('habit_done', x)]
    elif k == 'combo':
        n, its, x, w = C(LISTS), random.sample(ITEMS, 2), C(REMIND), C(WHEN)
        j = C(JOURNAL)
        say, items = C([
            (f'add {items_text(its)} to my {n} list and remind me to {x} {w}', [it('list_add', n, ', '.join(its)), it('reminder', x, when=w)]),
            (f'journal {j} and mark {(h := C(HABITS))} done', [it('journal', '', j), it('habit_done', h)]),
            (f'remind me to {x} {w} and add {(g := C(GOALS))} to today', [it('reminder', x, when=w), it('today', g)]),
        ])
    elif k == 'agent_task':
        kind, say = k, C(AGENT)
    elif k == 'agent_now':
        kind, say = k, C(AGENT_NOW)
    else:
        kind, say = 'question', C(QUESTIONS)
    if kind == 'do':
        say = C(PRE) + say
    j = {'kind': kind, 'items': items} if items else {'kind': kind}
    return typo(say), j


def build(n, seed):
    system, user, kinds, types = app_prompt()
    random.seed(seed)
    out = []
    for _ in range(n):
        say, j = one()
        assert j['kind'] in kinds and all(i['type'] in types for i in j.get('items', [])), j
        out.append({'messages': [{'role': 'system', 'content': system},
                                 {'role': 'user', 'content': user.replace('${t}', say)},
                                 {'role': 'assistant', 'content': json.dumps(j, ensure_ascii=False, separators=(',', ':'))}]})
    return out, kinds, types


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('-n', type=int, default=6000)
    ap.add_argument('--seed', type=int, default=7)
    a = ap.parse_args()
    data, kinds, types = build(a.n + 300, a.seed)
    # self-check: every kind and item type the app knows is covered
    seen = [json.loads(d['messages'][2]['content']) for d in data]
    assert {j['kind'] for j in seen} == set(kinds), 'an app kind has no examples'
    assert {i['type'] for j in seen for i in j.get('items', [])} == set(types),'an item type has no examples'
    os.makedirs(os.path.join(HERE, 'data'), exist_ok=True)
    for name, part in (('train', data[:a.n]), ('val', data[a.n:])):
        with open(os.path.join(HERE, 'data', name + '.jsonl'), 'w', encoding='utf-8') as f:
            for d in part:
                f.write(json.dumps(d, ensure_ascii=False) + '\n')
    print(f'{a.n} train + 300 val examples, kinds: {", ".join(kinds)}; item types: {", ".join(types)}')
