import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, Check, Heart, KeyRound, Lightbulb, Moon, Undo2 } from "lucide-react";
import "@fontsource/vazirmatn/arabic-500.css";
import "@fontsource/vazirmatn/arabic-600.css";
import "@fontsource/vazirmatn/latin-500.css";
import "@fontsource/vazirmatn/latin-600.css";
import { PERSIAN, levels, type Level } from "@/puzzle/levels";
import { clearSave, loadSave, writeSave, type Phase } from "@/puzzle/storage";

const primaryBtn = "press btn btn-primary";

const DECK: { pair: "heart" | "moon" | "key" }[] = [
  { pair: "heart" },
  { pair: "moon" },
  { pair: "heart" },
  { pair: "key" },
  { pair: "moon" },
  { pair: "key" },
];

const ICONS = {
  heart: Heart,
  moon: Moon,
  key: KeyRound,
} as const;

/* Fixed layout so server and client render the same hearts. */
const FLOATERS = [
  { x: "6%", s: "1.1rem", d: "11s", delay: "0s", sway: "24px" },
  { x: "19%", s: "0.8rem", d: "9s", delay: "2.4s", sway: "-18px" },
  { x: "31%", s: "1.5rem", d: "13s", delay: "5s", sway: "30px" },
  { x: "46%", s: "0.9rem", d: "10s", delay: "1.2s", sway: "-26px" },
  { x: "58%", s: "1.25rem", d: "12s", delay: "6.5s", sway: "20px" },
  { x: "70%", s: "0.75rem", d: "9.5s", delay: "3.4s", sway: "-14px" },
  { x: "81%", s: "1.4rem", d: "14s", delay: "0.6s", sway: "-30px" },
  { x: "92%", s: "1rem", d: "10.5s", delay: "4.4s", sway: "16px" },
];

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/* Show Persian digits; the logic underneath keeps working with plain ASCII. */
function fa(value: number | string) {
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)] ?? d);
}

function pad(n: number) {
  return fa(String(n).padStart(2, "0"));
}

const PAIR_NAMES = { heart: "قلب", moon: "ماه", key: "کلید" } as const;

function useSolve(onSolve: () => void) {
  const done = useRef(false);
  return useCallback(() => {
    if (done.current) return;
    done.current = true;
    onSolve();
  }, [onSolve]);
}

function useLater() {
  const timers = useRef<number[]>([]);
  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );
  return (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  };
}

/* A small side-to-side shake on a wrong answer. It animates the element in place,
   so nothing remounts and keyboard focus stays on the button that was pressed. */
function useNudge() {
  const ref = useRef<HTMLDivElement>(null);
  const nudge = useCallback(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(5px)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(2px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 340, easing: "ease-in-out" },
    );
  }, []);
  return { ref, nudge };
}

function Mast() {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <p className="eyebrow text-muted">{fa(11)} اکتبر</p>
      <p className="eyebrow text-rose">ده بخش</p>
    </div>
  );
}

function Rail({ filled, mark }: { filled: number; mark?: number }) {
  return (
    <ol className="rail mt-5" aria-label="ده بخش">
      {Array.from({ length: 10 }, (_, i) => (
        <li key={i} data-state={i < filled ? "done" : i === mark ? "now" : "idle"} />
      ))}
    </ol>
  );
}

function Dedication() {
  return (
    <p className="mt-auto flex items-center justify-center gap-2 pt-10 text-sm text-muted">
      <Heart className="h-3 w-3 text-gold-soft" fill="currentColor" aria-hidden />
      برای تو. فقط تو.
      <Heart className="h-3 w-3 text-gold-soft" fill="currentColor" aria-hidden />
    </p>
  );
}

function Hint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-7">
      <button
        type="button"
        data-testid="hint"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="press inline-flex min-h-11 items-center gap-2 rounded-full pe-3 text-sm text-muted"
      >
        <Lightbulb className="h-4 w-4 text-gold" aria-hidden />
        {open ? "بستن راهنمایی" : "راهنمایی می‌خواهی؟"}
      </button>
      {open ? (
        <div className="hint-box mt-2">
          <p className="text-base leading-relaxed text-ink">{text}</p>
        </div>
      ) : null}
    </div>
  );
}

function SpellPuzzle({
  tiles,
  answer,
  onSolve,
}: {
  tiles: { id: string; ch: string }[];
  answer: string;
  onSolve: () => void;
}) {
  const solve = useSolve(onSolve);
  const { ref, nudge } = useNudge();
  const [picked, setPicked] = useState<string[]>([]);
  const [bad, setBad] = useState(false);

  function wordOf(ids: string[]) {
    return ids.map((id) => tiles.find((tile) => tile.id === id)?.ch ?? "").join("");
  }

  function add(id: string) {
    if (picked.includes(id)) return;
    const next = [...picked, id];
    setPicked(next);
    if (wordOf(next).length < answer.length) {
      setBad(false);
      return;
    }
    if (wordOf(next) === answer) solve();
    else {
      setBad(true);
      nudge();
    }
  }

  function remove(id: string) {
    setPicked((ids) => ids.filter((item) => item !== id));
    setBad(false);
  }

  return (
    <div ref={ref}>
      <div className="flex justify-center gap-2" aria-label="حرف‌های تو">
        {answer.split("").map((_, i) => {
          const id = picked[i];
          const ch = id ? tiles.find((tile) => tile.id === id)?.ch : "";
          if (!id) {
            return (
              <span key={i} className="slot flex h-16 min-w-0 max-w-12 flex-1 items-center justify-center rounded-2xl">
                <span className="h-px w-4 bg-gold-soft" />
              </span>
            );
          }
          return (
            <button
              key={id}
              type="button"
              aria-label={`${ch}، برای برداشتن بزن`}
              onClick={() => remove(id)}
              className="press placed flex h-16 min-w-0 max-w-12 flex-1 items-center justify-center rounded-2xl text-2xl"
            >
              {ch}
            </button>
          );
        })}
      </div>
      <div className="mx-auto my-5 h-px w-2/3 bg-gradient-to-r from-transparent via-line to-transparent" />
      <div className="flex justify-center gap-2">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            data-testid={`tile-${tile.id}`}
            disabled={picked.includes(tile.id)}
            onClick={() => add(tile.id)}
            className="press key flex h-14 min-w-0 max-w-14 flex-1 items-center justify-center rounded-2xl text-xl"
          >
            {tile.ch}
          </button>
        ))}
      </div>
      {bad ? (
        <p role="status" className="status text-center">
          این ترتیب نیست. روی حرفِ گذاشته‌شده بزن تا برش‌گردانی.
        </p>
      ) : null}
    </div>
  );
}

function DayPuzzle({
  days,
  answer,
  onSolve,
}: {
  days: number[];
  answer: number;
  onSolve: () => void;
}) {
  const solve = useSolve(onSolve);
  const { ref, nudge } = useNudge();
  const [miss, setMiss] = useState<number[]>([]);

  return (
    <div ref={ref}>
      <p className="eyebrow mb-3 text-center text-muted">اکتبر</p>
      <div className="grid grid-cols-4 gap-2.5">
        {days.map((day) => {
          const missed = miss.includes(day);
          return (
            <button
              key={day}
              type="button"
              data-testid={`day-${day}`}
              aria-label={missed ? `${fa(day)}، نه این` : fa(day)}
              onClick={() => {
                if (day === answer) solve();
                else {
                  setMiss((current) => (current.includes(day) ? current : [...current, day]));
                  nudge();
                }
              }}
              className={`press key flex h-14 items-center justify-center rounded-2xl text-lg ${
                missed ? "line-through decoration-rose/50 opacity-50" : ""
              }`}
            >
              {fa(day)}
            </button>
          );
        })}
      </div>
      {miss.length > 0 ? (
        <p role="status" className="status text-center">
          آن روز نیست.
        </p>
      ) : null}
    </div>
  );
}

function MemoryPuzzle({ onSolve }: { onSolve: () => void }) {
  const solve = useSolve(onSolve);
  const later = useLater();
  const [up, setUp] = useState<number[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [lock, setLock] = useState(false);

  function tap(index: number) {
    const card = DECK[index];
    if (!card || lock || matched.includes(card.pair) || up.includes(index)) return;
    const next = [...up, index];
    if (next.length < 2) {
      setUp(next);
      return;
    }
    const first = DECK[next[0] ?? -1];
    const second = DECK[next[1] ?? -1];
    setUp(next);
    if (first && second && first.pair === second.pair) {
      const pairs = [...matched, first.pair];
      setMatched(pairs);
      setUp([]);
      if (pairs.length === 3) solve();
      return;
    }
    setLock(true);
    later(() => {
      setUp([]);
      setLock(false);
    }, 750);
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {DECK.map((card, index) => {
          const isMatched = matched.includes(card.pair);
          const shown = up.includes(index) || isMatched;
          const Icon = ICONS[card.pair];
          return (
            <button
              key={index}
              type="button"
              data-testid={`card-${index}`}
              data-shown={shown}
              data-matched={isMatched}
              aria-label={shown ? PAIR_NAMES[card.pair] : "کارتِ پنهان"}
              onClick={() => tap(index)}
              className="press h-28 rounded-[1.1rem] [perspective:800px]"
            >
              <span className="flip block">
                <span className="face face-back">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose/70" />
                </span>
                <span className="face face-front">
                  <Icon className="h-8 w-8" aria-hidden />
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-center text-sm text-muted" aria-live="polite">
        {fa(matched.length)} از {fa(3)} جفت
      </p>
    </div>
  );
}

function OrderPuzzle({
  words,
  answer,
  onSolve,
}: {
  words: { id: string; word: string }[];
  answer: string[];
  onSolve: () => void;
}) {
  const solve = useSolve(onSolve);
  const { ref, nudge } = useNudge();
  const [picked, setPicked] = useState<string[]>([]);
  const [bad, setBad] = useState(false);

  function add(id: string) {
    if (picked.includes(id)) return;
    const next = [...picked, id];
    setPicked(next);
    if (next.length < answer.length) {
      setBad(false);
      return;
    }
    const sentence = next.map((pid) => words.find((item) => item.id === pid)?.word ?? "");
    if (sentence.every((word, index) => word === answer[index])) solve();
    else {
      setBad(true);
      nudge();
    }
  }

  return (
    <div ref={ref}>
      <div
        className="slot flex min-h-20 flex-wrap content-center gap-2 rounded-2xl p-3"
        aria-label="جمله‌ی تو"
      >
        {picked.length === 0 ? (
          <span className="w-full text-center text-sm text-muted">کلمات را به ترتیب بزن.</span>
        ) : (
          picked.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setPicked((ids) => ids.filter((item) => item !== id));
                setBad(false);
              }}
              className="press placed rounded-full px-4 py-2 text-lg"
            >
              {words.find((item) => item.id === id)?.word}
            </button>
          ))
        )}
      </div>
      <div className="mt-5 flex flex-wrap gap-2.5">
        {words.map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid={`word-${item.id}`}
            disabled={picked.includes(item.id)}
            onClick={() => add(item.id)}
            className="press key min-h-12 rounded-full px-5 text-lg"
          >
            {item.word}
          </button>
        ))}
      </div>
      {bad ? (
        <p role="status" className="status">
          این جمله نیست. روی کلمه‌ای در بالا بزن تا برش‌داری.
        </p>
      ) : null}
    </div>
  );
}

function LockPuzzle({ answer, onSolve }: { answer: string; onSolve: () => void }) {
  const solve = useSolve(onSolve);
  const later = useLater();
  const { ref, nudge } = useNudge();
  const [digits, setDigits] = useState("");
  const [bad, setBad] = useState(false);
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "gap", "0", "back"];

  function press(digit: string) {
    if (digits.length >= answer.length) return;
    const next = digits + digit;
    setDigits(next);
    setBad(false);
    if (next.length < answer.length) return;
    if (next === answer) {
      solve();
      return;
    }
    setBad(true);
    nudge();
    later(() => setDigits(""), 480);
  }

  return (
    <div ref={ref}>
      <div dir="ltr" className="mb-5 flex justify-center gap-2.5" aria-label="کد">
        {answer.split("").map((_, i) => {
          const filled = digits[i] !== undefined;
          return (
            <span
              key={i}
              className={`flex h-16 w-12 items-center justify-center rounded-2xl text-2xl transition-colors ${
                filled
                  ? bad
                    ? "border border-rose bg-blush text-rose"
                    : "border border-rose bg-blush"
                  : "slot"
              }`}
            >
              {digits[i] ? fa(digits[i]) : ""}
            </span>
          );
        })}
      </div>
      <div dir="ltr" className="mx-auto grid max-w-[17rem] grid-cols-3 gap-3">
        {keys.map((key) =>
          key === "gap" ? (
            <span key={key} />
          ) : key === "back" ? (
            <button
              key={key}
              type="button"
              aria-label="حذف"
              onClick={() => {
                setDigits((value) => value.slice(0, -1));
                setBad(false);
              }}
              className="press flex h-14 items-center justify-center rounded-full text-muted"
            >
              <Undo2 className="h-5 w-5" aria-hidden />
            </button>
          ) : (
            <button
              key={key}
              type="button"
              data-testid={`key-${key}`}
              onClick={() => press(key)}
              className="press key flex h-14 items-center justify-center rounded-full text-xl"
            >
              {fa(key)}
            </button>
          ),
        )}
      </div>
      {bad ? (
        <p role="status" className="status text-center">
          این تاریخ نیست. اول ماه، بعد روز.
        </p>
      ) : null}
    </div>
  );
}

function ChoicePuzzle({
  options,
  answer,
  onSolve,
}: {
  options: { id: string; label: string; detail: string }[];
  answer: string;
  onSolve: () => void;
}) {
  const solve = useSolve(onSolve);
  const { ref, nudge } = useNudge();
  const [wrong, setWrong] = useState<string | null>(null);

  return (
    <div ref={ref} className="flex flex-col gap-3">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          data-testid={`choice-${option.id}`}
          onClick={() => {
            if (option.id === answer) solve();
            else {
              setWrong(option.id);
              nudge();
            }
          }}
          className={`press key flex items-center gap-4 rounded-2xl px-4 py-4 text-start ${
            wrong === option.id ? "!border-rose" : ""
          }`}
        >
          <span
            aria-hidden
            className={`h-5 w-5 shrink-0 rounded-full border ${
              wrong === option.id ? "border-rose bg-rose/20" : "border-gold-soft"
            }`}
          />
          <span>
            <span className="block text-xl">{option.label}</span>
            <span className="mt-0.5 block text-sm text-muted">{option.detail}</span>
          </span>
        </button>
      ))}
      {wrong ? (
        <p role="status" className="status !mt-0">
          به عشق نزدیک است. اما کلمه‌ای که منظورم است نیست.
        </p>
      ) : null}
    </div>
  );
}

function Blank({ value, onClear }: { value: string | null; onClear: () => void }) {
  if (!value) {
    return (
      <span className="slot inline-flex min-h-11 min-w-28 items-center justify-center rounded-xl px-4 text-sm text-muted">
        یک کلمه از پایین
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={`${value}، برای برداشتن بزن`}
      onClick={onClear}
      className="press placed inline-flex min-h-11 items-center rounded-xl px-4 text-xl"
    >
      {value}
    </button>
  );
}

function BlanksPuzzle({
  lead,
  mid,
  tail,
  bank,
  answer,
  onSolve,
}: {
  lead: string;
  mid: string;
  tail: string;
  bank: string[];
  answer: [string, string];
  onSolve: () => void;
}) {
  const solve = useSolve(onSolve);
  const { ref, nudge } = useNudge();
  const [slots, setSlots] = useState<[string | null, string | null]>([null, null]);
  const [bad, setBad] = useState(false);
  const full = slots[0] !== null && slots[1] !== null;

  function place(word: string) {
    setBad(false);
    setSlots((current) => {
      if (current[0] === null) return [word, current[1]];
      if (current[1] === null) return [current[0], word];
      return current;
    });
  }

  function check() {
    if (slots[0] === answer[0] && slots[1] === answer[1]) solve();
    else {
      setBad(true);
      nudge();
    }
  }

  return (
    <div ref={ref}>
      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-3 text-xl leading-[1.75]">
        <span>{lead}</span>
        <Blank
          value={slots[0]}
          onClear={() => {
            setBad(false);
            setSlots((current) => [null, current[1]]);
          }}
        />
        <span>{mid}</span>
        <Blank
          value={slots[1]}
          onClear={() => {
            setBad(false);
            setSlots((current) => [current[0], null]);
          }}
        />
        <span>{tail}</span>
      </p>
      <div className="mt-5 flex flex-wrap gap-2.5">
        {bank.map((word) => (
          <button
            key={word}
            type="button"
            data-testid={`bank-${word}`}
            disabled={slots.includes(word) || full}
            onClick={() => place(word)}
            className="press key min-h-12 rounded-full px-5 text-lg"
          >
            {word}
          </button>
        ))}
      </div>
      <button
        type="button"
        data-testid="check"
        disabled={!full}
        onClick={check}
        className={`${primaryBtn} mt-5 w-full`}
      >
        این همان جمله است
      </button>
      {bad ? (
        <p role="status" className="status">
          این جفت نیست. کلمه‌ی دوم کوچک‌تر است.
        </p>
      ) : null}
    </div>
  );
}

function KeepPuzzle({
  words,
  truth,
  onSolve,
}: {
  words: string[];
  truth: string[];
  onSolve: () => void;
}) {
  const solve = useSolve(onSolve);
  const { ref, nudge } = useNudge();
  const [selected, setSelected] = useState<string[]>([]);
  const [bad, setBad] = useState(false);

  function check() {
    const ok =
      truth.every((word) => selected.includes(word)) &&
      selected.every((word) => truth.includes(word));
    if (ok) solve();
    else {
      setBad(true);
      nudge();
    }
  }

  return (
    <div ref={ref}>
      <div className="flex flex-wrap gap-2.5">
        {words.map((word) => {
          const on = selected.includes(word);
          return (
            <button
              key={word}
              type="button"
              data-testid={`keep-${word}`}
              aria-pressed={on}
              onClick={() => {
                setBad(false);
                setSelected((current) =>
                  current.includes(word) ? current.filter((item) => item !== word) : [...current, word],
                );
              }}
              className={`press inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-lg ${
                on
                  ? "border border-rose-deep bg-gradient-to-b from-[#a63f55] to-rose text-paper shadow-[0_8px_14px_-8px_rgba(107,33,50,0.6)]"
                  : "key"
              }`}
            >
              {on ? <Check className="-ms-1 h-4 w-4" aria-hidden /> : null}
              {word}
            </button>
          );
        })}
      </div>
      <button type="button" data-testid="check" onClick={check} className={`${primaryBtn} mt-5 w-full`}>
        این‌ها می‌مانند
      </button>
      {bad ? (
        <p role="status" className="status">
          یک کلمه‌ی مردد وارد شده، یا یکی از درست‌ها هنوز بیرون است.
        </p>
      ) : null}
    </div>
  );
}

function HeartsPuzzle({ onSolve }: { onSolve: () => void }) {
  const solve = useSolve(onSolve);
  const [hearts, setHearts] = useState<boolean[]>(() => Array.from({ length: 10 }, () => false));
  const count = hearts.filter(Boolean).length;

  return (
    <div>
      <div className="grid grid-cols-5 gap-2.5">
        {hearts.map((filled, index) => (
          <button
            key={index}
            type="button"
            data-testid={`heart-${index}`}
            aria-pressed={filled}
            aria-label={filled ? `قلب ${fa(index + 1)}، داده شد` : `قلب ${fa(index + 1)}`}
            onClick={() => {
              if (filled) return;
              setHearts((current) => {
                const next = current.slice();
                next[index] = true;
                return next;
              });
            }}
            className={`press flex h-16 items-center justify-center rounded-2xl ${
              filled ? "placed !animate-none text-rose" : "key text-rose/70"
            }`}
          >
            <Heart
              className={`h-7 w-7 ${filled ? "heart-pop" : ""}`}
              fill={filled ? "currentColor" : "none"}
              aria-hidden
            />
          </button>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
          <div
            className="h-full rounded-full bg-rose transition-[width] duration-500"
            style={{ width: `${count * 10}%` }}
          />
        </div>
        <p className="text-sm text-muted" aria-live="polite">
          {fa(count)} از {fa(10)}
        </p>
      </div>
      {count === 10 ? (
        <button
          type="button"
          data-testid="open-last"
          onClick={solve}
          className={`${primaryBtn} pulse rise mt-5 w-full`}
        >
          آخرین بخش را باز کن
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function PuzzleBody({ level, onSolve }: { level: Level; onSolve: () => void }) {
  switch (level.kind) {
    case "spell":
      return <SpellPuzzle tiles={level.tiles} answer={level.answer} onSolve={onSolve} />;
    case "day":
      return <DayPuzzle days={level.days} answer={level.answer} onSolve={onSolve} />;
    case "memory":
      return <MemoryPuzzle onSolve={onSolve} />;
    case "order":
      return <OrderPuzzle words={level.words} answer={level.answer} onSolve={onSolve} />;
    case "lock":
      return <LockPuzzle answer={level.answer} onSolve={onSolve} />;
    case "choice":
      return <ChoicePuzzle options={level.options} answer={level.answer} onSolve={onSolve} />;
    case "blanks":
      return (
        <BlanksPuzzle
          lead={level.lead}
          mid={level.mid}
          tail={level.tail}
          bank={level.bank}
          answer={level.answer}
          onSolve={onSolve}
        />
      );
    case "keep":
      return <KeepPuzzle words={level.words} truth={level.truth} onSolve={onSolve} />;
    case "hearts":
      return <HeartsPuzzle onSolve={onSolve} />;
    default: {
      const unknown: never = level;
      return unknown;
    }
  }
}

function PersianLine({ testId }: { testId?: string }) {
  return (
    <p
      data-testid={testId}
      lang="fa"
      dir="rtl"
      className="text-center font-persian text-3xl font-medium leading-relaxed text-ink sm:text-4xl"
    >
      {PERSIAN}
    </p>
  );
}

function Seal({ small, className = "" }: { small?: boolean; className?: string }) {
  return (
    <div className={`seal seal-in ${small ? "seal-sm" : ""} ${className}`} aria-hidden>
      <Heart className={`beat ${small ? "h-5 w-5" : "h-8 w-8"}`} fill="currentColor" />
    </div>
  );
}

export function Game() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [level, setLevel] = useState(0);
  const [ready, setReady] = useState(false);
  const [armed, setArmed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const saved = loadSave();
    if (saved) {
      setPhase(saved.phase);
      setLevel(saved.level);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (phase === "intro") clearSave();
    else writeSave({ v: 1, phase, level });
  }, [ready, phase, level]);

  useEffect(() => {
    if (!ready) return;
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
    setArmed(false);
  }, [ready, phase, level]);

  const solve = useCallback(() => {
    if (level >= 9) setPhase("finale");
    else setPhase("note");
  }, [level]);

  function next() {
    if (level >= 8) {
      setLevel(9);
      setPhase("play");
      return;
    }
    setLevel((current) => current + 1);
    setPhase("play");
  }

  function reset() {
    setArmed(false);
    setLevel(0);
    setPhase("intro");
  }

  const data = levels[level];

  return (
    <main className="page bg-transparent text-ink">
      <div className="sheet mx-auto flex w-full max-w-lg flex-col">
        <div key={`${phase}-${level}`} className="stage">
          {phase === "intro" ? (
            <>
              <Mast />
              <div className="my-auto flex flex-col items-center py-6 text-center sm:py-4">
                <Seal />
                <p className="rise rise-2 eyebrow mt-6 text-rose">روز جهانی دختر</p>
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="rise rise-2 mt-3 text-6xl font-semibold leading-[1.35] text-balance focus:outline-none sm:text-7xl"
                >
                  برای تو
                </h1>
                <div className="rise rise-3 ornament mt-5 w-40" aria-hidden>
                  <span className="h-1 w-1 rotate-45 bg-gold" />
                </div>
                <p className="rise rise-3 mt-5 max-w-xs text-lg leading-[1.75] text-pretty">
                  ده قفل کوچک. پشت هرکدام، چیزی حقیقی درباره‌ی اینکه چقدر دوستت دارم.
                </p>
                <div className="rise rise-4 mt-7 w-full">
                  <Rail filled={0} />
                  <button
                    type="button"
                    data-testid="start"
                    onClick={() => setPhase("play")}
                    className={`${primaryBtn} mt-6 w-full`}
                  >
                    بخش اول را باز کن
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                  </button>
                  <p className="mt-4 text-sm text-muted">اگر بخواهی، برای هر بخش یک راهنمایی هم هست.</p>
                </div>
              </div>
              <Dedication />
            </>
          ) : null}

          {phase === "play" && data ? (
            <>
              <Mast />
              <Rail filled={level} mark={level} />
              <div className="rise mt-9">
                <p className="eyebrow text-rose">
                  بخش {pad(level + 1)} <span className="text-muted">از {fa(10)}</span>
                </p>
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="mt-2 text-4xl font-semibold leading-[1.45] text-balance focus:outline-none"
                >
                  {data.title}
                </h1>
                <p className="mt-3 text-lg leading-[1.75] text-pretty text-muted">{data.prompt}</p>
              </div>
              <div className="panel rise rise-2 mt-6">
                <PuzzleBody key={level} level={data} onSolve={solve} />
              </div>
              <Hint text={data.hint} />
              <Dedication />
            </>
          ) : null}

          {phase === "note" && data ? (
            <>
              <Mast />
              <Rail filled={level + 1} />
              <div className="my-auto flex flex-col items-center py-6 text-center sm:py-4">
                <Seal small />
                <p className="rise rise-2 eyebrow mt-6 text-rose">
                  بخش {pad(level + 1)} · باز شد
                </p>
                <div className="rise rise-2 ornament mt-5 w-28" aria-hidden>
                  <span className="h-1 w-1 rotate-45 bg-gold" />
                </div>
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="rise rise-3 note-text mt-6 text-[1.65rem] leading-[1.9] focus:outline-none sm:text-3xl"
                >
                  {data.note}
                </h1>
                <button
                  type="button"
                  data-testid="next"
                  onClick={next}
                  className={`${primaryBtn} rise rise-4 mt-10 w-full`}
                >
                  {level === 8 ? "یک بخش مانده" : "بخش بعدی"}
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <Dedication />
            </>
          ) : null}

          {phase === "finale" ? (
            <>
              <div className="hearts-field" aria-hidden>
                {FLOATERS.map((f, i) => (
                  <span
                    key={i}
                    style={
                      {
                        "--x": f.x,
                        "--s": f.s,
                        "--d": f.d,
                        "--delay": f.delay,
                        "--sway": f.sway,
                      } as CSSProperties
                    }
                  >
                    <Heart className="h-full w-full" fill="currentColor" />
                  </span>
                ))}
              </div>
              <Mast />
              <Rail filled={10} />
              <div className="my-auto flex flex-col items-center py-8 text-center">
                <Seal />
                <p className="rise rise-2 eyebrow mt-7 text-rose">بخش آخر</p>
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="rise rise-2 note-text mt-4 text-[1.65rem] leading-[1.9] focus:outline-none sm:text-3xl"
                >
                  {levels[9]?.note}
                </h1>
                <div className="rise rise-3 ornament mt-8 w-40" aria-hidden>
                  <span className="h-1 w-1 rotate-45 bg-gold" />
                </div>
                <div className="rise rise-4 persian-card mt-8 w-full">
                  <PersianLine testId="persian" />
                </div>
                <button
                  type="button"
                  data-testid="letter"
                  onClick={() => setPhase("letter")}
                  className="press btn btn-quiet rise rise-4 mt-10 w-full"
                >
                  همه‌ی بخش‌ها را بخوان
                </button>
                <ResetRow
                  armed={armed}
                  onArm={() => setArmed(true)}
                  onCancel={() => setArmed(false)}
                  onReset={reset}
                />
              </div>
            </>
          ) : null}

          {phase === "letter" ? (
            <>
              <Mast />
              <div className="rise mt-9">
                <p className="eyebrow text-rose">ده بخش</p>
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="mt-2 text-4xl font-semibold leading-[1.45] focus:outline-none"
                >
                  کل نامه
                </h1>
                <p className="mt-3 text-muted">هر ده بخش، به ترتیبی که بازشان کردی.</p>
              </div>
              <div className="timeline rise rise-2 mt-8">
                {levels.map((item, index) => (
                  <article key={item.title}>
                    <h2 className="eyebrow text-rose">بخش {pad(index + 1)}</h2>
                    <p className="note-text mt-2 text-xl leading-[1.9]">{item.note}</p>
                    {index === 9 ? (
                      <div className="persian-card mt-6">
                        <PersianLine />
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
              <button type="button" onClick={() => setPhase("finale")} className={`${primaryBtn} mt-4 w-full`}>
                بازگشت به بخش آخر
              </button>
              <div className="flex flex-col items-center">
                <ResetRow
                  armed={armed}
                  onArm={() => setArmed(true)}
                  onCancel={() => setArmed(false)}
                  onReset={reset}
                />
              </div>
              <Dedication />
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function ResetRow({
  armed,
  onArm,
  onCancel,
  onReset,
}: {
  armed: boolean;
  onArm: () => void;
  onCancel: () => void;
  onReset: () => void;
}) {
  if (!armed) {
    return (
      <button
        type="button"
        onClick={onArm}
        className="press mt-5 inline-flex min-h-11 items-center px-3 text-sm text-muted"
      >
        شروع دوباره
      </button>
    );
  }
  return (
    <div className="mt-5 text-center">
      <p className="text-sm text-muted">نامه را تا کنیم؟ جایت در نامه فراموش می‌شود.</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          data-testid="confirm-reset"
          onClick={onReset}
          className="press min-h-11 rounded-full border border-rose px-5 text-sm text-rose"
        >
          بله، از اول
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="press inline-flex min-h-11 items-center px-4 text-sm text-muted"
        >
          نگهش دار
        </button>
      </div>
    </div>
  );
}
