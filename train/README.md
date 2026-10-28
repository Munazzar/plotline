# Plot on the phone: speed, and a model of its own

## Where the time goes in a voice turn (1.43)

Each spoken turn is timed on the phone: Settings › AI & voice › *Speed of my last answers* (also `PLOT_SPEED()` in the
console, and `[plot-speed]` log lines). All times count from your last word.

What the 1.42 code did with a spoken question on the default model (Gemma 4 E2B, llama.cpp on the phone's CPU):

| Step | 1.42 | 1.43, instant mode on |
|---|---|---|
| Mic closes after your last word | waits out the pause setting (5 s by default) | at once when the words are a complete command or a simple lookup; your pause setting still applies to anything else |
| Command or lookup ("add milk to groceries", "how many steps today") | parser for commands; lookups waited for an AI routing call when the AI was set up | parser and lookups answer in about 1–60 ms, with no AI |
| AI routing call (`AGENT.decide`, about 1,700 characters of instructions plus a JSON grammar) | before every question | only when the request needs the agent, the web, a schedule, or asks to make something |
| Prompt cache | lost on every turn: the engine keeps one cached prompt, and the routing call and the answer evicted each other | the answer's system prompt stays the same between turns, so llama.cpp (`cache_prompt`, one slot) reuses it; LiteRT-LM prefills it once and clones it per turn |
| Prompt read before the first token | about 2,800 characters of system prompt + up to 5,200 characters of your data + 3 turns | about 900 characters of system prompt (cached after the first turn) + up to 1,800 characters of your data + 2 short turns |
| Answer length | up to 260 tokens | up to 180 tokens |
| Speaking | after the whole answer was written | at the first full sentence, while the rest is still written |
| Model load | when the first question arrived | at the wake word, when the assistant or Live opens, and at start when the wake word is on |

Reading the prompt (prefill) is the largest cost on a phone CPU. Rough figures for a 2 GB-class model on a mid-range phone:
60–150 tokens a second for prefill, 8–15 tokens a second for writing. So about 2,000 tokens of prompt meant 15–30 s
before the first word, and the routing call added a few more seconds. These are estimates, not measurements: the
speed panel shows the real numbers for your phone. For questions to answer in a second or two, use a smaller model
(Qwen 2.5 0.5B / Llama 3.2 1B), Gemma on the GPU, or your own server for hard questions.

## Plot Mini: train a command model

A small model fine-tuned to do one job: turn a request into the JSON command the app's `llmIntent` understands:
`{"kind": "do" | "agent_task" | "agent_now" | "question", "items": [...]}`. Each item has a `type` (`reminder`, `today`,
`goal`, `habit`, `habit_done`, `journal`, `thread`, `thread_update`, `list`, `list_add`), a `title`, an optional
`detail`, and the time words copied exactly as said in `when` and `end` ("tomorrow at 3", "4pm"). The app reads the
time words itself (`whenOf` in assistant.js), so the model never does date maths. A today goal, goal, habit or note
with a `when` also gets its reminder; a reminder with an `end` gets that length. `AGENT.decide` uses the same items. The router handles the common phrasings with no AI. Plot Mini is for the
loose ones ("jot down that the plumber's coming thursday in the house thread"), and answers in well under a second.

1. **Data**: `python train/gen_dataset.py` writes `train/data/train.jsonl` and `val.jsonl`. It reads the prompt and
   the action list from `assistant.js`, so a new action there shows up in the data (and the script fails if an
   action has no examples). Add phrasings in the lists at the top of the script.
2. **Check it**: `python train/score.py --url <any OpenAI-compatible server>` runs the handwritten requests in
   `train/golden.jsonl` with the app's exact prompt and schema, and prints accuracy for kind, item types, titles and
   time words, plus every miss. Run it before and after training, and before shipping a prompt change. Add a line to
   `golden.jsonl` for every real request the app got wrong.
3. **Train**: open `train/plot_mini_lora.ipynb` in Colab (T4 GPU), run all cells. It uses Unsloth + LoRA on
   Gemma 3 270M (or 1B / Qwen 2.5 0.5B, one line to change) and prints how many held-out requests it gets right.
4. **Export**: the notebook writes `plot-mini-q4_0.gguf` (native llama.cpp, the app's default engine) and, optionally,
   `plot-mini.litertlm` (GPU path through LiteRT-LM).
5. **Publish**: the last cell uploads both to `huggingface.co/Munazzar/plot-mini`. The app checks for the GGUF
   once a day and then lists **Plot Mini 270M** under AI › How answers are made (`MINI` in `index.html`).

Plot Mini is a command model, not a chat model. Picked as the main model, it makes commands fast and gives short,
plain answers to questions. For a smart *and* fast setup, keep a chat model for questions or connect your own server
(below).

## Other options

### Gemini Nano on the phone (Android AICore, ML Kit GenAI)
Recent flagship phones (Pixel 9 and later, Galaxy S25 and others) run Gemini Nano in the system's AICore service. Apps
reach it through the **ML Kit GenAI Prompt API** (`com.google.mlkit:genai-prompt`). The model is already on the phone
and shared with other apps: nothing to download, and it runs on the NPU, so it's fast with little battery.

What Plotlines needs for it:
- A native bridge in the Android wrapper, like `LocalLlm`: check `Generation.getClient().checkStatus()`
  (available / downloadable / unavailable), then `generateContentStream(prompt)` and send each piece to
  `window.__llm(id,'t',text)`, the same callbacks `natChat` already uses.
- An engine choice next to llama.cpp in `planEngine()`, shown only when the status is available.
- Limits: around 4,000 tokens of input, no custom system prompt (put the instructions first in the prompt), runs only
  while the app is in the foreground, and it's subject to the phone's quota. This works well with the short spoken prompt.

### Your own AI server for hard questions
Settings › AI › *Your AI server* already takes any OpenAI-compatible address (Ollama, LM Studio, OpenRouter, a cloud
API). With instant mode, commands and lookups stay on the phone, and questions go to the server with the same short
prompt, streamed and spoken sentence by sentence. A good pairing: Plot Mini or Qwen 2.5 0.5B on the phone for
commands, and a large model on the server for questions.
