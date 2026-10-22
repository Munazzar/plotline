"""Synthetic training data for Plot Mini: Plotlines requests -> one JSON action.

The prompt and the action list are read from assistant.js (llmIntent), so a model trained on this file answers the
exact prompt the app sends, and the app needs no changes to use it. Run from the repo root:

    python train/gen_dataset.py            # writes train/data/train.jsonl and val.jsonl (6000 + 300 examples)
    python train/gen_dataset.py -n 20000   # more

Each line is {"messages":[system, user, assistant]} with the assistant turn being the JSON the app parses.
"""
import argparse, json, os, random, re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'assistant.js')


def app_prompt():
    """System prompt, user prompt template and the action enum, straight from llmIntent in assistant.js."""
    s = open(SRC, encoding='utf-8').read()
    fn = s[s.index('async function llmIntent'):]
    fn = fn[:fn.index('/* ----')]
    actions = re.search(r"action:\{enum:\[([^\]]+)\]", fn).group(1)
    actions = [a.strip().strip("'") for a in actions.split(',')]
    system = re.search(r"\{role:'system',content:'(.*?)'\},\{role:'user'", fn).group(1)
    user = re.search(r"\{role:'user',content:`(.*?)`\}\]", fn).group(1)
    assert '${t}' in user
    return system.replace("\\'", "'"), user.replace(chr(92) + "n", chr(10)), actions


# ---------- what people say ----------
LISTS = ['groceries', 'shopping', 'packing', 'to-do', 'hardware store', 'costco', 'birthday party', 'books to read', 'gift ideas', 'movies']
ITEMS = ['milk', 'eggs', 'bread', 'bananas', 'coffee', 'olive oil', 'rice', 'dish soap', 'batteries', 'chicken', 'spinach', 'yogurt',
         'passport', 'phone charger', 'sunscreen', 'socks', 'toothbrush', 'light bulbs', 'tape', 'apples', 'pasta', 'cheese']
THREADS = ['car', 'car maintenance', 'house', 'job search', 'garden', 'health', 'apartment hunt', 'visa', 'side project', 'taxes', 'wedding']
UPDATES = ['changed the oil today', 'called the landlord about the leak', 'sent two applications', 'planted the tomatoes',
           'blood test came back fine', 'saw a place on Elm Street', 'submitted the form', 'fixed the login bug',
           'got the quote for new tires', 'paid the first installment']
JOURNAL = ['had a great workout this morning', 'felt tired all day', 'went for a long walk with Sam', 'finished the book',
           'work was stressful but I got through it', 'cooked dinner for the family', 'I ran 5k in 28 minutes',
           'meditated for ten minutes and felt calm', 'grateful for a quiet evening', 'slept badly again']
REMIND = ['call mom', 'take my pills', 'pay the rent', 'water the plants', 'stretch', 'book the dentist', 'pick up the kids',
          'send the report', 'buy flowers', 'charge the car', 'check the oven']
WHEN = ['at 5pm', 'tomorrow morning', 'in 20 minutes', 'tonight', 'on Friday at 9', 'in an hour', 'tomorrow at 7am',
        'next Monday', 'at noon', 'this evening', 'in 2 hours']
GOALS = ['read 20 pages', 'go for a run', 'clean the kitchen', 'reply to Ana', 'finish the slides', 'drink more water', 'call the bank']
HABITS = ['reading', 'meditation', 'workout', 'journaling', 'flossing', 'walk', 'stretching', 'vitamins', 'piano practice']
AGENT = ['every morning summarise my emails', 'each Friday look at my calendar and plan the weekend',
         'keep an eye on replies from my landlord', 'every evening tell me what is due tomorrow', 'every Monday check my goals']
AGENT_NOW = ['check if Sam replied', 'put lunch with Ana on my calendar Friday', 'what meetings do I have tomorrow',
             'find the lease in my Drive', 'did the bank email me', 'what is the weather this afternoon']
QUESTIONS = ['what should I focus on this week', 'why do I keep skipping my workouts', 'how am I doing on my goals',
             'what is the capital of Portugal', 'give me a tip to sleep better', 'what did I do last weekend',
             'how was my mood this week', 'tell me a joke', 'explain compound interest', 'how many steps did I walk yesterday']

PRE = ['', '', '', 'hey plot ', 'ok plot, ', 'can you ', 'could you please ', 'please ', 'i want you to ', 'go ahead and ']
TYPO = {'journal': ['jounel', 'journel', 'general', 'jornal'], 'list': ['liost', 'lsit', 'lst'], 'thread': ['thred', 'therad'],
        'reminder': ['remider', 'reminer'], 'entry': ['entery', 'entry']}


def typo(s, rate=.12):
    for w, alts in TYPO.items():
        if w in s and random.random() < rate:
            s = s.replace(w, random.choice(alts), 1)
    return s


def items_text(xs):
    return xs[0] if len(xs) == 1 else ', '.join(xs[:-1]) + ' and ' + xs[-1]


def one():
    """(spoken request, json answer)"""
    k = random.choices(['journal', 'new_thread', 'thread_update', 'reminder', 'new_list', 'list_add', 'today_goal',
                        'habit_done', 'agent_task', 'agent_now', 'question'], [14, 7, 10, 14, 8, 14, 8, 8, 5, 5, 12])[0]
    j = {'action': k, 'text': '', 'target': '', 'when': ''}
    if k == 'journal':
        x = random.choice(JOURNAL)
        say = random.choice([f'add {x} to my journal', f'make a journal entry that says {x}', f'new journal entry: {x}',
                             f'write in my diary that {x}', f'journal {x}', f'{x}, put that in my journal',
                             f'add a journal entry saying {x}', f'note in my journal {x}'])
        j['text'] = x
    elif k == 'new_thread':
        x = random.choice(THREADS)
        say = random.choice([f'start a thread called {x}', f'new thread {x}', f'create a thread for my {x}', f'make a {x} thread'])
        j['text'] = x
    elif k == 'thread_update':
        x, t = random.choice(UPDATES), random.choice(THREADS)
        say = random.choice([f'add {x} to my {t} thread', f'update the {t} thread: {x}', f'in my {t} thread note that {x}',
                             f'{t} thread update, {x}'])
        j['text'], j['target'] = x, t
    elif k == 'reminder':
        x, w = random.choice(REMIND), random.choice(WHEN)
        say = random.choice([f'remind me to {x} {w}', f'set a reminder {w} to {x}', f"{w} remind me to {x}",
                             f"don't let me forget to {x} {w}", f'add a reminder to {x} {w}'])
        j['text'], j['when'] = x, w
    elif k == 'new_list':
        n, its = random.choice(LISTS), random.sample(ITEMS, random.randint(0, 3))
        say = random.choice([f'make a {n} list' + (f' with {items_text(its)}' if its else ''),
                             f'create a new list called {n}' + (f': {", ".join(its)}' if its else ''),
                             f'start a {n} list' + (f' with {items_text(its)}' if its else '')])
        j['text'], j['target'] = n, ', '.join(its)
    elif k == 'list_add':
        n, its = random.choice(LISTS), random.sample(ITEMS, random.randint(1, 3))
        say = random.choice([f'add {items_text(its)} to my {n} list', f'put {items_text(its)} on the {n} list',
                             f'{n} list: {", ".join(its)}', f'throw {items_text(its)} on my {n} list'])
        j['text'], j['target'] = ', '.join(its), n
    elif k == 'today_goal':
        x = random.choice(GOALS)
        say = random.choice([f'add a goal for today to {x}', f'today I want to {x}', f'add {x} to today', f'set a task for today: {x}'])
        j['text'] = x
    elif k == 'habit_done':
        x = random.choice(HABITS)
        say = random.choice([f'mark {x} done', f'i did my {x}', f'check off {x}', f'log {x} as done for today', f'finished my {x}'])
        j['text'] = x
    elif k == 'agent_task':
        x = random.choice(AGENT)
        say, j['text'] = x, x
    elif k == 'agent_now':
        x = random.choice(AGENT_NOW)
        say, j['text'] = x, x
    else:
        x = random.choice(QUESTIONS)
        say, j['text'] = x, x
    if k not in ('question', 'agent_now', 'agent_task'):
        say = random.choice(PRE) + say
    return typo(say), {a: b for a, b in j.items() if b or a in ('action', 'text')}


def build(n, seed):
    system, user, actions = app_prompt()
    random.seed(seed)
    out = []
    for _ in range(n):
        say, j = one()
        assert j['action'] in actions, j
        out.append({'messages': [{'role': 'system', 'content': system},
                                 {'role': 'user', 'content': user.replace('${t}', say)},
                                 {'role': 'assistant', 'content': json.dumps(j, ensure_ascii=False, separators=(',', ':'))}]})
    return out, actions


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('-n', type=int, default=6000)
    ap.add_argument('--seed', type=int, default=7)
    a = ap.parse_args()
    data, actions = build(a.n + 300, a.seed)
    # self-check: every action the app knows is covered, and every answer is JSON the app can parse
    assert set(json.loads(d['messages'][2]['content'])['action'] for d in data) == set(actions), 'an app action has no examples'
    os.makedirs(os.path.join(HERE, 'data'), exist_ok=True)
    for name, part in (('train', data[:a.n]), ('val', data[a.n:])):
        with open(os.path.join(HERE, 'data', name + '.jsonl'), 'w', encoding='utf-8') as f:
            for d in part:
                f.write(json.dumps(d, ensure_ascii=False) + '\n')
    print(f'{a.n} train + 300 val examples, {len(actions)} actions: {", ".join(actions)}')
